import { INTERPRETATION_PACKAGES } from '../interpretation-packages';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
  IsBoolean,
  IsUUID,
  IsIn,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsString()
  @MaxLength(300)
  contact: string;

  @ApiProperty({ example: 'Zhanjiang' })
  @IsString()
  @MaxLength(200)
  city: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  serviceDate: string;

  @ApiProperty({ example: 'Story route guided support' })
  @IsString()
  @MaxLength(200)
  supportMode: string;

  /**
   * P2-8: when provided, the deposit is priced from this CMS service mode's
   * configured depositCents (falling back to the keyword heuristic when the
   * mode has no deposit configured). Unknown ids are rejected.
   */
  @ApiPropertyOptional({
    example: 'b1c2d3e4-1111-4222-8333-444455556666',
    description: 'CMS service mode the booking refers to',
  })
  @IsOptional()
  @IsUUID('4')
  serviceModeId?: string;

  @ApiPropertyOptional({ example: 'fixed-4h', description: 'Server-priced USD interpretation package' })
  @IsOptional()
  @IsIn(INTERPRETATION_PACKAGES.map((item) => item.id))
  packageId?: string;

  @ApiPropertyOptional({ example: '1-2' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  groupSize?: string;

  @ApiPropertyOptional({ example: 'Interested in the seafood route...' })
  @IsOptional()
  @IsString()
  routeOrNeed?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  fastTrack?: boolean;
}
