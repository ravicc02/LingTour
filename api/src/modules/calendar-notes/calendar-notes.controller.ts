import {
  Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode,
  Param, ParseUUIDPipe, Patch, Post, Query, Req, UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { hasRole } from '../../common/auth/roles';
import { Roles } from '../../common/decorators/roles.decorator';
import { CalendarNotesService } from './calendar-notes.service';
import { CalendarNotesQueryDto, CreateCalendarNoteDto, UpdateCalendarNoteDto } from './dto/calendar-note.dto';

type CalendarRequest = Request & { user?: { sub: string; role: string } };

@ApiTags('Private calendar notes')
@ApiBearerAuth()
@Roles('traveler')
@Controller('api/v1/account/calendar-notes')
export class CalendarNotesController {
  constructor(private readonly notes: CalendarNotesService) {}

  private owner(request: CalendarRequest): string {
    if (!request.user?.sub) throw new UnauthorizedException('A traveler session is required');
    if (!hasRole(request.user.role, 'traveler')) throw new ForbiddenException('A traveler account is required');
    return request.user.sub;
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: CalendarRequest, @Query() query: CalendarNotesQueryDto) {
    return this.notes.list(this.owner(request), query.month);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(@Req() request: CalendarRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.notes.findOne(this.owner(request), id);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: CalendarRequest, @Body() dto: CreateCalendarNoteDto) {
    return this.notes.create(this.owner(request), dto);
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  update(@Req() request: CalendarRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCalendarNoteDto) {
    return this.notes.update(this.owner(request), id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'private, no-store')
  remove(@Req() request: CalendarRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.notes.remove(this.owner(request), id);
  }
}
