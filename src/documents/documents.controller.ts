import { Controller, Get, Param, Headers } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { SearchVinDto } from './dto/search-vin.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { CORRELATION_ID_HEADER } from '../common/middleware/correlation-id.middleware';

@ApiTags('documents')
@Controller('api/v1/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':vin')
  @ApiOperation({ summary: 'Retrieve all documents for a given VIN' })
  @ApiParam({
    name: 'vin',
    description: '17-character alphanumeric VIN',
    example: '1HGCR2F8XHA000001',
  })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid VIN format' })
  @ApiResponse({ status: 404, description: 'No documents found for this VIN' })
  @ApiResponse({
    status: 502,
    description: 'Both source systems are unavailable',
  })
  async getDocuments(
    @Param() params: SearchVinDto,
    @Headers(CORRELATION_ID_HEADER) incomingCorrelationId?: string,
  ): Promise<DocumentResponseDto> {
    // Correlation ID sourced from inbound header; middleware fills it if absent
    const correlationId = incomingCorrelationId ?? 'unknown';
    return this.documentsService.searchByVin(params.vin, correlationId);
  }
}
