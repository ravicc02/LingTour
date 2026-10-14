import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, MaxLength, IsOptional } from 'class-validator';

export class PublishEventDto {
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  reason?: string;
}

export class EventPublicationActionDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000)
  reason: string;
}
