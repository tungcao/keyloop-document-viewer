import { Module } from '@nestjs/common';
import { MockSalesController } from './mock-sales.controller';
import { MockServiceController } from './mock-service.controller';

@Module({
  controllers: [MockSalesController, MockServiceController],
})
export class MocksModule {}
