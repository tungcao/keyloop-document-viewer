import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesSystemClient } from '../clients/sales-system.client';
import { ServiceSystemClient } from '../clients/service-system.client';
import { CacheService } from '../common/cache/cache.service';
import { AuditLogService } from '../audit/audit-log.service';
import { createCircuitBreaker } from '../common/circuit-breaker/circuit-breaker.factory';
import { DocumentResponseDto } from './dto/document-response.dto';
import { UnifiedDocument } from './interfaces/unified-document.interface';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly cacheTtl: number;

  // One circuit breaker per client — never shared (AGENT_SPEC §4 step 3)
  private readonly salesBreaker: ReturnType<typeof createCircuitBreaker>;
  private readonly serviceBreaker: ReturnType<typeof createCircuitBreaker>;

  constructor(
    private readonly salesClient: SalesSystemClient,
    private readonly serviceClient: ServiceSystemClient,
    private readonly cacheService: CacheService,
    private readonly auditLogService: AuditLogService,
    private readonly config: ConfigService,
  ) {
    this.cacheTtl = this.config.get<number>('cacheTtlSeconds')!;
    const timeoutMs = this.config.get<number>('downstreamTimeoutMs')!;

    this.salesBreaker = createCircuitBreaker(
      (vin: string, correlationId: string) =>
        this.salesClient.fetchDocuments(vin, correlationId),
      { name: 'sales', timeoutMs },
    );

    this.serviceBreaker = createCircuitBreaker(
      (vin: string, correlationId: string) =>
        this.serviceClient.fetchDocuments(vin, correlationId),
      { name: 'service', timeoutMs },
    );
  }

  async searchByVin(
    vin: string,
    correlationId: string,
  ): Promise<DocumentResponseDto> {
    // Step 2 — cache lookup
    const cacheKey = `documents:${vin}`;
    const cached = await this.cacheService.get<DocumentResponseDto>(cacheKey);
    if (cached) {
      this.logger.log({ correlationId, vin }, 'Cache hit');
      return { ...cached, meta: { ...cached.meta, cacheHit: true } };
    }

    // Step 3 — concurrent fan-out via Promise.allSettled (never Promise.all)
    const start = Date.now();

    const [salesResult, serviceResult] = await Promise.allSettled([
      this.salesBreaker.fire(vin, correlationId),
      this.serviceBreaker.fire(vin, correlationId),
    ]);

    const latencyMs = Date.now() - start;

    // Step 5 — build sourceStatus
    const sourceStatus = {
      sales: salesResult.status === 'fulfilled' ? 'ok' : 'unavailable',
      service: serviceResult.status === 'fulfilled' ? 'ok' : 'unavailable',
    } as const;

    this.logger.log(
      { correlationId, vin, sourceStatus, latencyMs },
      'Fan-out complete',
    );

    // Step 6 — both failed → 502
    if (
      sourceStatus.sales === 'unavailable' &&
      sourceStatus.service === 'unavailable'
    ) {
      this.auditLogService.writeLog({
        vin,
        correlationId,
        sourceStatus,
        latencyMs,
      });
      throw new BadGatewayException('Both source systems are unavailable');
    }

    // Gather documents from successful calls
    const salesDocs: UnifiedDocument[] =
      salesResult.status === 'fulfilled'
        ? (salesResult.value as UnifiedDocument[])
        : [];
    const serviceDocs: UnifiedDocument[] =
      serviceResult.status === 'fulfilled'
        ? (serviceResult.value as UnifiedDocument[])
        : [];
    const mergedDocs = [...salesDocs, ...serviceDocs];

    // Step 7 — both succeeded but both empty → 404
    if (mergedDocs.length === 0) {
      this.auditLogService.writeLog({
        vin,
        correlationId,
        sourceStatus,
        latencyMs,
      });
      throw new NotFoundException('No documents found for this VIN');
    }

    // Step 8 — build payload, cache it, fire-and-forget audit log
    const payload: DocumentResponseDto = {
      vin,
      documents: mergedDocs,
      meta: { sourceStatus, cacheHit: false },
    };

    await this.cacheService.set(cacheKey, payload, this.cacheTtl);
    this.auditLogService.writeLog({
      vin,
      correlationId,
      sourceStatus,
      latencyMs,
    });

    return payload;
  }
}
