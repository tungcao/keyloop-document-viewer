import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchAuditLog, SearchAuditLogSchema } from './audit-log.schema';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SearchAuditLog.name, schema: SearchAuditLogSchema },
    ]),
  ],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
