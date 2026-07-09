import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { UnifiedDocument } from 'src/documents/interfaces/unified-document.interface';
import { fakeSalesDocs, NOT_FOUND_VIN } from './mock-data.helper';

@ApiExcludeController()
@Controller('mock/sales')
export class MockSalesController {
  @Get()
  async getSalesDocs(
    @Query('vin') vin: string,
    @Query('simulateError') simulateError?: string,
    @Query('delay') delay?: string,
  ): Promise<UnifiedDocument[] | { error: string }> {
    const delayMs = parseInt(delay ?? '0', 10);

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (simulateError === 'true') {
      // ASSUMPTION: a 500 response from the mock is achieved by throwing,
      // which NestJS maps to 500 by default for non-HttpException errors.
      throw new Error('Simulated Sales System error');
    }

    if (vin === NOT_FOUND_VIN) {
      return [];
    }

    return fakeSalesDocs(vin);
  }
}
