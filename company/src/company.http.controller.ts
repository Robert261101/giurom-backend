import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, ParseIntPipe, UseGuards, Headers } from '@nestjs/common';
import { Response } from 'express';
import { Permissions } from './permissions/permissions.decorator';
import { CompanyService } from './company/company.service';
import { CreateCompanyDto } from './company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from './company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './company/dto/update-company-document.dto';
import { Company } from './company/entity/company.entity';
import { InternalServiceGuard } from './auth/internal-service.guard';

@Controller('companies')
export class CompanyHttpController {
	constructor(private readonly service: CompanyService) {}

	@Post()
	@Permissions('companies.create')
	create(@Body() dto: CreateCompanyDto, @Headers('x-work-location-id') xWorkLocationId?: string) {
		const work_location_id = xWorkLocationId != null ? parseInt(xWorkLocationId, 10) : undefined;
		return this.service.createCompany(dto, Number.isFinite(work_location_id) ? work_location_id : undefined);
	}

	@Post('with-documents')
	@Permissions('companies.create')
	createWithDocs(@Body() dto: CreateCompanyWithDocumentsDto) { return this.service.createCompanyWithDocuments(dto); }

	@Get()
	@Permissions('companies.read')
	findAll(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search?: string, @Query('status') status?: string) {
		return this.service.findAllCompanies(parseInt(page, 10), parseInt(limit, 10), search, status);
	}

	@Get('batch')
	@UseGuards(InternalServiceGuard) // Folosit pentru apeluri interne între microservicii
	@Permissions('companies.read')
	findBatch(
		@Query('ids') ids: string,
	): Promise<Array<Pick<Company, 'id' | 'company_name'>>> {
		if (!ids) {
			return Promise.resolve([]);
		}

		const idList = ids
			.split(',')
			.map((id) => parseInt(id.trim(), 10))
			.filter((id) => Number.isFinite(id));

		if (idList.length === 0) {
			return Promise.resolve([]);
		}

		return this.service.findByIdsBasic(idList);
	}

	@Get('internal/furnizor-dropdown')
	@UseGuards(InternalServiceGuard)
	findFurnizorDropdownForRegistration() {
		return this.service.findFurnizorCompaniesForRegistration();
	}

	@Get('for-own')
	@Permissions('companies.read_own')
	findForOwn() {
		return this.service.findForOwn();
	}

	@Get('statistics')
	@Permissions('companies.read')
	stats() { return this.service.getCompanyStatistics(); }

	@Get(':id/name')
	@Permissions('companies.read_own')
	findNameById(@Param('id') id: string) { 
		return this.service.findNameById(parseInt(id, 10)); 
	}

	@Get(':id')
	@Permissions('companies.read')
	findOne(@Param('id') id: string) { return this.service.findCompanyById(parseInt(id, 10)); }

	@Get('cui/:cui')
	@Permissions('companies.read')
	findByCui(@Param('cui') cui: string) { return this.service.findCompanyByCui(cui); }

	@Patch(':id')
	@Permissions('companies.update')
	update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @Headers('x-work-location-id') xWorkLocationId?: string) {
		const work_location_id = xWorkLocationId != null ? parseInt(xWorkLocationId, 10) : undefined;
		return this.service.updateCompany(parseInt(id, 10), dto, Number.isFinite(work_location_id) ? work_location_id : undefined);
	}

	@Delete(':id')
	@Permissions('companies.delete')
	remove(@Param('id') id: string, @Headers('x-work-location-id') xWorkLocationId?: string) {
		const work_location_id = xWorkLocationId != null ? parseInt(xWorkLocationId, 10) : undefined;
		return this.service.removeCompany(parseInt(id, 10), Number.isFinite(work_location_id) ? work_location_id : undefined);
	}

	// Documents
	@Get(':companyId/documents')
	@Permissions('companies.read')
	getDocs(@Param('companyId') companyId: string) { 
		console.log(`[COMPANY CONTROLLER] Getting documents for company ${companyId}`);
		return this.service.findCompanyDocuments(parseInt(companyId, 10)); 
	}

	@Get(':companyId/documents/folders')
	@Permissions('companies.read')
	getCompanyFolders(@Param('companyId') companyId: string) {
		console.log(`[COMPANY CONTROLLER] Getting folders for company ${companyId}`);
		return this.service.getCompanyFolders(parseInt(companyId, 10));
	}

	@Post(':companyId/documents/folders')
	@Permissions('companies.create')
	async createCompanyFolder(@Param('companyId') companyId: string, @Body() body: { folder: string }) {
		await this.service.createCompanyFolder(parseInt(companyId, 10), body?.folder ?? '');
	}

	@Delete(':companyId/documents/folders')
	@Permissions('companies.delete')
	async deleteCompanyFolder(@Param('companyId') companyId: string, @Query('folder') folder: string) {
		await this.service.deleteCompanyFolder(parseInt(companyId, 10), folder ?? '');
	}

	@Get(':companyId/documents/structure')
	@Permissions('companies.read')
	getCompanyFileStructure(@Param('companyId') companyId: string) {
		console.log(`[COMPANY CONTROLLER] Getting file structure for company ${companyId}`);
		return this.service.getCompanyFileStructure(parseInt(companyId, 10));
	}

	@Get(':companyId/documents/folder-files')
	@Permissions('companies.read')
	getFilesFromFolder(
		@Param('companyId') companyId: string,
		@Query('path') folderPath: string
	) {
		console.log(`[COMPANY CONTROLLER] Getting files from folder ${folderPath} for company ${companyId}`);
		return this.service.getFilesFromFolder(parseInt(companyId, 10), folderPath);
	}

	@Get(':companyId/documents/file')
	@Permissions('companies.read')
	async serveFileFromPath(
		@Param('companyId') companyId: string,
		@Query('path') filePath: string,
		@Query('download') download: string,
		@Res() res: Response,
	) {
		try {
			console.log(`[COMPANY CONTROLLER] Serving file from path ${filePath} for company ${companyId}, download: ${download}`);
			const forceDownload = download === 'true';
			const served = await this.service.serveFileFromPath(parseInt(companyId, 10), filePath, forceDownload);
			const buffer = Buffer.from(served.data, 'base64');
			res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
			res.setHeader(
				'Content-Disposition',
				`${forceDownload || served.disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${served.fileName}"`
			);
			res.setHeader('Content-Length', buffer.length.toString());
			return res.send(buffer);
		} catch (error) {
			console.error(`[COMPANY CONTROLLER] Error serving file from path:`, error);
			if (error instanceof Error && error.message.includes('nu a fost găsit')) {
				return res.status(404).json({ error: 'File not found' });
			}
			return res.status(500).json({ error: 'Internal server error' });
		}
	}

	@Get(':companyId/documents/folder/:folder')
	@Permissions('companies.read')
	getDocsByFolder(@Param('companyId') companyId: string, @Param('folder') folder: string) {
		console.log(`[COMPANY CONTROLLER] Getting documents for company ${companyId} in folder ${folder}`);
		return this.service.findCompanyDocumentsByFolder(parseInt(companyId, 10), folder);
	}

	@Get('documents/:documentId/info')
	@Permissions('companies.read')
	getDoc(@Param('documentId') documentId: string) { 
		console.log(`[COMPANY CONTROLLER] Getting document info for ID ${documentId}`);
		return this.service.findDocumentById(parseInt(documentId, 10)); 
	}

	@Post(':companyId/documents')
	@Permissions('companies.create')
	createDoc(@Param('companyId') companyId: string, @Body() dto: CreateCompanyDocumentDto & { file_content?: string; expire_date?: string }) {
		console.log(`[COMPANY CONTROLLER] Creating document for company ${companyId}`);
		return this.service.createCompanyDocument({ ...(dto as any), company_id: parseInt(companyId, 10) });
	}

	@Patch('documents/:documentId')
	@Permissions('companies.update')
	updateDoc(@Param('documentId') documentId: string, @Body() dto: UpdateCompanyDocumentDto) {
		console.log(`[COMPANY CONTROLLER] Updating document ${documentId}`);
		return this.service.updateCompanyDocument(parseInt(documentId, 10), dto);
	}

	@Delete('documents/:documentId')
	@Permissions('companies.delete')
	removeDoc(@Param('documentId') documentId: string) { 
		console.log(`[COMPANY CONTROLLER] Deleting document ${documentId}`);
		return this.service.removeCompanyDocument(parseInt(documentId, 10)); 
	}

	// Get documents expiring on a specific date
	@Get('documents/expiring/:targetDate')
	@Permissions('companies.read')
	getExpiringDocuments(@Param('targetDate') targetDate: string) {
		console.log(`[COMPANY CONTROLLER] Getting documents expiring on ${targetDate}`);
		return this.service.findExpiringDocuments(targetDate);
	}

	// Get documents that have already expired
	@Get('documents/expired')
	@Permissions('companies.read')
	getExpiredDocuments() {
		console.log(`[COMPANY CONTROLLER] Getting expired documents`);
		return this.service.findExpiredDocuments();
	}

	// Serve company file (download or inline based on query)
	@Get('documents/:fileId')
	@Permissions('companies.read')
	async getCompanyFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Query('download') download: string,
		@Res() res: Response,
	) {
		try {
			console.log(`[COMPANY CONTROLLER] Serving company file ${fileId}, download: ${download}`);
			const forceDownload = download === 'true';
			const served = await this.service.serveCompanyFile(fileId, forceDownload);
			const buffer = Buffer.from(served.data, 'base64');
			console.log(`[COMPANY CONTROLLER] Sending file ${served.fileName} with type ${served.mimeType}`);
			res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
			res.setHeader(
				'Content-Disposition',
				`${forceDownload || served.disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${served.fileName}"`
			);
			res.setHeader('Content-Length', buffer.length.toString());
			return res.send(buffer);
		} catch (error) {
			console.error(`[COMPANY CONTROLLER] Error serving company file ${fileId}:`, error);
			if (error instanceof Error && error.message.includes('nu a fost găsit')) {
				return res.status(404).json({ error: 'File not found' });
			}
			return res.status(500).json({ error: 'Internal server error' });
		}
	}

	// Force inline view
	@Get('documents/:fileId/view')
	@Permissions('companies.read')
	async viewCompanyFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Res() res: Response,
	) {
		try {
			console.log(`[COMPANY CONTROLLER] Viewing company file ${fileId} inline`);
			const served = await this.service.serveCompanyFile(fileId, false);
			const buffer = Buffer.from(served.data, 'base64');
			console.log(`[COMPANY CONTROLLER] Sending file ${served.fileName} for inline view with type ${served.mimeType}`);
			res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
			res.setHeader('Content-Disposition', `inline; filename="${served.fileName}"`);
			res.setHeader('Content-Length', buffer.length.toString());
			return res.send(buffer);
		} catch (error) {
			console.error(`[COMPANY CONTROLLER] Error viewing company file ${fileId}:`, error);
			if (error instanceof Error && error.message.includes('nu a fost găsit')) {
				return res.status(404).json({ error: 'File not found' });
			}
			return res.status(500).json({ error: 'Internal server error' });
		}
	}
}