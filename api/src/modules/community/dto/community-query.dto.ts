import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class CommunityQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  channel?: string;

  @ApiPropertyOptional() @IsOptional() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100)
  citySlug?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  routeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  interpreterId?: string;

  /** Legacy exact free-text filters remain supported, never inferred as IDs. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  route?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  tag?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  q?: string;
  @ApiPropertyOptional({ enum: ['latest', 'loved', 'saved'] }) @IsOptional() @IsIn(['latest', 'loved', 'saved'])
  sort?: 'latest' | 'loved' | 'saved';
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
