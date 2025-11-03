import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ShiftChangeRequestsController } from './shift-change-requests.controller';
import { ShiftChangeRequestsService } from './shift-change-requests.service';
import { ShiftChangeRequest } from './entities/shift-change-request.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      ShiftChangeRequest,
    ]),
  ],
  controllers: [ShiftChangeRequestsController],
  providers: [ShiftChangeRequestsService],
  exports: [ShiftChangeRequestsService, TypeOrmModule],
})
export class ShiftChangeRequestsModule {}