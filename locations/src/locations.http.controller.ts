import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, ParseIntPipe, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { Permissions } from './permissions/permissions.decorator';
import { PermissionsGuard } from './permissions/permissions.guard';
import { CreateWorkLocationDepartmentsDto } from './locations/dto/create-work-location-departments.dto';
import { LocationsService } from './locations/locations.service';
import { CreateWorkLocationDto } from './locations/dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './locations/dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './locations/dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './locations/dto/update-task-template-assignment.dto';
import { CreateWorkLocationFileDto } from './locations/dto/create-work-location-file.dto';
import { RevenueStatus } from './locations/entity/work-location-revenue.entity';
import { WorkLocation } from './locations/entity/work-location.entity';

@Controller('locations')
@UseGuards(PermissionsGuard)
export class LocationsHttpController {
	constructor(private readonly service: LocationsService) {}

	// Revenue endpoints - trebuie să fie înainte de @Post() pentru a nu fi interceptate
	@Post(':id/revenue')
	@Permissions('cashing.create')
	recordRevenue(
		@Param('id') id: string, 
		@Body() body: { revenue_date: string; online_amount: number; cash_amount: number; card_amount: number; total_amount: number; status?: RevenueStatus; image_url?: string; employee_id?: number },
		@Request() req?: any
	) {
		const user = req?.user;
		if (!user) {
			throw new Error('User not authenticated');
		}
		
		// IMPORTANT: employee_id este OBLIGATORIU
		// În JWT, sub = id_employee (vezi auth.service.ts: sub: user.id_employee)
		// Extragem ID-ul angajatului din: 
		// 1. JWT token (user.id, user.employee_id, user.userId, user.sub)
		// 2. Body (body.employee_id) - fallback dacă nu există în JWT
		const userIdFromJWT: number | undefined = user?.id || user?.employee_id || user?.userId || user?.sub;
		const userIdFromBody: number | undefined = body?.employee_id;
		const userId: number = userIdFromJWT || userIdFromBody;
		
		// Log pentru debugging
		console.log('🔍 [recordRevenue Controller] Extracting employee ID:', {
			hasUser: !!user,
			userId: userId,
			userIdFromJWT: userIdFromJWT,
			userIdFromBody: userIdFromBody,
			user_id: user?.id,
			user_employee_id: user?.employee_id,
			user_userId: user?.userId,
			user_sub: user?.sub,
			body_employee_id: body?.employee_id,
			allUserKeys: Object.keys(user)
		});
		
		if (!userId || userId === 0 || isNaN(Number(userId))) {
			console.error('❌ [recordRevenue Controller] Invalid employee ID!', {
				userId,
				userIdFromJWT,
				userIdFromBody,
				user_id: user?.id,
				user_employee_id: user?.employee_id,
				user_userId: user?.userId,
				user_sub: user?.sub,
				body_employee_id: body?.employee_id
			});
			throw new Error('Employee ID is required and must be a valid number');
		}
		
		console.log('✅ [recordRevenue Controller] Using employee_id:', userId);
		
		return this.service.recordRevenue(
			parseInt(id, 10), 
			body.revenue_date, 
			body.online_amount, 
			body.cash_amount, 
			body.card_amount, 
			body.total_amount, 
			body.status, 
			body.image_url, 
			userId
		);
	}

	@Post()
	@Permissions('locations.create')
	create(@Body() dto: CreateWorkLocationDto) { return this.service.createWorkLocation(dto); }

	@Get()
	@Permissions('locations.read')
	findAll(
		@Query('page') page = '1',
		@Query('limit') limit = '10',
		@Query('companyId') companyId?: string,
		@Query('city') city?: string,
		@Query('search') search?: string,
		@Request() req?: any,
	) {
		const user = req?.user;
		return this.service.findAllWorkLocations(
			parseInt(page, 10), 
			parseInt(limit, 10), 
			companyId ? parseInt(companyId, 10) : undefined, 
			city, 
			search,
			user
		);
	}

	/**
	 * Batch: returnează mai multe locații într-un singur request.
	 * IMPORTANT: pentru utilizatori fără `locations.read`, service-ul filtrează automat doar locațiile proprii.
	 *
	 * Ex: GET /locations/batch?ids=1,2,3
	 */
	@Get('batch')
	@Permissions('locations.read')
	findBatch(
		@Query('ids') ids: string,
		@Request() req?: any,
	): Promise<WorkLocation[]> {
		if (!ids) return Promise.resolve([]);
		const user = req?.user;
		const idList = ids
			.split(',')
			.map((id) => parseInt(id.trim(), 10))
			.filter((id) => Number.isFinite(id) && id > 0);
		if (idList.length === 0) return Promise.resolve([]);
		return this.service.findWorkLocationsByIds(idList, user);
	}

	@Get('statistics')
	@Permissions('locations.read')
	stats() { return this.service.getLocationStatistics(); }

	@Get('my/companies')
	findMyCompanies(@Request() req?: any) {
		const user = req?.user;
		return this.service.getEmployeeCompanies(user);
	}

	/** Listă departamente (limit, ids). Ruta fixă înainte de :id ca să nu fie prinsă ca id. */
	@Get('work-location-departments')
	@Permissions('locations.read')
	findWorkLocationDepartmentsList(
		@Query('limit') limit?: string,
		@Query('ids') ids?: string,
	) {
		const limitNum = limit ? parseInt(limit, 10) : 1000;
		const idList = ids ? ids.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n)) : undefined;
		return this.service.findWorkLocationDepartmentsList(limitNum, idList);
	}

	@Get('work-location-departments/:id')
	@Permissions('locations.read')
	async findWorkLocationDepartmentById(@Param('id') id: string) {
		const dept = await this.service.findWorkLocationDepartmentById(parseInt(id, 10));
		if (!dept) throw new NotFoundException('Department not found');
		return dept;
	}

	@Get(':id')
	@Permissions('locations.read')
	findOne(@Param('id') id: string, @Request() req?: any) { 
		const user = req?.user;
		return this.service.findWorkLocationById(parseInt(id, 10), user);
	}

	@Get('company/:companyId/with-documents')
	@Permissions('locations.read')
	findByCompanyWithDocuments(@Param('companyId') companyId: string) {
		return this.service.findWorkLocationsByCompanyWithDocuments(parseInt(companyId, 10));
	}

	@Get('company/:companyId')
	@Permissions('locations.read')
	findByCompany(@Param('companyId') companyId: string) { return this.service.findWorkLocationsByCompany(parseInt(companyId, 10)); }

	@Patch(':id')
	@Permissions('locations.update')
	update(@Param('id') id: string, @Body() dto: UpdateWorkLocationDto) { return this.service.updateWorkLocation(parseInt(id, 10), dto); }

	@Delete(':id')
	@Permissions('locations.delete')
	remove(@Param('id') id: string) { return this.service.removeWorkLocation(parseInt(id, 10)); }

	// Assignments
	@Post('assignments')
	@Permissions('locations.create')
	createAssignment(@Body() dto: CreateTaskTemplateAssignmentDto) { return this.service.createTaskTemplateAssignment(dto); }

	@Get('assignments')
	@Permissions('locations.read')
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
	@Permissions('locations.read')
	findAssignment(@Param('id') id: string) { return this.service.findTaskTemplateAssignmentById(parseInt(id, 10)); }

	@Get(':locationId/assignments')
	@Permissions('locations.read')
	findAssignmentsByLocation(@Param('locationId') locationId: string) { return this.service.findTaskTemplateAssignmentsByLocation(parseInt(locationId, 10)); }

	// Departments
	@Get(':locationId/departments')
	@Permissions('locations.read')
	findDepartmentsByLocation(@Param('locationId') locationId: string) { return this.service.findDepartmentsByLocation(parseInt(locationId, 10)); }

	@Post(':locationId/departments')
	@Permissions('locations.create')
	createDepartment(@Param('locationId') locationId: string, @Body() body: Omit<CreateWorkLocationDepartmentsDto, 'work_location_id'> & { work_location_id?: number }) {
		return this.service.createDepartment({
			work_location_id: body.work_location_id ?? parseInt(locationId, 10),
			name: body.name,
			code: body.code,
			description: body.description,
		});
	}

	@Get('departments/:departmentId/positions')
	@Permissions('locations.read')
	findPositions(@Param('departmentId') departmentId: string) { return this.service.findPositionsByDepartment(parseInt(departmentId, 10)); }

	@Post('departments/:departmentId/positions')
	@Permissions('locations.create')
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
	@Permissions('locations.create')
	setIntervals(@Param('id') id: string, @Body() body: { intervals: Array<{ min: number; max?: number | null; points: number }> }) {
		return this.service.setRevenueIntervals(parseInt(id, 10), body.intervals || []);
	}

	@Get(':id/revenue-intervals')
	@Permissions('locations.read')
	getIntervals(@Param('id') id: string) {
		return this.service.getRevenueIntervals(parseInt(id, 10));
	}

	@Patch(':id/manager-percent')
	@Permissions('locations.update')
	setManagerPercent(@Param('id') id: string, @Body() body: { manager_percent: number; fallback_revenue_per_point?: number }) {
		return this.service.setManagerPercent(parseInt(id, 10), body.manager_percent, body.fallback_revenue_per_point);
	}

	@Get(':id/manager-config')
	@Permissions('locations.read')
	getManagerConfig(@Param('id') id: string) {
		return this.service.getManagerConfig(parseInt(id, 10));
	}

	@Get(':id/revenue')
	@Permissions('locations.read')
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
	@Permissions('locations.read')
	managerPoints(@Param('id') id: string, @Query('date') date: string) {
		return this.service.getManagerPointsForDate(parseInt(id, 10), date);
	}

	@Delete('revenue/:revenueId')
	@Permissions('cashing.delete')
	deleteRevenue(@Param('revenueId') revenueId: string) {
		return this.service.deleteRevenue(parseInt(revenueId, 10));
	}

	@Patch('revenue/:revenueId')
	@Permissions('cashing.update')
	updateRevenue(@Param('revenueId') revenueId: string, @Body() body: { revenue_date?: string; online_amount?: number; cash_amount?: number; card_amount?: number; total_amount?: number; status?: RevenueStatus; image_url?: string }) {
		return this.service.updateRevenue(parseInt(revenueId, 10), body);
	}

	// ==================== LOCATION FILES ENDPOINTS ====================

	// List location folders by location ID
	@Get(':locationId/folders')
	@Permissions('locations.read')
	async getLocationFolders(
		@Param('locationId', ParseIntPipe) locationId: number,
	) {
		return this.service.findFoldersByLocation(locationId);
	}

	@Post(':locationId/folders')
	@Permissions('locations.create')
	async createLocationFolder(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Body() body: { description: string; parent_id?: number | null },
	) {
		return this.service.createFolder(locationId, body);
	}

	@Patch(':locationId/folders/:folderId')
	@Permissions('locations.update')
	async updateLocationFolder(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Param('folderId', ParseIntPipe) folderId: number,
		@Body() body: { description: string },
	) {
		return this.service.updateFolder(locationId, folderId, body);
	}

	@Delete(':locationId/folders/:folderId')
	@Permissions('locations.delete')
	async deleteLocationFolder(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Param('folderId', ParseIntPipe) folderId: number,
	) {
		await this.service.removeFolder(locationId, folderId);
		return { success: true };
	}

	// List location files by location ID
	@Get(':locationId/files')
	@Permissions('locations.read')
	async getLocationFiles(
		@Param('locationId', ParseIntPipe) locationId: number,
	) {
		return this.service.findFilesByLocation(locationId);
	}

	// Serve location file (download or inline based on query)
	@Get('file/:fileId')
	@Permissions('locations.read')
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
	@Permissions('locations.read')
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
	@Permissions('locations.create')
	async addLocationFile(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Body() body: Omit<CreateWorkLocationFileDto, 'work_location_id'> & { work_location_id?: number; notes?: string; folder_id?: number },
	) {
		const dto: CreateWorkLocationFileDto & { notes?: string } = {
			work_location_id: locationId,
			file_name: body.file_name,
			file_type: body.file_type,
			file_link: body.file_link,
			file_content: body.file_content,
			notes: body.notes,
			folder_id: body.folder_id,
		} as CreateWorkLocationFileDto & { notes?: string };
		return this.service.createFile(dto);
	}

	// Backwards-compatible route for document with content
	@Post(':locationId/documents-with-content')
	async addLocationDocumentWithContent(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Body() body: { documents: Array<{ fileName: string; name?: string; size?: number; content: string; type?: string; document_type?: string; note?: string; notes?: string; expire_date?: string }> },
	) {
		if (!body?.documents || body.documents.length === 0) {
			return { message: 'No documents provided' };
		}
		const first = body.documents[0];
		const fileName = first.fileName || first.name || 'document.bin';
		// Extract notes from either note or notes field
		const notes = first.notes || first.note || undefined;
		const file_link = `/files/locations/${locationId}/${fileName}`;
		return this.service.createFile({
			work_location_id: locationId,
			file_name: fileName,
			file_type: first.document_type || first.type || 'Altele',
			file_link,
			file_content: first.content,
			expire_date: first.expire_date,
			notes: notes,
		} as CreateWorkLocationFileDto & { notes?: string });
	}

	// Delete location file
	@Delete('file/:fileId')
	async deleteLocationFile(
		@Param('fileId', ParseIntPipe) fileId: number,
	) {
		return this.service.removeFile(fileId);
	}

	// Get files expiring on a specific date
	@Get('files/expiring/:targetDate')
	@Permissions('locations.read')
	getExpiringFiles(@Param('targetDate') targetDate: string) {
		console.log(`[LOCATIONS CONTROLLER] Getting files expiring on ${targetDate}`);
		return this.service.findExpiringFiles(targetDate);
	}

	// Get files that have already expired
	@Get('files/expired')
	@Permissions('locations.read')
	getExpiredFiles() {
		console.log(`[LOCATIONS CONTROLLER] Getting expired files`);
		return this.service.findExpiredFiles();
	}

	// === CASHING IMAGE UPLOAD ===
	@Post('cashing/upload-image')
	@Permissions('cashing.create')
	async uploadCashingImage(@Body() payload: { fileName: string; content: string }) {
		const imageUrl = await this.service.uploadCashingImage(payload.fileName, payload.content);
		return { imageUrl };
	}

	// === CASHING IMAGE SERVE ===
	@Get('cashing/image/:fileName')
	@Permissions('cashing.read')
	async serveCashingImage(@Param('fileName') fileName: string, @Res() res: Response) {
		const { buffer, mimeType } = await this.service.serveCashingImage(fileName);
		res.setHeader('Content-Type', mimeType);
		res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate'); // 1 oră în loc de 1 an, cu must-revalidate
		res.send(buffer);
	}

	// === CASHING IMAGE DELETE ===
	@Post('cashing/delete-image')
	@Permissions('cashing.update')
	async deleteCashingImage(@Body() payload: { imageUrl: string }) {
		await this.service.deleteCashingImage(payload.imageUrl);
		return { success: true, message: 'Imaginea a fost ștearsă cu succes' };
	}
}
