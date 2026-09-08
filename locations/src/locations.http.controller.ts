import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, ParseIntPipe, UseGuards, Request, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
import { LocationsQuotaService } from './locations/locations-quota.service';
import { PlanFeatureGuard, RequiresPlanFeature } from './plan-access/plan-access.nest';

/** Query: include_inactive=1|true or includeInactive=true → list blocked (is_active=0) locations. */
function parseIncludeInactive(
	includeInactive?: string,
	include_inactive?: string,
): boolean {
	const raw = includeInactive ?? include_inactive;
	if (raw == null || raw === '') return false;
	const v = String(raw).toLowerCase().trim();
	return v === '1' || v === 'true' || v === 'yes';
}

@Controller('locations')
@UseGuards(PermissionsGuard)
export class LocationsHttpController {
	constructor(
		private readonly service: LocationsService,
		private readonly quotaService: LocationsQuotaService,
	) {}

	/**
	 * Internal (x-service-secret): număr locații ale unei companii, pentru usage-ul de abonament (company-ms).
	 * Declarat înaintea rutelor cu `:id` ca să nu fie interceptat.
	 */
	@Get('internal/companies/:companyId/count')
	async countCompanyLocationsInternal(
		@Param('companyId', ParseIntPipe) companyId: number,
		@Request() req?: { bypassAuth?: boolean },
	) {
		if (req?.bypassAuth !== true) {
			throw new ForbiddenException('Endpoint intern — necesită x-service-secret');
		}
		const count = await this.quotaService.countCompanyLocations(companyId);
		return { company_id: companyId, count };
	}

	@Get('internal/companies/:companyId/subscription/downgrade-preview')
	async getDowngradePreviewInternal(
		@Param('companyId', ParseIntPipe) companyId: number,
		@Query('location_limit') locationLimit: string,
		@Request() req?: { bypassAuth?: boolean },
	) {
		if (req?.bypassAuth !== true) {
			throw new ForbiddenException('Endpoint intern — necesită x-service-secret');
		}
		return this.quotaService.getDowngradePreview(
			companyId,
			Number(locationLimit),
		);
	}

	@Post('internal/companies/:companyId/subscription/apply-downgrade-blocks')
	async applyDowngradeBlocksInternal(
		@Param('companyId', ParseIntPipe) companyId: number,
		@Body()
		body: { block_location_ids?: number[]; location_limit?: number },
		@Request() req?: { bypassAuth?: boolean },
	) {
		if (req?.bypassAuth !== true) {
			throw new ForbiddenException('Endpoint intern — necesită x-service-secret');
		}
		const rollbackItems = await this.quotaService.applyDowngradeBlocks(
			companyId,
			body?.block_location_ids || [],
			Number(body?.location_limit),
		);
		return { rollback_items: rollbackItems };
	}

	@Post('internal/companies/:companyId/subscription/rollback-downgrade-blocks')
	async rollbackDowngradeBlocksInternal(
		@Param('companyId', ParseIntPipe) companyId: number,
		@Body() body: { rollback_items?: Array<{ location_id: number; previous_is_active: boolean }> },
		@Request() req?: { bypassAuth?: boolean },
	) {
		if (req?.bypassAuth !== true) {
			throw new ForbiddenException('Endpoint intern — necesită x-service-secret');
		}
		await this.quotaService.rollbackDowngradeBlocks(
			companyId,
			body?.rollback_items || [],
		);
		return { ok: true };
	}

	@Post(':id/quota/reactivate')
	@Permissions('locations.update', 'locations.create')
	async reactivateLocation(
		@Param('id', ParseIntPipe) id: number,
		@Request() req?: any,
	) {
		const companyId = Number(req?.user?.company_id);
		if (!Number.isFinite(companyId) || companyId <= 0) {
			throw new ForbiddenException('Contextul companiei lipsește din sesiune');
		}
		await this.quotaService.reactivateLocation(companyId, id);
		return { id, is_active: true };
	}

	// Revenue endpoints - trebuie să fie înainte de @Post() pentru a nu fi interceptate
	@Post(':id/revenue')
	@Permissions('cashing.create')
	@RequiresPlanFeature('incasare')
	@UseGuards(PlanFeatureGuard)
	recordRevenue(
		@Param('id') id: string, 
		@Body() body: { revenue_date: string; online_amount: number; cash_amount: number; card_amount: number; total_amount: number; status?: RevenueStatus; image_url?: string; employee_id?: number },
		@Request() req?: any
	) {
		const user = req?.user;
		if (!user) {
			throw new ForbiddenException('Utilizator neautentificat');
		}

		// SECURITATE: preferăm STRICT identitatea din JWT (sub/id/employee_id/userId) — nu avem
		// încredere în body.employee_id atunci când JWT identifică deja angajatul, pentru a preveni
		// înregistrarea unei încasări în numele altui angajat.
		// În JWT, sub = id_employee (vezi auth.service.ts: sub: user.id_employee)
		const userIdFromJWT: number | undefined =
			user?.sub || user?.id || user?.employee_id || user?.userId;
		const isAdmin = Array.isArray(user?.permissions) && user.permissions.includes('locations.read');
		// body.employee_id este acceptat DOAR ca fallback pentru conturi admin, atunci când JWT-ul
		// nu conține identitatea angajatului (ex. înregistrare în numele altcuiva de către admin).
		const userId: number | undefined =
			userIdFromJWT || (isAdmin ? body?.employee_id : undefined);

		if (!userId || userId === 0 || isNaN(Number(userId))) {
			throw new BadRequestException('Employee ID is required and must be a valid number');
		}

		return this.service.recordRevenue(
			parseInt(id, 10), 
			body.revenue_date, 
			body.online_amount, 
			body.cash_amount, 
			body.card_amount, 
			body.total_amount, 
			body.status, 
			body.image_url, 
			userId,
			user,
		);
	}

	@Post()
	@Permissions('locations.create')
	create(@Body() dto: CreateWorkLocationDto, @Request() req?: any) {
		return this.service.createWorkLocation(dto, req?.user);
	}

	@Get()
	@Permissions('locations.read')
	findAll(
		@Query('page') page = '1',
		@Query('limit') limit = '10',
		@Query('companyId') companyId?: string,
		@Query('city') city?: string,
		@Query('search') search?: string,
		@Query('includeInactive') includeInactive?: string,
		@Query('include_inactive') include_inactive?: string,
		@Request() req?: any,
	) {
		const user = req?.user;
		return this.service.findAllWorkLocations(
			parseInt(page, 10), 
			parseInt(limit, 10), 
			companyId ? parseInt(companyId, 10) : undefined, 
			city, 
			search,
			user,
			parseIncludeInactive(includeInactive, include_inactive),
		);
	}

	/**
	 * Batch: returnează mai multe locații într-un singur request.
	 * IMPORTANT: pentru utilizatori fără `locations.read`, service-ul filtrează automat doar locațiile proprii.
	 * Implicit doar active; `include_inactive=1` pentru admin / istoric batch.
	 *
	 * Ex: GET /locations/batch?ids=1,2,3
	 */
	@Get('batch')
	@Permissions('locations.read')
	findBatch(
		@Query('ids') ids: string,
		@Query('includeInactive') includeInactive?: string,
		@Query('include_inactive') include_inactive?: string,
		@Request() req?: any,
	): Promise<WorkLocation[]> {
		if (!ids) return Promise.resolve([]);
		const user = req?.user;
		const idList = ids
			.split(',')
			.map((id) => parseInt(id.trim(), 10))
			.filter((id) => Number.isFinite(id) && id > 0);
		if (idList.length === 0) return Promise.resolve([]);
		return this.service.findWorkLocationsByIds(
			idList,
			user,
			parseIncludeInactive(includeInactive, include_inactive),
		);
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
	async findWorkLocationDepartmentById(@Param('id') id: string, @Request() req?: any) {
		const dept = await this.service.findWorkLocationDepartmentById(parseInt(id, 10), req?.user);
		if (!dept) throw new NotFoundException('Department not found');
		return dept;
	}

	@Get(':id/restosoft-link-code')
	@Permissions('locations.read')
	getRestosoftLinkCode(@Param('id') id: string, @Request() req?: any) {
		const user = req?.user;
		return this.service.getRestosoftLinkCode(parseInt(id, 10), user);
	}

	@Get(':id')
	@Permissions('locations.read')
	findOne(@Param('id') id: string, @Request() req?: any) { 
		const user = req?.user;
		return this.service.findWorkLocationById(parseInt(id, 10), user);
	}

	@Get('company/:companyId/with-documents')
	@Permissions('locations.read')
	findByCompanyWithDocuments(
		@Param('companyId') companyId: string,
		@Query('includeInactive') includeInactive?: string,
		@Query('include_inactive') include_inactive?: string,
		@Request() req?: any,
	) {
		return this.service.findWorkLocationsByCompanyWithDocuments(
			parseInt(companyId, 10),
			req?.user,
			parseIncludeInactive(includeInactive, include_inactive),
		);
	}

	@Get('company/:companyId')
	@Permissions('locations.read')
	findByCompany(
		@Param('companyId') companyId: string,
		@Query('includeInactive') includeInactive?: string,
		@Query('include_inactive') include_inactive?: string,
		@Request() req?: any,
	) {
		return this.service.findWorkLocationsByCompany(
			parseInt(companyId, 10),
			req?.user,
			parseIncludeInactive(includeInactive, include_inactive),
		);
	}

	@Patch(':id')
	@Permissions('locations.update')
	update(@Param('id') id: string, @Body() dto: UpdateWorkLocationDto, @Request() req: any) {
		return this.service.updateWorkLocation(parseInt(id, 10), dto, req.user);
	}

	@Delete(':id')
	@Permissions('locations.delete')
	remove(@Param('id') id: string, @Request() req: any) {
		return this.service.removeWorkLocation(parseInt(id, 10), req.user);
	}

	// Assignments
	@Post('assignments')
	@Permissions('locations.create')
	createAssignment(@Body() dto: CreateTaskTemplateAssignmentDto, @Request() req?: any) {
		return this.service.createTaskTemplateAssignment(dto, req?.user);
	}

	@Get('assignments')
	@Permissions('locations.read')
	findAllAssignments(
		@Query('page') page = '1',
		@Query('limit') limit = '10',
		@Query('locationId') locationId?: string,
		@Query('templateId') templateId?: string,
		@Query('active') active?: string,
		@Request() req?: any,
	) {
		return this.service.findAllTaskTemplateAssignments(
			parseInt(page, 10),
			parseInt(limit, 10),
			locationId ? parseInt(locationId, 10) : undefined,
			templateId ? parseInt(templateId, 10) : undefined,
			active !== undefined ? active === 'true' : undefined,
			req?.user,
		);
	}

	@Get('assignments/:id')
	@Permissions('locations.read')
	findAssignment(@Param('id') id: string, @Request() req?: any) {
		return this.service.findTaskTemplateAssignmentById(parseInt(id, 10), req?.user);
	}

	@Get(':locationId/assignments')
	@Permissions('locations.read')
	findAssignmentsByLocation(@Param('locationId') locationId: string, @Request() req?: any) {
		return this.service.findTaskTemplateAssignmentsByLocation(parseInt(locationId, 10), req?.user);
	}

	// Departments
	@Get(':locationId/departments')
	@Permissions('locations.read')
	findDepartmentsByLocation(@Param('locationId') locationId: string, @Request() req?: any) {
		return this.service.findDepartmentsByLocation(parseInt(locationId, 10), req?.user);
	}

	@Post(':locationId/departments')
	@Permissions('locations.create')
	createDepartment(@Param('locationId') locationId: string, @Body() body: Omit<CreateWorkLocationDepartmentsDto, 'work_location_id'> & { work_location_id?: number }, @Request() req?: any) {
		return this.service.createDepartment({
			work_location_id: body.work_location_id ?? parseInt(locationId, 10),
			name: body.name,
			code: body.code,
			description: body.description,
		}, req?.user);
	}

	@Get('departments/:departmentId/positions')
	@Permissions('locations.read')
	findPositions(@Param('departmentId') departmentId: string, @Request() req?: any) {
		return this.service.findPositionsByDepartment(parseInt(departmentId, 10), req?.user);
	}

	@Post('departments/:departmentId/positions')
	@Permissions('locations.create')
	createPosition(@Param('departmentId') departmentId: string, @Body() body: { name: string; code: string; description?: string }, @Request() req?: any) {
		return this.service.createDepartmentPosition({ department_id: parseInt(departmentId, 10), name: body.name, code: body.code, description: body.description }, req?.user);
	}

	@Patch('assignments/:id')
	@Permissions('locations.update')
	updateAssignment(@Param('id') id: string, @Body() dto: UpdateTaskTemplateAssignmentDto, @Request() req?: any) {
		return this.service.updateTaskTemplateAssignment(parseInt(id, 10), dto, req?.user);
	}

	@Patch('assignments/:id/toggle')
	@Permissions('locations.update')
	toggleAssignment(@Param('id') id: string, @Query('active') active = 'true', @Request() req?: any) {
		return this.service.toggleAssignmentStatus(parseInt(id, 10), active === 'true', req?.user);
	}

	@Patch('templates/:templateId/deactivate')
	@Permissions('locations.update')
	deactivateTemplate(@Param('templateId') templateId: string, @Request() req?: any) {
		return this.service.deactivateTemplateAssignments(parseInt(templateId, 10), req?.user);
	}

	@Delete('assignments/:id')
	@Permissions('locations.delete')
	removeAssignment(@Param('id') id: string, @Request() req?: any) {
		return this.service.removeTaskTemplateAssignment(parseInt(id, 10), req?.user);
	}

	// Revenue points endpoints — configurare pe locație existentă = update, nu create
	@Post(':id/revenue-intervals')
	@Permissions('locations.update')
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
	@RequiresPlanFeature('incasare')
	@UseGuards(PlanFeatureGuard)
	deleteRevenue(@Param('revenueId') revenueId: string) {
		return this.service.deleteRevenue(parseInt(revenueId, 10));
	}

	@Patch('revenue/:revenueId')
	@Permissions('cashing.update')
	@RequiresPlanFeature('incasare')
	@UseGuards(PlanFeatureGuard)
	updateRevenue(@Param('revenueId') revenueId: string, @Body() body: { revenue_date?: string; online_amount?: number; cash_amount?: number; card_amount?: number; total_amount?: number; status?: RevenueStatus; image_url?: string }) {
		return this.service.updateRevenue(parseInt(revenueId, 10), body);
	}

	// ==================== LOCATION FILES ENDPOINTS ====================

	// List location folders by location ID
	@Get(':locationId/folders')
	@Permissions('locations.read')
	async getLocationFolders(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Request() req?: any,
	) {
		return this.service.findFoldersByLocation(locationId, req?.user);
	}

	@Post(':locationId/folders')
	@Permissions('locations.create')
	async createLocationFolder(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Body() body: { description: string; parent_id?: number | null },
		@Request() req?: any,
	) {
		return this.service.createFolder(locationId, body, req?.user);
	}

	@Patch(':locationId/folders/:folderId')
	@Permissions('locations.update')
	async updateLocationFolder(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Param('folderId', ParseIntPipe) folderId: number,
		@Body() body: { description: string },
		@Request() req?: any,
	) {
		return this.service.updateFolder(locationId, folderId, body, req?.user);
	}

	@Delete(':locationId/folders/:folderId')
	@Permissions('locations.delete')
	async deleteLocationFolder(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Param('folderId', ParseIntPipe) folderId: number,
		@Request() req?: any,
	) {
		await this.service.removeFolder(locationId, folderId, req?.user);
		return { success: true };
	}

	// List location files by location ID
	@Get(':locationId/files')
	@Permissions('locations.read')
	async getLocationFiles(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Request() req?: any,
	) {
		return this.service.findFilesByLocation(locationId, req?.user);
	}

	// Serve location file (download or inline based on query)
	@Get('file/:fileId')
	@Permissions('locations.read')
	async getLocationFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Query('download') download: string,
		@Res() res: Response,
		@Request() req?: any,
	) {
		const forceDownload = download === 'true';
		const served = await this.service.serveFile(fileId, forceDownload, req?.user);
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
		@Request() req?: any,
	) {
		try {
			console.log(`📥 [HTTP Controller] Received request to view location file ID: ${fileId}`);
			const served = await this.service.serveFile(fileId, false, req?.user);
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
		@Request() req?: any,
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
		return this.service.createFile(dto, req?.user);
	}

	// Backwards-compatible route for document with content
	@Post(':locationId/documents-with-content')
	@Permissions('locations.create')
	async addLocationDocumentWithContent(
		@Param('locationId', ParseIntPipe) locationId: number,
		@Body() body: { documents: Array<{ fileName: string; name?: string; size?: number; content: string; type?: string; document_type?: string; note?: string; notes?: string; expire_date?: string }> },
		@Request() req?: any,
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
		} as CreateWorkLocationFileDto & { notes?: string }, req?.user);
	}

	// Delete location file
	@Delete('file/:fileId')
	@Permissions('locations.delete')
	async deleteLocationFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Request() req?: any,
	) {
		return this.service.removeFile(fileId, req?.user);
	}

	// Get files expiring on a specific date
	@Get('files/expiring/:targetDate')
	@Permissions('locations.read')
	getExpiringFiles(@Param('targetDate') targetDate: string, @Request() req?: any) {
		console.log(`[LOCATIONS CONTROLLER] Getting files expiring on ${targetDate}`);
		return this.service.findExpiringFiles(targetDate, req?.user);
	}

	// Get files that have already expired
	@Get('files/expired')
	@Permissions('locations.read')
	getExpiredFiles(@Request() req?: any) {
		console.log(`[LOCATIONS CONTROLLER] Getting expired files`);
		return this.service.findExpiredFiles(req?.user);
	}

	// === CASHING IMAGE UPLOAD ===
	@Post('cashing/upload-image')
	@Permissions('cashing.create')
	@RequiresPlanFeature('incasare')
	@UseGuards(PlanFeatureGuard)
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
	@RequiresPlanFeature('incasare')
	@UseGuards(PlanFeatureGuard)
	async deleteCashingImage(@Body() payload: { imageUrl: string }) {
		await this.service.deleteCashingImage(payload.imageUrl);
		return { success: true, message: 'Imaginea a fost ștearsă cu succes' };
	}
}
