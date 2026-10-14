import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarNote } from './entities/calendar-note.entity';
import { CalendarNotesController } from './calendar-notes.controller';
import { CalendarNotesService } from './calendar-notes.service';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarNote])],
  controllers: [CalendarNotesController],
  providers: [CalendarNotesService],
})
export class CalendarNotesModule {}
