import { IsAlphanumeric, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchVinDto {
  @ApiProperty({
    description: 'Vehicle Identification Number — 17 alphanumeric characters',
    example: '1HGCR2F8XHA000001',
  })
  @IsString()
  @IsAlphanumeric()
  @Length(17, 17)
  vin!: string;
}
