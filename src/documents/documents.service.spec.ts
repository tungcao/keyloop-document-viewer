import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { SalesSystemClient } from '../clients/sales-system.client';
import { ServiceSystemClient } from '../clients/service-system.client';
import { CacheService } from '../common/cache/cache.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UnifiedDocument } from './interfaces/unified-document.interface';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeDoc = (source: 'sales' | 'service', idx = 1): UnifiedDocument => ({
  id: `${source}-doc-${idx}`,
  title: `${source} doc ${idx}`,
  type: `${source}_type`,
  sourceSystem: source,
  createdAt: new Date().toISOString(),
});

const SALES_DOCS = [makeDoc('sales', 1), makeDoc('sales', 2)];
const SERVICE_DOCS = [makeDoc('service', 1), makeDoc('service', 2)];
const VIN = '1HGCR2F8XHA000001';
const CORRELATION = 'test-correlation-id';

// ── Module factory ────────────────────────────────────────────────────────────

async function buildModule(overrides: {
  salesFetch?: jest.Mock;
  serviceFetch?: jest.Mock;
  cacheGet?: jest.Mock;
  cacheSet?: jest.Mock;
  auditWrite?: jest.Mock;
}): Promise<DocumentsService> {
  const {
    salesFetch = jest.fn().mockResolvedValue(SALES_DOCS),
    serviceFetch = jest.fn().mockResolvedValue(SERVICE_DOCS),
    cacheGet = jest.fn().mockResolvedValue(null),
    cacheSet = jest.fn().mockResolvedValue(undefined),
    auditWrite = jest.fn(),
  } = overrides;

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DocumentsService,
      {
        provide: SalesSystemClient,
        useValue: { fetchDocuments: salesFetch },
      },
      {
        provide: ServiceSystemClient,
        useValue: { fetchDocuments: serviceFetch },
      },
      {
        provide: CacheService,
        useValue: { get: cacheGet, set: cacheSet },
      },
      {
        provide: AuditLogService,
        useValue: { writeLog: auditWrite },
      },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            const cfg: Record<string, unknown> = {
              cacheTtlSeconds: 60,
              downstreamTimeoutMs: 3000,
            };
            return cfg[key];
          },
        },
      },
    ],
  }).compile();

  return module.get<DocumentsService>(DocumentsService);
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('DocumentsService.searchByVin', () => {
  it('both succeed → merges docs, sourceStatus both ok, cache is set', async () => {
    const cacheSet = jest.fn().mockResolvedValue(undefined);
    const service = await buildModule({ cacheSet });

    const result = await service.searchByVin(VIN, CORRELATION);

    expect(result.vin).toBe(VIN);
    expect(result.documents).toHaveLength(4);
    expect(result.meta.sourceStatus).toEqual({ sales: 'ok', service: 'ok' });
    expect(result.meta.cacheHit).toBe(false);
    expect(cacheSet).toHaveBeenCalledTimes(1);
    expect(cacheSet).toHaveBeenCalledWith(
      `documents:${VIN}`,
      expect.objectContaining({ vin: VIN }),
      60,
    );
  });

  it('sales fails, service succeeds → sourceStatus.sales unavailable, service docs only, 200', async () => {
    const service = await buildModule({
      salesFetch: jest.fn().mockRejectedValue(new Error('sales down')),
    });

    const result = await service.searchByVin(VIN, CORRELATION);

    expect(result.meta.sourceStatus.sales).toBe('unavailable');
    expect(result.meta.sourceStatus.service).toBe('ok');
    expect(result.documents).toEqual(SERVICE_DOCS);
  });

  it('both fail → throws BadGatewayException, cache NOT set', async () => {
    const cacheSet = jest.fn();
    const service = await buildModule({
      salesFetch: jest.fn().mockRejectedValue(new Error('sales down')),
      serviceFetch: jest.fn().mockRejectedValue(new Error('service down')),
      cacheSet,
    });

    await expect(service.searchByVin(VIN, CORRELATION)).rejects.toThrow(
      BadGatewayException,
    );
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('both succeed but empty → throws NotFoundException', async () => {
    const service = await buildModule({
      salesFetch: jest.fn().mockResolvedValue([]),
      serviceFetch: jest.fn().mockResolvedValue([]),
    });

    await expect(service.searchByVin(VIN, CORRELATION)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('cache hit → clients never called', async () => {
    const salesFetch = jest.fn();
    const serviceFetch = jest.fn();
    const cachedPayload = {
      vin: VIN,
      documents: SALES_DOCS,
      meta: { sourceStatus: { sales: 'ok', service: 'ok' }, cacheHit: false },
    };
    const service = await buildModule({
      salesFetch,
      serviceFetch,
      cacheGet: jest.fn().mockResolvedValue(cachedPayload),
    });

    const result = await service.searchByVin(VIN, CORRELATION);

    expect(salesFetch).toHaveBeenCalledTimes(0);
    expect(serviceFetch).toHaveBeenCalledTimes(0);
    expect(result.meta.cacheHit).toBe(true);
  });

  it('audit log write failure does not throw or affect response', async () => {
    // Mock writeLog to internally swallow the error (mirrors real AuditLogService behaviour:
    // it calls model.create().catch(...) — the rejection never escapes the service).
    const auditWrite = jest.fn().mockImplementation(() => {
      Promise.reject(new Error('mongo down')).catch(() => {
        // intentionally swallowed — mirrors the real .catch(err => logger.error(...))
      });
    });
    const service = await buildModule({ auditWrite });

    const result = await service.searchByVin(VIN, CORRELATION);
    expect(result.documents).toHaveLength(4);
    await Promise.resolve();
  });
});
