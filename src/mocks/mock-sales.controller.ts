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

function fakeSalesDocs(vin: string): MockDocument[] {
  return [
    {
      id: `sales-${vin}-1`,
      title: `Sales Order #SO-${vin.slice(-4)}`,
      type: 'sales_order',
      sourceSystem: 'sales',
      createdAt: new Date().toISOString(),
    },
    {
      id: `sales-${vin}-2`,
      title: `Finance Agreement #FA-${vin.slice(-4)}`,
      type: 'finance_agreement',
      sourceSystem: 'sales',
      createdAt: new Date().toISOString(),
    },
  ];
}

@ApiExcludeController()
@Controller('mock/sales')
export class MockSalesController {
  @Get()
  async getSalesDocs(
    @Query('vin') vin: string,
    @Query('simulateError') simulateError?: string,
    @Query('delay') delay?: string,
  ): Promise<MockDocument[] | { error: string }> {
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
