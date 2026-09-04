import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, Req, ParseIntPipe, UseGuards, Headers, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { Permissions } from './permissions/permissions.decorator';
import { CompanyService, CompanyAccessRequester } from './company/company.service';
import { SubscriptionService } from './company/subscription.service';
import { PartnerLinkService } from './company/partner-link.service';
import { isPlanCode } from './company/subscription.constants';
import { CreateCompanyDto } from './company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from './company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './company/dto/update-company-document.dto';
import { Company } from './company/entity/company.entity';
import { InternalServiceGuard } from './auth/internal-service.guard';
import {
	hasPlatformWideAccess,
	resolveJwtCompanyId,
} from '@giurom/tenant-access';

@Controller('companies')
export class CompanyHttpController {
	constructor(
		private readonly service: CompanyService,
		private readonly subscriptionService: SubscriptionService,
		private readonly partnerLinkService: PartnerLinkService,
	) {}

	/**
	 * Derivă identitatea cererii din JWT (nu din companyId trimis de client) pentru verificarea de acces.
	 * `undefined` = apel intern server-to-server (InternalServiceGuard a sărit peste JwtAuthGuard, req.user nu există).
	 */
	private buildAccessRequester(req: any): CompanyAccessRequester | undefined {
		const user = req?.user;
		if (!user) return undefined;
		const authHeader = req.headers?.authorization || req.headers?.Authorization;
		const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
		const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
		const permSet = new Set(permissions.map((p) => String(p).toLowerCase().trim()));
		const rawType = String(user.company_type ?? user.companyType ?? '').toLowerCase().trim();
		const companyType =
			rawType === 'client' || rawType === 'furnizor' ? (rawType as 'client' | 'furnizor') : undefined;
		const jwtCompanyId = resolveJwtCompanyId({
			company_id: user.company_id ?? user.companyId,
			companyId: user.companyId ?? user.company_id,
		});
		const platformWide = hasPlatformWideAccess({
			company_id: user.company_id ?? user.companyId,
			companyId: user.companyId ?? user.company_id,
			isSuperAdmin: user.isSuperAdmin === true,
			permissions,
			roles,
		});
		const isSuperAdmin = user.isSuperAdmin === true || platformWide;
		const isAdmin =
			user.isAdmin === true ||
			isSuperAdmin ||
			permSet.has('assignment.read_company');
		return {
			isAdmin,
			isSuperAdmin,
			hasPlatformWideAccess: platformWide,
			authHeader,
			companyId: jwtCompanyId ?? undefined,
			companyType,
			permissions,
			roles,
		};
	}

	@Post()
	@Permissions('companies.create')
	create(@Body() dto: CreateCompanyDto, @Headers('x-work-location-id') xWorkLocationId?: string) {
		const work_location_id = xWorkLocationId != null ? parseInt(xWorkLocationId, 10) : undefined;
		return this.service.createCompany(dto, Number.isFinite(work_location_id) ? work_location_id : undefined);
	}

	@Post('with-documents')
	@Permissions('companies.create')
	createWithDocs(@Body() dto: CreateCompanyWithDocumentsDto) { return this.service.createCompanyWithDocuments(dto); }

	@Get('me/subscription')
	@Permissions('companies.read_own', 'companies.read')
	getMySubscription(@Req() req: any) {
		return this.subscriptionService.getMySubscription(this.buildAccessRequester(req));
	}

	@Get('me/subscription/invoices')
	@Permissions('companies.read_own', 'companies.read')
	getMySubscriptionInvoices(@Req() req: any) {
		return this.subscriptionService.getMyInvoices(this.buildAccessRequester(req));
	}

	@Patch('me/subscription')
	@Permissions('companies.read_own', 'companies.read')
	changeMySubscription(
		@Body() body: {
			plan_code?: string;
			block_account_supplier_ids?: number[];
			block_manual_supplier_ids?: number[];
		},
		@Req() req: any,
	) {
		const planCode = String(body?.plan_code || '').toLowerCase().trim();
		const userId = req?.user?.userId ?? req?.user?.sub ?? null;
		return this.subscriptionService.changeMySubscription(
			this.buildAccessRequester(req),
			planCode,
			userId != null ? Number(userId) : null,
			{
				block_account_supplier_ids: body?.block_account_supplier_ids,
				block_manual_supplier_ids: body?.block_manual_supplier_ids,
			},
		);
	}

	/**
	 * Abonamentul din aplicatia 2 (RestoSoft), pentru locatiile legate ale firmei curente.
	 * Firma vine din JWT, nu din query: altfel un tenant ar putea citi abonamentul altuia.
	 */
	@Get('me/partner-link/subscription')
	@Permissions('companies.read_own', 'companies.read')
	getMyPartnerSubscription(@Req() req: any) {
		const companyId = Number(this.buildAccessRequester(req)?.companyId);
		if (!Number.isFinite(companyId) || companyId <= 0) {
			throw new ForbiddenException('Doar un tenant client autentificat poate citi legatura cu aplicatia 2');
		}
		return this.partnerLinkService.fetchApp2SideForCompany(companyId);
	}

	/**
	 * Ce vede aplicatia 2 despre abonamentul unei firme de aici. Apelat server-to-server cu
	 * `X-Stock-Sync-Key` (vezi `JwtAuthGuard`), ca restul canalelor dintre cele doua aplicatii —
	 * de partea cealalta nu exista JWT de aici.
	 */
	@Get('integrations/partner-link/subscription')
	async getPartnerSubscriptionForApp2(
		@Query('company_id') companyIdRaw: string,
		@Req() req?: { bypassAuth?: boolean },
	) {
		if (req?.bypassAuth !== true) {
			throw new ForbiddenException('Endpoint de integrare — necesita X-Stock-Sync-Key');
		}
		const companyId = Number.parseInt(String(companyIdRaw ?? ''), 10);
		if (!Number.isFinite(companyId) || companyId <= 0) {
			throw new BadRequestException('company_id invalid');
		}
		return this.partnerLinkService.describeOwnSideForCompany(companyId);
	}

	@Get('internal/:companyId/subscription')
	async getSubscriptionInternal(
		@Param('companyId', ParseIntPipe) companyId: number,
		@Req() req?: { bypassAuth?: boolean },
	) {
		if (req?.bypassAuth !== true) {
			throw new ForbiddenException('Endpoint intern — necesită x-service-secret');
		}
		return this.subscriptionService.getSubscriptionForCompany(companyId);
	}

	@Patch(':companyId/subscription')
	@Permissions('companies.update')
	setCompanySubscription(
		@Param('companyId', ParseIntPipe) companyId: number,
		@Body() body: { plan_code?: string },
		@Req() req: any,
	) {
		const planCode = String(body?.plan_code || '').toLowerCase().trim();
		if (!isPlanCode(planCode)) {
			throw new BadRequestException('plan_code trebuie să fie free, silver sau gold');
		}
		const requester = this.buildAccessRequester(req);
		const userId = req?.user?.userId ?? req?.user?.sub ?? null;
		return this.subscriptionService.setCompanyPlan(
			companyId,
			planCode,
			requester,
			userId != null ? Number(userId) : null,
		);
	}

	@Get()
	@Permissions('companies.read')
	findAll(
		@Req() req: any,
		@Query('page') page = '1',
		@Query('limit') limit = '10',
		@Query('search') search?: string,
		@Query('status') status?: string,
		@Query('company_type') companyType?: string,
	) {
		const normalizedType =
			companyType === 'client' || companyType === 'furnizor' ? companyType : undefined;
		return this.service.findAllCompanies(
			parseInt(page, 10),
			parseInt(limit, 10),
			search,
			status,
			this.buildAccessRequester(req),
			normalizedType,
		);
	}

	@Get('batch')
	@UseGuards(InternalServiceGuard) // Folosit pentru apeluri interne între microservicii
	@Permissions('companies.read')
	findBatch(
		@Query('ids') ids: string,
		@Query('company_type') companyType?: string,
	): Promise<Array<Pick<Company, 'id' | 'company_name' | 'company_type'>>> {
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

		const normalizedType =
			companyType === 'client' || companyType === 'furnizor' ? companyType : undefined;
		return this.service.findByIdsBasic(idList, { companyType: normalizedType });
	}

	@Get('for-own')
	@Permissions('companies.read_own')
	findForOwn(@Req() req: any) {
		return this.service.findForOwn(this.buildAccessRequester(req));
	}

	@Get('statistics')
	@Permissions('companies.read')
	stats() { return this.service.getCompanyStatistics(); }

	@Get(':id/name')
	@Permissions('companies.read_own')
	findNameById(@Param('id') id: string, @Req() req: any) { 
		return this.service.findNameById(parseInt(id, 10), this.buildAccessRequester(req)); 
	}

	@Get(':id')
	@Permissions('companies.read', 'companies.read_own')
	findOne(@Param('id') id: string, @Req() req: any) { return this.service.findCompanyById(parseInt(id, 10), this.buildAccessRequester(req)); }

	@Get('cui/:cui')
	@Permissions('companies.read')
	findByCui(@Param('cui') cui: string, @Req() req: any) { return this.service.findCompanyByCui(cui, this.buildAccessRequester(req)); }

	@Patch(':id')
	@Permissions('companies.update')
	update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @Req() req: any, @Headers('x-work-location-id') xWorkLocationId?: string) {
		const work_location_id = xWorkLocationId != null ? parseInt(xWorkLocationId, 10) : undefined;
		return this.service.updateCompany(parseInt(id, 10), dto, Number.isFinite(work_location_id) ? work_location_id : undefined, this.buildAccessRequester(req));
	}

	@Delete(':id')
	@Permissions('companies.delete')
	remove(@Param('id') id: string, @Req() req: any, @Headers('x-work-location-id') xWorkLocationId?: string) {
		const work_location_id = xWorkLocationId != null ? parseInt(xWorkLocationId, 10) : undefined;
		return this.service.removeCompany(parseInt(id, 10), Number.isFinite(work_location_id) ? work_location_id : undefined, this.buildAccessRequester(req));
	}

	// Documents
	@Get(':companyId/documents')
	@Permissions('companies.read', 'companies.read_own')
	getDocs(@Param('companyId') companyId: string, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Getting documents for company ${companyId}`);
		return this.service.findCompanyDocuments(parseInt(companyId, 10), this.buildAccessRequester(req));
	}

	@Get(':companyId/documents/folders')
	@Permissions('companies.read', 'companies.read_own')
	getCompanyFolders(@Param('companyId') companyId: string, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Getting folders for company ${companyId}`);
		return this.service.getCompanyFolders(parseInt(companyId, 10), this.buildAccessRequester(req));
	}

	@Post(':companyId/documents/folders')
	@Permissions('companies.create')
	async createCompanyFolder(@Param('companyId') companyId: string, @Body() body: { folder: string }, @Req() req: any) {
		await this.service.createCompanyFolder(parseInt(companyId, 10), body?.folder ?? '', this.buildAccessRequester(req));
	}

	@Delete(':companyId/documents/folders')
	@Permissions('companies.delete')
	async deleteCompanyFolder(@Param('companyId') companyId: string, @Query('folder') folder: string, @Req() req: any) {
		await this.service.deleteCompanyFolder(parseInt(companyId, 10), folder ?? '', this.buildAccessRequester(req));
	}

	@Get(':companyId/documents/structure')
	@Permissions('companies.read', 'companies.read_own')
	getCompanyFileStructure(@Param('companyId') companyId: string, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Getting file structure for company ${companyId}`);
		return this.service.getCompanyFileStructure(parseInt(companyId, 10), this.buildAccessRequester(req));
	}

	@Get(':companyId/documents/folder-files')
	@Permissions('companies.read', 'companies.read_own')
	getFilesFromFolder(
		@Param('companyId') companyId: string,
		@Query('path') folderPath: string,
		@Req() req: any,
	) {
		console.log(`[COMPANY CONTROLLER] Getting files from folder ${folderPath} for company ${companyId}`);
		return this.service.getFilesFromFolder(parseInt(companyId, 10), folderPath, this.buildAccessRequester(req));
	}

	@Get(':companyId/documents/file')
	@Permissions('companies.read', 'companies.read_own')
	async serveFileFromPath(
		@Param('companyId') companyId: string,
		@Query('path') filePath: string,
		@Query('download') download: string,
		@Res() res: Response,
		@Req() req: any,
	) {
		try {
			console.log(`[COMPANY CONTROLLER] Serving file from path ${filePath} for company ${companyId}, download: ${download}`);
			const forceDownload = download === 'true';
			const served = await this.service.serveFileFromPath(parseInt(companyId, 10), filePath, forceDownload, this.buildAccessRequester(req));
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
	@Permissions('companies.read', 'companies.read_own')
	getDocsByFolder(@Param('companyId') companyId: string, @Param('folder') folder: string, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Getting documents for company ${companyId} in folder ${folder}`);
		return this.service.findCompanyDocumentsByFolder(parseInt(companyId, 10), folder, this.buildAccessRequester(req));
	}

	@Get('documents/:documentId/info')
	@Permissions('companies.read', 'companies.read_own')
	getDoc(@Param('documentId') documentId: string, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Getting document info for ID ${documentId}`);
		return this.service.findDocumentById(parseInt(documentId, 10), this.buildAccessRequester(req));
	}

	@Post(':companyId/documents')
	@Permissions('companies.create')
	createDoc(@Param('companyId') companyId: string, @Body() dto: CreateCompanyDocumentDto & { file_content?: string; expire_date?: string }, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Creating document for company ${companyId}`);
		return this.service.createCompanyDocument({ ...(dto as any), company_id: parseInt(companyId, 10) }, this.buildAccessRequester(req));
	}

	@Patch('documents/:documentId')
	@Permissions('companies.update')
	updateDoc(@Param('documentId') documentId: string, @Body() dto: UpdateCompanyDocumentDto, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Updating document ${documentId}`);
		return this.service.updateCompanyDocument(parseInt(documentId, 10), dto, this.buildAccessRequester(req));
	}

	@Delete('documents/:documentId')
	@Permissions('companies.delete')
	removeDoc(@Param('documentId') documentId: string, @Req() req: any) {
		console.log(`[COMPANY CONTROLLER] Deleting document ${documentId}`);
		return this.service.removeCompanyDocument(parseInt(documentId, 10), this.buildAccessRequester(req));
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
	@Permissions('companies.read', 'companies.read_own')
	async getCompanyFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Query('download') download: string,
		@Res() res: Response,
		@Req() req: any,
	) {
		try {
			console.log(`[COMPANY CONTROLLER] Serving company file ${fileId}, download: ${download}`);
			const forceDownload = download === 'true';
			const served = await this.service.serveCompanyFile(fileId, forceDownload, this.buildAccessRequester(req));
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
	@Permissions('companies.read', 'companies.read_own')
	async viewCompanyFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Res() res: Response,
		@Req() req: any,
	) {
		try {
			console.log(`[COMPANY CONTROLLER] Viewing company file ${fileId} inline`);
			const served = await this.service.serveCompanyFile(fileId, false, this.buildAccessRequester(req));
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