import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, ParseIntPipe, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Permissions } from './permissions/permissions.decorator';
import { PermissionsGuard } from './permissions/permissions.guard';
import { CompanyService } from './company/company.service';
import { CreateCompanyDto } from './company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from './company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './company/dto/update-company-document.dto';

@Controller('companies')
@UseGuards(PermissionsGuard)
export class CompanyHttpController {
	constructor(private readonly service: CompanyService) {}

	@Post()
	@Permissions('company.create')
	create(@Body() dto: CreateCompanyDto) { return this.service.createCompany(dto); }

	@Post('with-documents')
	@Permissions('company.create')
	createWithDocs(@Body() dto: CreateCompanyWithDocumentsDto) { return this.service.createCompanyWithDocuments(dto); }

	@Get()
	@Permissions('company.read')
	findAll(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search?: string, @Query('status') status?: string) {
		return this.service.findAllCompanies(parseInt(page, 10), parseInt(limit, 10), search, status);
	}

	@Get('statistics')
	@Permissions('company.read')
	stats() { return this.service.getCompanyStatistics(); }

	@Get(':id')
	@Permissions('company.read')
	findOne(@Param('id') id: string) { return this.service.findCompanyById(parseInt(id, 10)); }

	@Get('cui/:cui')
	@Permissions('company.read')
	findByCui(@Param('cui') cui: string) { return this.service.findCompanyByCui(cui); }

	@Patch(':id')
	@Permissions('company.update')
	update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) { return this.service.updateCompany(parseInt(id, 10), dto); }

	@Delete(':id')
	@Permissions('company.delete')
	remove(@Param('id') id: string) { return this.service.removeCompany(parseInt(id, 10)); }

	// Documents
	@Get(':companyId/documents')
	@Permissions('company.read')
	getDocs(@Param('companyId') companyId: string) { 
		console.log(`[COMPANY CONTROLLER] Getting documents for company ${companyId}`);
		return this.service.findCompanyDocuments(parseInt(companyId, 10)); 
	}

	@Get(':companyId/documents/folders')
	@Permissions('company.read')
	getCompanyFolders(@Param('companyId') companyId: string) {
		console.log(`[COMPANY CONTROLLER] Getting folders for company ${companyId}`);
		return this.service.getCompanyFolders(parseInt(companyId, 10));
	}

	@Get(':companyId/documents/folder/:folder')
	@Permissions('company.read')
	getDocsByFolder(@Param('companyId') companyId: string, @Param('folder') folder: string) {
		console.log(`[COMPANY CONTROLLER] Getting documents for company ${companyId} in folder ${folder}`);
		return this.service.findCompanyDocumentsByFolder(parseInt(companyId, 10), folder);
	}

	@Get('documents/:documentId/info')
	@Permissions('company.read')
	getDoc(@Param('documentId') documentId: string) { 
		console.log(`[COMPANY CONTROLLER] Getting document info for ID ${documentId}`);
		return this.service.findDocumentById(parseInt(documentId, 10)); 
	}

	@Post(':companyId/documents')
	@Permissions('company.create')
	createDoc(@Param('companyId') companyId: string, @Body() dto: CreateCompanyDocumentDto & { file_content?: string }) {
		console.log(`[COMPANY CONTROLLER] Creating document for company ${companyId}`);
		return this.service.createCompanyDocument({ ...(dto as any), company_id: parseInt(companyId, 10) });
	}

	@Patch('documents/:documentId')
	@Permissions('company.update')
	updateDoc(@Param('documentId') documentId: string, @Body() dto: UpdateCompanyDocumentDto) {
		console.log(`[COMPANY CONTROLLER] Updating document ${documentId}`);
		return this.service.updateCompanyDocument(parseInt(documentId, 10), dto);
	}

	@Delete('documents/:documentId')
	@Permissions('company.delete')
	removeDoc(@Param('documentId') documentId: string) { 
		console.log(`[COMPANY CONTROLLER] Deleting document ${documentId}`);
		return this.service.removeCompanyDocument(parseInt(documentId, 10)); 
	}

	// Serve company file (download or inline based on query)
	@Get('documents/:fileId')
	@Permissions('company.read')
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
	@Permissions('company.read')
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