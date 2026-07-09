import { ApiProperty } from '@nestjs/swagger';
import { UnifiedDocument } from '../interfaces/unified-document.interface';

export class SourceStatusDto {
  @ApiProperty({ enum: ['ok', 'unavailable'] })
  sales!: 'ok' | 'unavailable';

  @ApiProperty({ enum: ['ok', 'unavailable'] })
  service!: 'ok' | 'unavailable';
}

export class ResponseMetaDto {
  @ApiProperty({ type: SourceStatusDto })
  sourceStatus!: SourceStatusDto;

  @ApiProperty()
  cacheHit!: boolean;
}

export class DocumentResponseDto {
  @ApiProperty({ example: '1HGCR2F8XHA000001' })
  vin!: string;

  @ApiProperty({
    description: 'Merged documents from all available source systems',
    isArray: true,
  })
  documents!: UnifiedDocument[];

  @ApiProperty({ type: ResponseMetaDto })
  meta!: ResponseMetaDto;
}
