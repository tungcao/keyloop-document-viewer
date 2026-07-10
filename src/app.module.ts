import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { MocksModule } from './mocks/mocks.module';
import { ClientsModule } from './clients/clients.module';
import { CacheModule } from './common/cache/cache.module';
import { AuditModule } from './audit/audit.module';
import { DocumentsModule } from './documents/documents.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import type { Request, Response } from 'express';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // ── Structured logging (Pino) ────────────────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        quietReqLogger: true,
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        serializers: {
          req: (req: Request) => ({ method: req.method, url: req.url }),
          res: (res: Response) => ({ statusCode: res.statusCode }),
        },
      },
    }),

    // ── MongoDB (Mongoose) ───────────────────────────────────────────────
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),

    // ── Feature modules ──────────────────────────────────────────────────
    MocksModule,
    ClientsModule,
    CacheModule,
    AuditModule,
    DocumentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
