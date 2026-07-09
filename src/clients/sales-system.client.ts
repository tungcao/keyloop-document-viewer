import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { UnifiedDocument } from '../documents/interfaces/unified-document.interface';

@Injectable()
export class SalesSystemClient {
  private readonly logger = new Logger(SalesSystemClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('salesApiUrl')!;
    this.timeoutMs = this.config.get<number>('downstreamTimeoutMs')!;
  }

  async fetchDocuments(
    vin: string,
    correlationId: string,
  ): Promise<UnifiedDocument[]> {
    this.logger.log(
      { correlationId, vin, source: 'sales' },
      'Fetching documents',
    );

    const response = await firstValueFrom(
      this.http
        .get<UnifiedDocument[]>(this.baseUrl, { params: { vin } })
        .pipe(timeout(this.timeoutMs)),
    );

    return response.data;
  }
}
