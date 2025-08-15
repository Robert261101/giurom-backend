import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, ParseIntPipe, ParseBoolPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('locations')
export class LocationsController {
  constructor(@Inject('LOCATIONS_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('locations.create', dto));
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: number,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return await lastValueFrom(this.client.send('locations.findAll', {
      page: page || 1,
      limit: limit || 10,
      companyId,
      city,
      search,
    }));
  }

  @Get('statistics')
  async statistics() {
    return await lastValueFrom(this.client.send('locations.statistics', {}));
  }

  @Get('company/:companyId')
  async findByCompany(@Param('companyId', ParseIntPipe) companyId: number) {
    return await lastValueFrom(this.client.send('locations.findByCompany', companyId));
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('locations.findById', id));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('locations.update', { id, dto }));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('locations.remove', id));
  }

  // Assignments
  @Post('assignments')
  async createAssignment(@Body() dto: any) {
    return await lastValueFrom(this.client.send('locations.assignments.create', dto));
  }

  @Get('assignments')
  async findAllAssignments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('locationId') locationId?: number,
    @Query('templateId') templateId?: number,
    @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
  ) {
    return await lastValueFrom(this.client.send('locations.assignments.findAll', {
      page: page || 1,
      limit: limit || 10,
      locationId,
      templateId,
      active,
    }));
  }

  @Get('assignments/location/:locationId')
  async findAssignmentsByLocation(@Param('locationId', ParseIntPipe) locationId: number) {
    return await lastValueFrom(this.client.send('locations.assignments.findByLocation', locationId));
  }

  @Get('assignments/:assignmentId')
  async findAssignmentById(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    return await lastValueFrom(this.client.send('locations.assignments.findById', assignmentId));
  }

  @Patch('assignments/:assignmentId')
  async updateAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('locations.assignments.update', { assignmentId, dto }));
  }

  @Patch('assignments/:assignmentId/toggle')
  async toggleAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number, @Body('active') active: boolean) {
    return await lastValueFrom(this.client.send('locations.assignments.toggle', { assignmentId, active }));
  }

  @Delete('assignments/:assignmentId')
  async removeAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    return await lastValueFrom(this.client.send('locations.assignments.remove', assignmentId));
  }

  @Patch('templates/:templateId/deactivate')
  async deactivateTemplateAssignments(@Param('templateId', ParseIntPipe) templateId: number) {
    return await lastValueFrom(this.client.send('locations.templates.deactivate', templateId));
  }
} 