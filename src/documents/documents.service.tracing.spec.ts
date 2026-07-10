import { SpanStatusCode } from '@opentelemetry/api';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { SalesSystemClient } from '../clients/sales-system.client';
import { ServiceSystemClient } from '../clients/service-system.client';
import { CacheService } from '../common/cache/cache.service';
import { AuditLogService } from '../audit/audit-log.service';
// memoryExporter is wired into `provider` inside tracing.ts (only when
// NODE_ENV=test) — SDK v2's NodeTracerProvider no longer exposes
// addSpanProcessor() after construction, so it must be configured there,
// not here. See AI_NOTES.md for the debugging trail on this.
import { provider, memoryExporter } from '../telemetry/tracing';
import { UnifiedDocument } from './interfaces/unified-document.interface';

// NOTE: buildModule/makeDoc/VIN/CORRELATION duplicate documents.service.spec.ts.

const makeDoc = (source: 'sales' | 'service', idx = 1): UnifiedDocument => ({
  id: `${source}-doc-${idx}`,
  title: `${source} doc ${idx}`,
  type: `${source}_type`,
  sourceSystem: source,
  createdAt: new Date().toISOString(),
});

const VIN = '1HGCR2F8XHA000001';
const CORRELATION = 'test-correlation-id';

async function buildModule(overrides: {
  salesFetch?: jest.Mock;
  serviceFetch?: jest.Mock;
  cacheGet?: jest.Mock;
}): Promise<DocumentsService> {
  const {
    salesFetch = jest.fn().mockResolvedValue([makeDoc('sales')]),
    serviceFetch = jest.fn().mockResolvedValue([makeDoc('service')]),
    cacheGet = jest.fn().mockResolvedValue(null),
  } = overrides;

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DocumentsService,
      { provide: SalesSystemClient, useValue: { fetchDocuments: salesFetch } },
      {
        provide: ServiceSystemClient,
        useValue: { fetchDocuments: serviceFetch },
      },
      {
        provide: CacheService,
        useValue: {
          get: cacheGet,
          set: jest.fn().mockResolvedValue(undefined),
        },
      },
      { provide: AuditLogService, useValue: { writeLog: jest.fn() } },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) =>
            ({ cacheTtlSeconds: 60, downstreamTimeoutMs: 3000 })[key],
        },
      },
    ],
  }).compile();

  return module.get<DocumentsService>(DocumentsService);
}

describe('DocumentsService — OpenTelemetry tracing', () => {
  beforeEach(() => memoryExporter.reset());

  it('creates a root span and two child spans, correctly linked', async () => {
    const service = await buildModule({});
    await service.searchByVin(VIN, CORRELATION);
    await provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    const root = spans.find((s) => s.name === 'documents.searchByVin');
    const salesSpan = spans.find((s) => s.name === 'sales-system-call');
    const serviceSpan = spans.find((s) => s.name === 'service-system-call');

    expect(root).toBeDefined();
    expect(salesSpan).toBeDefined();
    expect(serviceSpan).toBeDefined();

    // Same trace, both children point back to the root span
    expect(salesSpan!.spanContext().traceId).toBe(root!.spanContext().traceId);
    expect(serviceSpan!.spanContext().traceId).toBe(
      root!.spanContext().traceId,
    );
    expect(salesSpan!.parentSpanContext?.spanId).toBe(
      root!.spanContext().spanId,
    );
    expect(serviceSpan!.parentSpanContext?.spanId).toBe(
      root!.spanContext().spanId,
    );

    expect(root!.attributes.vin).toBe(VIN);
    expect(root!.attributes.correlationId).toBe(CORRELATION);
    expect(root!.attributes['cache.hit']).toBe(false);
  });

  it('marks the failing downstream child span as ERROR, the other as OK', async () => {
    const service = await buildModule({
      salesFetch: jest.fn().mockRejectedValue(new Error('sales down')),
    });
    await service.searchByVin(VIN, CORRELATION);
    await provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    const salesSpan = spans.find((s) => s.name === 'sales-system-call');
    const serviceSpan = spans.find((s) => s.name === 'service-system-call');

    expect(salesSpan!.status.code).toBe(SpanStatusCode.ERROR);
    expect(serviceSpan!.status.code).toBe(SpanStatusCode.OK);
  });

  it('records no child spans on cache hit, and flags cache.hit=true on the root span', async () => {
    const cachedPayload = {
      vin: VIN,
      documents: [makeDoc('sales')],
      meta: { sourceStatus: { sales: 'ok', service: 'ok' }, cacheHit: false },
    };
    const service = await buildModule({
      cacheGet: jest.fn().mockResolvedValue(cachedPayload),
    });

    await service.searchByVin(VIN, CORRELATION);
    await provider.forceFlush();

    const spans = memoryExporter.getFinishedSpans();
    const root = spans.find((s) => s.name === 'documents.searchByVin');
    const childSpans = spans.filter((s) => s.name !== 'documents.searchByVin');

    expect(root!.attributes['cache.hit']).toBe(true);
    expect(childSpans).toHaveLength(0);
  });
});
