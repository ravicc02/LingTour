import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService, type EventActor } from './events.service';
import { PublishEventDto, EventPublicationActionDto } from './dto/event-publication.dto';
import type { EventStatus } from './entities/event.entity';
import {
  AuditInterceptor as AuditLogInterceptor,
  AuditAction,
} from '../../common/interceptors/audit.interceptor';

@ApiTags('Events')
@Controller('api/v1')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Public()
  @Get('public/events')
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async listPublic(
    @Query('city') city?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.listPublic({
      city,
      startDate,
      endDate,
      page: +page,
      limit: +limit,
    });
  }

  @Public()
  @Get('public/events/calendar')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async calendar(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('city') city?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 100,
  ) {
    return this.service.listCalendar({ startDate, endDate, city, page: +page, limit: +limit });
  }

  @Public()
  @Get('public/events/:slug')
  async getPublic(@Param('slug') slug: string) {
    return this.service.getPublicBySlug(slug);
  }

  @Roles('admin', 'editor')
  @Get('admin/events')
  @ApiBearerAuth()
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async listAdmin(
    @Query('status') status?: string,
    @Query('city') city?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.listAdmin({
      status,
      city,
      startDate,
      endDate,
      page: +page,
      limit: +limit,
    });
  }

  @Roles('admin', 'editor')
  @Post('admin/events')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('create', 'event')
  async create(@Body() dto: CreateEventDto) {
    return this.service.create(dto);
  }

  @Roles('admin', 'editor')
  @Get('admin/events/:id')
  @ApiBearerAuth()
  async getAdmin(@Param('id') id: string) {
    return this.service.getAdminById(id);
  }

  @Roles('admin', 'editor')
  @Put('admin/events/:id')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('update', 'event')
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.service.update(id, dto);
  }

  @Roles('admin', 'editor')
  @Patch('admin/events/:id/status')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('update', 'event')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: EventStatus,
  ) {
    return this.service.updateStatus(id, status);
  }

  @Roles('admin', 'editor')
  @Get('admin/events/:id/publications')
  async publications(@Param('id') id: string) {
    return this.service.publications(id);
  }

  @Roles('admin', 'editor')
  @Post('admin/events/:id/publications')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('publish', 'event_publication')
  async publish(@Param('id') id: string, @Body() dto: PublishEventDto, @Req() request: { user?: EventActor }) {
    return this.service.publish(id, dto, request.user ?? {});
  }

  @Roles('admin', 'editor')
  @Post('admin/events/:id/publications/:publicationId/stop-future')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('stop_future', 'event_publication')
  async stopFuture(@Param('id') id: string, @Param('publicationId') publicationId: string,
    @Body() dto: EventPublicationActionDto, @Req() request: { user?: EventActor }) {
    return this.service.publicationAction(id, publicationId, 'stop_future', dto.reason, request.user ?? {});
  }

  @Roles('admin')
  @Post('admin/events/:id/publications/:publicationId/withdraw')
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('withdraw_history', 'event_publication')
  async withdraw(@Param('id') id: string, @Param('publicationId') publicationId: string,
    @Body() dto: EventPublicationActionDto, @Req() request: { user?: EventActor }) {
    return this.service.publicationAction(id, publicationId, 'withdraw_history', dto.reason, request.user ?? {});
  }

  @Roles('admin', 'editor')
  @Delete('admin/events/:id')
  @ApiBearerAuth()
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction('delete', 'event')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
