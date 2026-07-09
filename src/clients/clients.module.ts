import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SalesSystemClient } from './sales-system.client';
import { ServiceSystemClient } from './service-system.client';

@Module({
  imports: [
    HttpModule, // provides HttpService; per-request timeout enforced via rxjs operator in each client
    ConfigModule,
  ],
  providers: [SalesSystemClient, ServiceSystemClient],
  exports: [SalesSystemClient, ServiceSystemClient],
})
export class ClientsModule {}
