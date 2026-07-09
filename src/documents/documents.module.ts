import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { CacheModule } from '../common/cache/cache.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [ClientsModule, CacheModule, AuditModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
