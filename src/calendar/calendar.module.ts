import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarEvent } from './entities/calendar-event.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import { Employee } from '../employee/entity/employee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarEvent,
      RecurrenceRule,
      Employee,
    ]),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService, TypeOrmModule],
})
export class CalendarModule {}
