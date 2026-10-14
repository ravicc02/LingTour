import { Body, Controller, Get, Header, Headers, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseFilters, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { ServiceRequestsService } from './service-requests.service';
import { PrivateRequestExceptionFilter } from './private-request-exception.filter';
import type { RequestActor } from './service-requests.service';
import { AcceptRequestQuoteDto, AssignRequestDto, CreateServiceRequestDto, OfferRequestQuoteDto, ProcessRequestDto, ReadRequestMessagesDto, RequestListDto, RequestMessagesQueryDto, SendRequestMessageDto } from './dto/service-request.dto';
import type { Request } from 'express';
type AuthenticatedRequest = Request & { user: RequestActor };

@ApiTags('Service requests')
@Controller('api/v1')
export class ServicePackagesController {
  constructor(private readonly requests: ServiceRequestsService) {}
  @Public() @Get('public/service-packages')
  packages() { return this.requests.packages(); }
}

@ApiTags('Private service requests')
@ApiBearerAuth()
@UseFilters(PrivateRequestExceptionFilter)
@Controller('api/v1/account/service-requests')
export class AccountServiceRequestsController {
  constructor(private readonly requests: ServiceRequestsService) {}
  @Post() @Header('Cache-Control', 'private, no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateServiceRequestDto, @Headers('idempotency-key') key?: string) { return this.requests.create(req.user, dto, key); }
  @Get() @Header('Cache-Control', 'private, no-store')
  list(@Req() req: AuthenticatedRequest, @Query() query: RequestListDto) { return this.requests.list(req.user, query); }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  detail(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.requests.detail(req.user, id); }
  @Get(':id/messages') @Header('Cache-Control', 'private, no-store')
  messages(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Query() query: RequestMessagesQueryDto) { return this.requests.messages(req.user, id, query); }
  @Post(':id/messages') @Header('Cache-Control', 'private, no-store')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  send(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendRequestMessageDto, @Headers('idempotency-key') key?: string) { return this.requests.sendMessage(req.user, id, dto.body, key); }
  @Put(':id/messages/read') @Header('Cache-Control', 'private, no-store')
  read(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReadRequestMessagesDto) { return this.requests.readMessages(req.user, id, dto.messageId); }
  @Post(':id/quote/accept') @Header('Cache-Control', 'private, no-store')
  accept(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AcceptRequestQuoteDto) { return this.requests.acceptQuote(req.user, id, dto); }
}

@ApiTags('Service request operations')
@ApiBearerAuth()
@Roles('admin', 'editor')
@UseFilters(PrivateRequestExceptionFilter)
@Controller('api/v1/admin/service-requests')
export class AdminServiceRequestsController {
  constructor(private readonly requests: ServiceRequestsService) {}
  @Get() @Header('Cache-Control', 'private, no-store')
  list(@Req() req: AuthenticatedRequest, @Query() query: RequestListDto) { return this.requests.list(req.user, query, true); }
  @Get('staff') @Header('Cache-Control', 'private, no-store')
  staff(@Req() req: AuthenticatedRequest) { return this.requests.staffOptions(req.user); }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  detail(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.requests.detail(req.user, id, true); }
  @Patch(':id/assignment') @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(AuditInterceptor) @AuditAction('update', 'service_request_assignment')
  assign(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRequestDto) { return this.requests.assign(req.user, id, dto); }
  @Patch(':id/process') @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(AuditInterceptor) @AuditAction('update', 'service_request_process')
  process(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProcessRequestDto) { return this.requests.updateProcess(req.user, id, dto.processStatus); }
  @Post(':id/quote') @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(AuditInterceptor) @AuditAction('create', 'service_request_quote')
  quote(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferRequestQuoteDto) { return this.requests.offerQuote(req.user, id, dto); }
  @Get(':id/messages') @Header('Cache-Control', 'private, no-store')
  async messages(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Query() query: RequestMessagesQueryDto) {
    // Preserve message cursor/unread metadata through the admin axios adapter,
    // which otherwise normalizes every data-array response as a generic list.
    return { code: 200, data: await this.requests.messages(req.user, id, query, true), message: 'success' };
  }
  @Post(':id/messages') @Header('Cache-Control', 'private, no-store')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  send(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendRequestMessageDto, @Headers('idempotency-key') key?: string) { return this.requests.sendMessage(req.user, id, dto.body, key, true); }
  @Put(':id/messages/read') @Header('Cache-Control', 'private, no-store')
  read(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReadRequestMessagesDto) { return this.requests.readMessages(req.user, id, dto.messageId, true); }
}
