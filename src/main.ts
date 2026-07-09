import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Structured logging (Pino) ──────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── Security headers (Helmet) ──────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/docs')) {
      return helmet({ contentSecurityPolicy: false, hsts: false })(
        req,
        res,
        next,
      );
    }
    return helmet({
      hsts: isProduction,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          scriptSrc: [`'self'`],
          styleSrc: [`'self'`],
          imgSrc: [`'self'`, 'data:'],
        },
      },
    })(req, res, next);
  });

  // ── Input validation ───────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Keyloop Unified Document Viewer')
    .setDescription(
      'Aggregates vehicle document metadata from Sales and Service systems. ' +
        'See README for full architecture context.',
    )
    .setVersion('1.0')
    .addTag('documents')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // ── Start ──────────────────────────────────────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error('Application failed to start:', err);
  process.exit(1);
});
