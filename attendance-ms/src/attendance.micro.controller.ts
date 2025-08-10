import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AttendanceService } from '@/attendance/attendance.service';
import { CreateShiftDto } from '@/attendance/dto/create-shift.dto';
import { UpdateShiftDto } from '@/attendance/dto/update-shift.dto';
import { CreatePresenceDto } from '@/attendance/dto/create-presence.dto';
import { UpdatePresenceDto } from '@/attendance/dto/update-presence.dto';
import { CreatePresenceInflexionDto } from '@/attendance/dto/create-presence-inflexion.dto';
import { UpdatePresenceInflexionDto } from '@/attendance/dto/update-presence-inflexion.dto';

@Controller()
export class AttendanceMicroController {
  constructor(private readonly service: AttendanceService) {}

  // Shifts
  @MessagePattern('attendance.shifts.create')
  createShift(@Payload() dto: CreateShiftDto) {
    return this.service.createShift(dto);
  }

  @MessagePattern('attendance.shifts.findAll')
  findAllShifts(@Payload() payload: { page?: number; limit?: number; employee_id?: number; work_location_id?: number; department_id?: number }) {
    return this.service.findAllShifts(payload.page || 1, payload.limit || 10, payload.employee_id, payload.work_location_id, payload.department_id);
  }

  @MessagePattern('attendance.shifts.findOne')
  findShift(@Payload() id: number) {
    return this.service.findShiftById(id);
  }

  @MessagePattern('attendance.shifts.update')
  updateShift(@Payload() payload: { id: number; dto: UpdateShiftDto }) {
    return this.service.updateShift(payload.id, payload.dto);
  }

  @MessagePattern('attendance.shifts.delete')
  deleteShift(@Payload() id: number) {
    return this.service.deleteShift(id);
  }

  // Presences
  @MessagePattern('attendance.presences.create')
  createPresence(@Payload() dto: CreatePresenceDto) {
    return this.service.createPresence(dto);
  }

  @MessagePattern('attendance.presences.findAll')
  findAllPresences(@Payload() payload: { page?: number; limit?: number; shift_id?: number; status?: string; start_date?: string; end_date?: string }) {
    return this.service.findAllPresences(payload.page || 1, payload.limit || 10, payload.shift_id, payload.status as any, payload.start_date, payload.end_date);
  }

  @MessagePattern('attendance.presences.findOne')
  findPresence(@Payload() id: number) {
    return this.service.findPresenceById(id);
  }

  @MessagePattern('attendance.presences.update')
  updatePresence(@Payload() payload: { id: number; dto: UpdatePresenceDto }) {
    return this.service.updatePresence(payload.id, payload.dto);
  }

  @MessagePattern('attendance.presences.delete')
  deletePresence(@Payload() id: number) {
    return this.service.deletePresence(id);
  }

  // Inflexions
  @MessagePattern('attendance.inflexions.create')
  createInflexion(@Payload() dto: CreatePresenceInflexionDto) {
    return this.service.createPresenceInflexion(dto);
  }

  @MessagePattern('attendance.inflexions.findAll')
  findAllInflexions(@Payload() payload: { page?: number; limit?: number; presence_id?: number; type?: string }) {
    return this.service.findAllPresenceInflexions(payload.page || 1, payload.limit || 10, payload.presence_id, payload.type as any);
  }

  @MessagePattern('attendance.inflexions.findOne')
  findInflexion(@Payload() id: number) {
    return this.service.findPresenceInflexionById(id);
  }

  @MessagePattern('attendance.inflexions.update')
  updateInflexion(@Payload() payload: { id: number; dto: UpdatePresenceInflexionDto }) {
    return this.service.updatePresenceInflexion(payload.id, payload.dto);
  }

  @MessagePattern('attendance.inflexions.delete')
  deleteInflexion(@Payload() id: number) {
    return this.service.deletePresenceInflexion(id);
  }

  // Stats
  @MessagePattern('attendance.statistics')
  statistics(@Payload() payload: { employee_id?: number; start_date?: string; end_date?: string }) {
    return this.service.getAttendanceStatistics(payload.employee_id, payload.start_date, payload.end_date);
  }
}


