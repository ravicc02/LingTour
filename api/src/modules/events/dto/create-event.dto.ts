import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsIn,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { IsMediaLibraryPath } from '../../../common/validators/media-library.validator';
import { EVENT_STATUSES } from '../entities/event.entity';

export class CreateEventDto {
  @ApiProperty() @IsString() @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug may only contain lowercase letters, digits and dashes' })
  slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() citySlug?: string;
  @ApiProperty() @IsDateString() date: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsMediaLibraryPath()
  image?: string;
  @ApiPropertyOptional({ enum: EVENT_STATUSES })
  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  relatedRouteSlugs?: string[];
}
