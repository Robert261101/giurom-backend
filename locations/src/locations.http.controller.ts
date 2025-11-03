import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { CreateWorkLocationDepartmentsDto } from './locations/dto/create-work-location-departments.dto';
import { LocationsService } from './locations/locations.service';
import { CreateWorkLocationDto } from './locations/dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './locations/dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './locations/dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './locations/dto/update-task-template-assignment.dto';
import { CreateWorkLocationFileDto } from './locations/dto/create-work-location-file.dto';
import { RevenueStatus } from './locations/entity/work-location-revenue.entity';

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

	// Departments
	@Get(':locationId/departments')
	findDepartmentsByLocation(@Param('locationId') locationId: string) { return this.service.findDepartmentsByLocation(parseInt(locationId, 10)); }

	@Post(':locationId/departments')
	createDepartment(@Param('locationId') locationId: string, @Body() body: Omit<CreateWorkLocationDepartmentsDto, 'work_location_id'> & { work_location_id?: number }) {
		return this.service.createDepartment({
			work_location_id: body.work_location_id ?? parseInt(locationId, 10),
			name: body.name,
			code: body.code,
			description: body.description,
		});
	}

	@Get('departments/:departmentId/positions')
	findPositions(@Param('departmentId') departmentId: string) { return this.service.findPositionsByDepartment(parseInt(departmentId, 10)); }

	@Post('departments/:departmentId/positions')
	createPosition(@Param('departmentId') departmentId: string, @Body() body: { name: string; code: string; description?: string }) {
		return this.service.createDepartmentPosition({ department_id: parseInt(departmentId, 10), name: body.name, code: body.code, description: body.description });
	}

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
	recordRevenue(@Param('id') id: string, @Body() body: { revenue_date: string; online_amount: number; cash_amount: number; card_amount: number; total_amount: number; status?: RevenueStatus; image_url?: string }) {
		return this.service.recordRevenue(parseInt(id, 10), body.revenue_date, body.online_amount, body.cash_amount, body.card_amount, body.total_amount, body.status, body.image_url);
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

	@Delete('revenue/:revenueId')
	deleteRevenue(@Param('revenueId') revenueId: string) {
		return this.service.deleteRevenue(parseInt(revenueId, 10));
	}

	@Patch('revenue/:revenueId')
	updateRevenue(@Param('revenueId') revenueId: string, @Body() body: { revenue_date?: string; online_amount?: number; cash_amount?: number; card_amount?: number; total_amount?: number; status?: RevenueStatus; image_url?: string }) {
		return this.service.updateRevenue(parseInt(revenueId, 10), body);
	}

	// ==================== LOCATION FILES ENDPOINTS ====================

	// List location files by location ID
	@Get(':locationId/files')
	async getLocationFiles(
		@Param('locationId', ParseIntPipe) locationId: number,
	) {
		return this.service.findFilesByLocation(locationId);
	}

	// Serve location file (download or inline based on query)
	@Get('file/:fileId')
	async getLocationFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Query('download') download: string,
		@Res() res: Response,
	) {
		const forceDownload = download === 'true';
		const served = await this.service.serveFile(fileId, forceDownload);
		const buffer = Buffer.from(served.data, 'base64');
		res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
		res.setHeader(
			'Content-Disposition',
			`${forceDownload || served.disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${served.fileName}"`
		);
		res.setHeader('Content-Length', buffer.length.toString());
		return res.send(buffer);
	}

	// Force inline view
	@Get('file/:fileId/view')
	async viewLocationFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Res() res: Response,
	) {
		try {
			console.log(`📥 [HTTP Controller] Received request to view location file ID: ${fileId}`);
			const served = await this.service.serveFile(fileId, false);
			console.log(`✅ [HTTP Controller] File served successfully, preparing response`);
			const buffer = Buffer.from(served.data, 'base64');
			res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
			res.setHeader('Content-Disposition', `inline; filename="${served.fileName}"`);
			res.setHeader('Content-Length', buffer.length.toString());
			return res.send(buffer);
		} catch (error) {
			console.error(`❌ [HTTP Controller] Error viewing file ${fileId}:`, error);
			console.error(`❌ [HTTP Controller] Error stack:`, error.stack);
			throw error;
		}
	}

	// Create location file (metadata or with base64 content)
	@Post(':locationId/files')
	async addLocationFile(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Body() body: Omit<CreateWorkLocationFileDto, 'work_location_id'> & { work_location_id?: number },
	) {
		const dto: CreateWorkLocationFileDto = {
			work_location_id: locationId,
			file_name: body.file_name,
			file_type: body.file_type,
			file_link: body.file_link,
			file_content: body.file_content,
		} as CreateWorkLocationFileDto;
		return this.service.createFile(dto);
	}

	// Backwards-compatible route for document with content
	@Post(':locationId/documents-with-content')
	async addLocationDocumentWithContent(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Body() body: { documents: Array<{ fileName: string; name?: string; size?: number; content: string; type?: string; document_type?: string; note?: string }> },
	) {
		if (!body?.documents || body.documents.length === 0) {
			return { message: 'No documents provided' };
		}
		const first = body.documents[0];
		const fileName = first.fileName || first.name || 'document.bin';
		const file_link = `/files/locations/${locationId}/${fileName}`;
		return this.service.createFile({
			work_location_id: locationId,
			file_name: fileName,
			file_type: first.document_type || first.type || 'Altele',
			file_link,
			file_content: first.content,
		} as CreateWorkLocationFileDto);
	}

	// Delete location file
	@Delete('file/:fileId')
	async deleteLocationFile(
		@Param('fileId', ParseIntPipe) fileId: number,
	) {
		return this.service.removeFile(fileId);
	}
}
