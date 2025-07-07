import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { Shift } from './entities/shift.entity';
import { Presence } from './entities/presence.entity';
import { PresenceInflexion } from './entities/presence-inflexion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shift, Presence, PresenceInflexion])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService, TypeOrmModule],
})
export class AttendanceModule {}
