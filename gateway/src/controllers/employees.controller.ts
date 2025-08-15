import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, HttpCode } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('employees')
export class EmployeesController {
  constructor(@Inject('EMPLOYEES_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.create', dto));
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('is_active') is_active?: string,
    @Query('department') department?: string,
    @Query('contract_type') contract_type?: string,
  ) {
    return await lastValueFrom(
      this.client.send('employees.findAll', {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        is_active: is_active !== undefined ? is_active === 'true' : undefined,
        department: department ? parseInt(department, 10) : undefined,
        contract_type,
      }),
    );
  }

  @Get('statistics')
  async statistics() {
    return await lastValueFrom(this.client.send('employees.getStatistics', {}));
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    return await lastValueFrom(this.client.send('employees.findByEmail', email));
  }

  @Get('cnp/:cnp')
  async findByCNP(@Param('cnp') cnp: string) {
    return await lastValueFrom(this.client.send('employees.findByCNP', cnp));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.findOne', +id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.update', { id: +id, dto }));
  }

  @Patch(':id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.toggleActive', +id));
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.remove', +id));
  }
} 