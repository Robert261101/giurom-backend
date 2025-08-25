import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { LocationsService } from './locations/locations.service';
import { CreateWorkLocationDto } from './locations/dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './locations/dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './locations/dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './locations/dto/update-task-template-assignment.dto';

@Controller('locations')
export class LocationsHttpController {
	constructor(private readonly service: LocationsService) {}

	@Post()
	create(@Body() dto: CreateWorkLocationDto) { return this.service.createWorkLocation(dto); }

	@Get()
	findAll(
		@Query('page') page = '1',
		@Query('limit') limit = '10',
		@Query('companyId') companyId?: string,
		@Query('city') city?: string,
		@Query('search') search?: string,
	) {
		return this.service.findAllWorkLocations(parseInt(page, 10), parseInt(limit, 10), companyId ? parseInt(companyId, 10) : undefined, city, search);
	}

	@Get('statistics')
	stats() { return this.service.getLocationStatistics(); }

	@Get(':id')
	findOne(@Param('id') id: string) { return this.service.findWorkLocationById(parseInt(id, 10)); }

	@Get('company/:companyId')
	findByCompany(@Param('companyId') companyId: string) { return this.service.findWorkLocationsByCompany(parseInt(companyId, 10)); }

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateWorkLocationDto) { return this.service.updateWorkLocation(parseInt(id, 10), dto); }

	@Delete(':id')
	remove(@Param('id') id: string) { return this.service.removeWorkLocation(parseInt(id, 10)); }

	// Assignments
	@Post('assignments')
	createAssignment(@Body() dto: CreateTaskTemplateAssignmentDto) { return this.service.createTaskTemplateAssignment(dto); }

	@Get('assignments')
	findAllAssignments(
		@Query('page') page = '1',
		@Query('limit') limit = '10',
		@Query('locationId') locationId?: string,
		@Query('templateId') templateId?: string,
		@Query('active') active?: string,
	) {
		return this.service.findAllTaskTemplateAssignments(
			parseInt(page, 10),
			parseInt(limit, 10),
			locationId ? parseInt(locationId, 10) : undefined,
			templateId ? parseInt(templateId, 10) : undefined,
			active !== undefined ? active === 'true' : undefined,
		);
	}

	@Get('assignments/:id')
	findAssignment(@Param('id') id: string) { return this.service.findTaskTemplateAssignmentById(parseInt(id, 10)); }

	@Get(':locationId/assignments')
	findAssignmentsByLocation(@Param('locationId') locationId: string) { return this.service.findTaskTemplateAssignmentsByLocation(parseInt(locationId, 10)); }

	@Patch('assignments/:id')
	updateAssignment(@Param('id') id: string, @Body() dto: UpdateTaskTemplateAssignmentDto) { return this.service.updateTaskTemplateAssignment(parseInt(id, 10), dto); }

	@Patch('assignments/:id/toggle')
	toggleAssignment(@Param('id') id: string, @Query('active') active = 'true') { return this.service.toggleAssignmentStatus(parseInt(id, 10), active === 'true'); }

	@Patch('templates/:templateId/deactivate')
	deactivateTemplate(@Param('templateId') templateId: string) { return this.service.deactivateTemplateAssignments(parseInt(templateId, 10)); }

	@Delete('assignments/:id')
	removeAssignment(@Param('id') id: string) { return this.service.removeTaskTemplateAssignment(parseInt(id, 10)); }

	// Revenue points endpoints
	@Post(':id/revenue-intervals')
	setIntervals(@Param('id') id: string, @Body() body: { intervals: Array<{ min: number; max?: number | null; points: number }> }) {
		return this.service.setRevenueIntervals(parseInt(id, 10), body.intervals || []);
	}

	@Get(':id/revenue-intervals')
	getIntervals(@Param('id') id: string) {
		return this.service.getRevenueIntervals(parseInt(id, 10));
	}

	@Patch(':id/manager-percent')
	setManagerPercent(@Param('id') id: string, @Body() body: { manager_percent: number; fallback_revenue_per_point?: number }) {
		return this.service.setManagerPercent(parseInt(id, 10), body.manager_percent, body.fallback_revenue_per_point);
	}

	@Get(':id/manager-config')
	getManagerConfig(@Param('id') id: string) {
		return this.service.getManagerConfig(parseInt(id, 10));
	}

	@Post(':id/revenue')
	recordRevenue(@Param('id') id: string, @Body() body: { revenue_date: string; revenue_amount: number }) {
		return this.service.recordRevenue(parseInt(id, 10), body.revenue_date, body.revenue_amount);
	}

	@Get(':id/revenue')
	listRevenue(
		@Param('id') id: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('page') page = '1',
		@Query('limit') limit = '50',
	) {
		return this.service.listRevenue(parseInt(id, 10), { startDate, endDate, page: parseInt(page, 10), limit: parseInt(limit, 10) });
	}

	@Get(':id/manager-points')
	managerPoints(@Param('id') id: string, @Query('date') date: string) {
		return this.service.getManagerPointsForDate(parseInt(id, 10), date);
	}
}


