import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('employee-work-location-history')
export class WorkLocationHistoryController {
  constructor(@Inject('EMPLOYEES_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.workhistory.create', dto));
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('employee_id') employee_id?: string,
    @Query('work_location_id') work_location_id?: string,
  ) {
    return await lastValueFrom(
      this.client.send('employees.workhistory.findAll', {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        employee_id: employee_id ? parseInt(employee_id, 10) : undefined,
        work_location_id: work_location_id ? parseInt(work_location_id, 10) : undefined,
      }),
    );
  }

  @Get('statistics')
  async statistics() {
    return await lastValueFrom(this.client.send('employees.workhistory.statistics', {}));
  }

  @Get('employee/:employee_id')
  async findByEmployee(@Param('employee_id') employee_id: string) {
    return await lastValueFrom(this.client.send('employees.workhistory.findByEmployee', +employee_id));
  }

  @Get('work-location/:work_location_id')
  async findByWorkLocation(@Param('work_location_id') work_location_id: string) {
    return await lastValueFrom(this.client.send('employees.workhistory.findByWorkLocation', +work_location_id));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.workhistory.findOne', +id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.workhistory.update', { id: +id, dto }));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.workhistory.remove', +id));
  }
} 