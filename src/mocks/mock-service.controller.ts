import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

interface MockDocument {
  id: string;
  title: string;
  type: string;
  sourceSystem: 'sales' | 'service';
  createdAt: string;
}

const NOT_FOUND_VIN = '00000000000000000';

function fakeServiceDocs(vin: string): MockDocument[] {
  return [
    {
      id: `service-${vin}-1`,
      title: `Workshop Job Card #WJC-${vin.slice(-4)}`,
      type: 'job_card',
      sourceSystem: 'service',
      createdAt: new Date().toISOString(),
    },
    {
      id: `service-${vin}-2`,
      title: `Warranty Claim #WC-${vin.slice(-4)}`,
      type: 'warranty_claim',
      sourceSystem: 'service',
      createdAt: new Date().toISOString(),
    },
  ];
}

@ApiExcludeController()
@Controller('mock/service')
export class MockServiceController {
  @Get()
  async getServiceDocs(
    @Query('vin') vin: string,
    @Query('simulateError') simulateError?: string,
    @Query('delay') delay?: string,
  ): Promise<MockDocument[] | { error: string }> {
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
