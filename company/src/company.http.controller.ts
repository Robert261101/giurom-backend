import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CompanyService } from './company/company.service';
import { CreateCompanyDto } from './company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from './company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './company/dto/update-company-document.dto';

@Controller('companies')
export class CompanyHttpController {
	constructor(private readonly service: CompanyService) {}

	@Post()
	create(@Body() dto: CreateCompanyDto) { return this.service.createCompany(dto); }

	@Post('with-documents')
	createWithDocs(@Body() dto: CreateCompanyWithDocumentsDto) { return this.service.createCompanyWithDocuments(dto); }

	@Get()
	findAll(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search?: string, @Query('status') status?: string) {
		return this.service.findAllCompanies(parseInt(page, 10), parseInt(limit, 10), search, status);
	}

	@Get('statistics')
	stats() { return this.service.getCompanyStatistics(); }

	@Get(':id')
	findOne(@Param('id') id: string) { return this.service.findCompanyById(parseInt(id, 10)); }

	@Get('cui/:cui')
	findByCui(@Param('cui') cui: string) { return this.service.findCompanyByCui(cui); }

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) { return this.service.updateCompany(parseInt(id, 10), dto); }

	@Delete(':id')
	remove(@Param('id') id: string) { return this.service.removeCompany(parseInt(id, 10)); }

	// Documents
	@Get(':companyId/documents')
	getDocs(@Param('companyId') companyId: string) { return this.service.findCompanyDocuments(parseInt(companyId, 10)); }

	@Get('documents/:documentId')
	getDoc(@Param('documentId') documentId: string) { return this.service.findDocumentById(parseInt(documentId, 10)); }

	@Post(':companyId/documents')
	createDoc(@Param('companyId') companyId: string, @Body() dto: Omit<CreateCompanyDocumentDto, 'company_id'>) {
		return this.service.createCompanyDocument({ ...(dto as any), company_id: parseInt(companyId, 10) });
	}

	@Patch('documents/:documentId')
	updateDoc(@Param('documentId') documentId: string, @Body() dto: UpdateCompanyDocumentDto) {
		return this.service.updateCompanyDocument(parseInt(documentId, 10), dto);
	}

	@Delete('documents/:documentId')
	removeDoc(@Param('documentId') documentId: string) { return this.service.removeCompanyDocument(parseInt(documentId, 10)); }
}


