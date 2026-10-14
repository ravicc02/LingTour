import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PROCESS_STATUSES, SERVICE_TYPES } from '../service-packages';
import type { ProcessStatus, ServiceType } from '../service-packages';

export class RequestPreferencesDto {
  @IsOptional() @IsInt() @Min(1) @Max(60) days?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(200, { each: true }) interests?: string[];
  @IsOptional() @IsString() @MaxLength(1000) foodPreferences?: string;
  @IsOptional() @IsString() @MaxLength(1000) accommodation?: string;
  @IsOptional() @IsString() @MaxLength(500) budget?: string;
  @IsOptional() @IsString() @Matches(/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/) budgetAmount?: string;
  @IsOptional() @IsIn(['USD', 'CNY', 'SGD']) budgetCurrency?: 'USD' | 'CNY' | 'SGD';
  @IsOptional() @IsString() @MaxLength(1000) serviceContext?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
export class CreateServiceRequestDto {
  @IsIn(SERVICE_TYPES) serviceType: ServiceType;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) citySlug: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsInt() @Min(1) @Max(100) groupSize: number;
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsString() @IsNotEmpty() @MaxLength(300) contact: string;
  @IsOptional() @IsIn(['fixed4', 'fixed5', 'fixed7', 'custom4', 'custom5', 'custom7']) packageId?: string;
  @IsOptional() @IsUUID() preferredInterpreterId?: string;
  @IsOptional() @IsUUID() linkedRequestId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) languagePair?: string;
  @IsOptional() @ValidateNested() @Type(() => RequestPreferencesDto) preferences?: RequestPreferencesDto;
}
export class RequestListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) size = 20;
  @IsOptional() @IsIn(SERVICE_TYPES) serviceType?: ServiceType;
  @IsOptional() @IsIn(PROCESS_STATUSES) processStatus?: ProcessStatus;
  @IsOptional() @IsString() @MaxLength(100) citySlug?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
}
export class AssignRequestDto {
  @IsUUID() plannerId: string;
  @IsOptional() @IsUUID() interpreterId?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
export class ProcessRequestDto {
  @IsIn(PROCESS_STATUSES) processStatus: ProcessStatus;
}
export class SendRequestMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(4000) body: string;
}
export class ReadRequestMessagesDto {
  @IsUUID() messageId: string;
}
export class RequestMessagesQueryDto {
  @IsOptional() @IsUUID() after?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) size = 50;
}
export class OfferRequestQuoteDto {
  @IsInt() @Min(1) @Max(2147483647) amountCents: number;
  @IsString() @IsNotEmpty() @MaxLength(4000) scope: string;
  // Optimistic version avoids silently overwriting another staff offer.
  @IsInt() @Min(0) expectedRevision: number;
}
export class AcceptRequestQuoteDto {
  @IsUUID() quoteId: string;
  @IsInt() @Min(1) revision: number;
}
