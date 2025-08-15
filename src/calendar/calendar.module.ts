import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// CalendarService rămâne doar pentru referință locală; calendarul a fost mutat în microserviciu
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
  // HTTP controller eliminat: calendar este gestionat via gateway -> microserviciu
  controllers: [],
  providers: [CalendarService],
  exports: [CalendarService, TypeOrmModule],
})
export class CalendarModule {}
