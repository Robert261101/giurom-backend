import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftChangeRequestsController } from './shift-change-requests.controller';
import { ShiftChangeRequestsService } from './shift-change-requests.service';
import { ShiftChangeRequest } from './entities/shift-change-request.entity';
import { Employee } from '../employee/entities/employee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftChangeRequest,
      Employee,
    ]),
  ],
  controllers: [ShiftChangeRequestsController],
  providers: [ShiftChangeRequestsService],
  exports: [ShiftChangeRequestsService, TypeOrmModule],
})
export class ShiftChangeRequestsModule {}