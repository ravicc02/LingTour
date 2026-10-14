import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches, MaxLength } from 'class-validator';

export class CommunityAssociationsDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100)
  citySlug?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID()
  routeId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID()
  interpreterId?: string | null;
}

/** Null removes the marker; a completed, author-owned matching booking adds it. */
export class VerifyCommunityExperienceDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID()
  bookingId?: string | null;
}
