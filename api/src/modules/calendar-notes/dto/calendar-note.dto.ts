import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidateIf,
} from 'class-validator';

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value < '0001-01-01' || value > '9999-12-31') return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export class CreateCalendarNoteDto {
  @ValidateBy({
    name: 'calendarDate',
    validator: {
      validate: isCalendarDate,
      defaultMessage: () => 'date must be a real date in YYYY-MM-DD format',
    },
  })
  date: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @IsString()
  @MaxLength(10000)
  body: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  citySlug?: string | null;
}

// Unlike IsOptional, this rejects null for required note fields on PATCH.
export class UpdateCalendarNoteDto extends PartialType(CreateCalendarNoteDto, {
  skipNullProperties: false,
}) {}

export class CalendarNotesQueryDto {
  @IsString()
  @Matches(/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/)
  month: string;
}
