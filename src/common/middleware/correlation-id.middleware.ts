import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? uuidv4();

    // Normalise: always set on the request so downstream services can read it
    req.headers[CORRELATION_ID_HEADER] = correlationId;
    // Echo back on response so clients can correlate
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
