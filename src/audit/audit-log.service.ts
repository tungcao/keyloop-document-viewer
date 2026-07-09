import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchAuditLog, AuditLogDocument } from './audit-log.schema';

export interface AuditLogPayload {
  vin: string;
  correlationId: string;
  sourceStatus: { sales: string; service: string };
  latencyMs: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(SearchAuditLog.name)
    private readonly model: Model<AuditLogDocument>,
  ) {}

  /**
   * Fire-and-forget audit write.
   * Per AGENT_SPEC §3.4: never await this before responding to the client.
   * Errors are logged but never re-thrown.
   */
  writeLog(payload: AuditLogPayload): void {
    this.model
      .create(payload)
      .catch((err: unknown) =>
        this.logger.error({ err, vin: payload.vin }, 'Audit log write failed'),
      );
  }
}
