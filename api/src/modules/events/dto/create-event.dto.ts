import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsIn,
  IsString,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaAssetDto } from '../../../common/dto/media-asset.dto';
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
  @ApiPropertyOptional({ type: [MediaAssetDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(12)
  @ValidateNested({ each: true }) @Type(() => MediaAssetDto)
  media?: MediaAssetDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240)
  slogan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000)
  extraInfo?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(-10000) @Max(10000)
  displayOrder?: number;
  @ApiPropertyOptional({ enum: EVENT_STATUSES })
  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  relatedRouteSlugs?: string[];
}
