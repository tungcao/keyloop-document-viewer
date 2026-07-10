import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { UnifiedDocument } from '../documents/interfaces/unified-document.interface';
import { NOT_FOUND_VIN, fakeServiceDocs } from './mock-data.helper';

@ApiExcludeController()
@Controller('mock/service')
export class MockServiceController {
  @Get()
  async getServiceDocs(
    @Query('vin') vin: string,
    @Query('simulateError') simulateError?: string,
    @Query('delay') delay?: string,
  ): Promise<UnifiedDocument[]> {
    const delayMs = parseInt(delay ?? '0', 10);

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (simulateError === 'true') {
      // ASSUMPTION: same as mock-sales — throw to trigger 500.
      throw new Error('Simulated Service System error');
    }

    if (vin === NOT_FOUND_VIN) {
      return [];
    }

    return fakeServiceDocs(vin);
  }
}
