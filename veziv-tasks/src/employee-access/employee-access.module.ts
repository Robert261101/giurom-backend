import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EmployeeAccessService } from './employee-access.service';

@Module({
  imports: [HttpModule],
  providers: [EmployeeAccessService],
  exports: [EmployeeAccessService],
})
export class EmployeeAccessModule {}
