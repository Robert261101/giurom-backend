import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyService } from './company/company.service';
import { CreateCompanyDto } from './company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from './company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './company/dto/update-company-document.dto';

@ApiTags('companies')
@Controller('companies')
export class CompanyHttpController {
	constructor(private readonly service: CompanyService) {}

	@Post()
	@ApiOperation({ 
		summary: 'Creează o companie nouă',
		description: 'Creează o companie nouă cu toate detaliile necesare'
	})
	@ApiBody({
		type: CreateCompanyDto,
		examples: {
			example1: {
				summary: 'Companie SRL completă',
				value: {
					company_name: 'SC Giurom SRL',
					cui: 'RO12345678',
					trade_register_number: 'J40/1234/2023',
					address: 'Str. Exemplu nr. 123, Sector 1',
					city: 'București',
					county: 'București',
					postal_code: '010101',
					country: 'Romania',
					phone_number: '+40712345678',
					email: 'contact@giurom.com',
					incorporation_date: '2023-01-15',
					legal_form: 'SRL',
					activity_code: '6201',
					vat_payer: true,
					bank_name: 'BCR',
					bank_account_number: 'RO49AAAA1B31007593840000',
					website: 'https://www.giurom.com',
					status: 'activ',
					notes: 'Companie nou înregistrată'
				}
			},
			example2: {
				summary: 'Companie PFA simplă',
				value: {
					company_name: 'Popescu Ion PFA',
					cui: 'RO87654321',
					trade_register_number: 'F40/5678/2023',
					address: 'Str. Libertății nr. 45',
					city: 'Cluj-Napoca',
					county: 'Cluj',
					postal_code: '400001',
					country: 'Romania',
					phone_number: '+40787654321',
					email: 'ion.popescu@email.com',
					incorporation_date: '2023-06-01',
					legal_form: 'PFA',
					activity_code: '6202',
					vat_payer: false,
					status: 'activ'
				}
			}
		}
	})
	@ApiResponse({ 
		status: 201, 
		description: 'Compania a fost creată cu succes',
		schema: {
			example: {
				id: 1,
				company_name: 'SC Giurom SRL',
				cui: 'RO12345678',
				trade_register_number: 'J40/1234/2023',
				address: 'Str. Exemplu nr. 123, Sector 1',
				city: 'București',
				county: 'București',
				postal_code: '010101',
				country: 'Romania',
				phone_number: '+40712345678',
				email: 'contact@giurom.com',
				incorporation_date: '2023-01-15',
				legal_form: 'SRL',
				activity_code: '6201',
				vat_payer: true,
				bank_name: 'BCR',
				bank_account_number: 'RO49AAAA1B31007593840000',
				website: 'https://www.giurom.com',
				status: 'activ',
				notes: 'Companie nou înregistrată',
				created_at: '2023-01-15T10:30:00.000Z',
				updated_at: '2023-01-15T10:30:00.000Z'
			}
		}
	})
	@ApiResponse({ status: 400, description: 'Date invalide' })
	@ApiResponse({ status: 409, description: 'Compania cu acest CUI există deja' })
	@ApiBearerAuth()
	create(@Body() dto: CreateCompanyDto) { return this.service.createCompany(dto); }

	@Post('with-documents')
	@ApiOperation({ 
		summary: 'Creează o companie cu documente',
		description: 'Creează o companie nouă împreună cu documentele asociate'
	})
	@ApiBody({
		type: CreateCompanyWithDocumentsDto,
		examples: {
			example1: {
				summary: 'Companie cu documente complete',
				value: {
					company_name: 'SC Test SRL',
					cui: 'RO11111111',
					trade_register_number: 'J40/9999/2023',
					address: 'Str. Test nr. 1',
					city: 'București',
					incorporation_date: '2023-12-01',
					legal_form: 'SRL',
					activity_code: '6201',
					documents: [
						{
							document_type: 'certificat_inregistrare',
							document_name: 'Certificat înregistrare',
							file_path: '/documents/certificat.pdf',
							issue_date: '2023-12-01',
							expiry_date: '2024-12-01'
						},
						{
							document_type: 'adeverinta_fiscal',
							document_name: 'Adeverință fiscală',
							file_path: '/documents/adeverinta.pdf',
							issue_date: '2023-12-01'
						}
					]
				}
			}
		}
	})
	@ApiResponse({ status: 201, description: 'Compania cu documente a fost creată cu succes' })
	@ApiResponse({ status: 400, description: 'Date invalide' })
	@ApiBearerAuth()
	createWithDocs(@Body() dto: CreateCompanyWithDocumentsDto) { return this.service.createCompanyWithDocuments(dto); }

	@Get()
	@ApiOperation({ 
		summary: 'Obține lista de companii',
		description: 'Returnează o listă paginată de companii cu opțiuni de filtrare'
	})
	@ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Numărul paginii' })
	@ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Numărul de elemente per pagină' })
	@ApiQuery({ name: 'search', required: false, type: String, example: 'Giurom', description: 'Căutare după nume sau CUI' })
	@ApiQuery({ name: 'status', required: false, type: String, example: 'activ', description: 'Filtrare după status' })
	@ApiResponse({ 
		status: 200, 
		description: 'Lista de companii',
		schema: {
			example: {
				companies: [
					{
						id: 1,
						company_name: 'SC Giurom SRL',
						cui: 'RO12345678',
						city: 'București',
						status: 'activ',
						created_at: '2023-01-15T10:30:00.000Z'
					}
				],
				total: 1,
				totalPages: 1,
				currentPage: 1
			}
		}
	})
	@ApiBearerAuth()
	findAll(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search?: string, @Query('status') status?: string) {
		return this.service.findAllCompanies(parseInt(page, 10), parseInt(limit, 10), search, status);
	}

	@Get('statistics')
	@ApiOperation({ 
		summary: 'Obține statistici despre companii',
		description: 'Returnează statistici generale despre companiile din sistem'
	})
	@ApiResponse({ 
		status: 200, 
		description: 'Statistici companii',
		schema: {
			example: {
				total_companies: 150,
				active_companies: 120,
				inactive_companies: 25,
				suspended_companies: 5,
				companies_by_legal_form: {
					'SRL': 100,
					'SA': 30,
					'PFA': 20
				},
				companies_by_city: {
					'București': 80,
					'Cluj-Napoca': 25,
					'Timișoara': 20
				}
			}
		}
	})
	@ApiBearerAuth()
	stats() { return this.service.getCompanyStatistics(); }

	@Get(':id')
	@ApiOperation({ 
		summary: 'Obține o companie după ID',
		description: 'Returnează detaliile complete ale unei companii'
	})
	@ApiParam({ name: 'id', type: Number, example: 1, description: 'ID-ul companiei' })
	@ApiResponse({ 
		status: 200, 
		description: 'Detaliile companiei',
		schema: {
			example: {
				id: 1,
				company_name: 'SC Giurom SRL',
				cui: 'RO12345678',
				trade_register_number: 'J40/1234/2023',
				address: 'Str. Exemplu nr. 123, Sector 1',
				city: 'București',
				county: 'București',
				postal_code: '010101',
				country: 'Romania',
				phone_number: '+40712345678',
				email: 'contact@giurom.com',
				incorporation_date: '2023-01-15',
				legal_form: 'SRL',
				activity_code: '6201',
				vat_payer: true,
				bank_name: 'BCR',
				bank_account_number: 'RO49AAAA1B31007593840000',
				website: 'https://www.giurom.com',
				status: 'activ',
				notes: 'Companie nou înregistrată',
				created_at: '2023-01-15T10:30:00.000Z',
				updated_at: '2023-01-15T10:30:00.000Z',
				documents: []
			}
		}
	})
	@ApiResponse({ status: 404, description: 'Compania nu a fost găsită' })
	@ApiBearerAuth()
	findOne(@Param('id') id: string) { return this.service.findCompanyById(parseInt(id, 10)); }

	@Get('cui/:cui')
	@ApiOperation({ 
		summary: 'Obține o companie după CUI',
		description: 'Returnează detaliile unei companii pe baza CUI-ului'
	})
	@ApiParam({ name: 'cui', type: String, example: 'RO12345678', description: 'CUI-ul companiei' })
	@ApiResponse({ status: 200, description: 'Detaliile companiei' })
	@ApiResponse({ status: 404, description: 'Compania cu acest CUI nu a fost găsită' })
	@ApiBearerAuth()
	findByCui(@Param('cui') cui: string) { return this.service.findCompanyByCui(cui); }

	@Patch(':id')
	@ApiOperation({ 
		summary: 'Actualizează o companie',
		description: 'Actualizează detaliile unei companii existente'
	})
	@ApiParam({ name: 'id', type: Number, example: 1, description: 'ID-ul companiei' })
	@ApiBody({
		type: UpdateCompanyDto,
		examples: {
			example1: {
				summary: 'Actualizare completă',
				value: {
					company_name: 'SC Giurom SRL - Actualizat',
					address: 'Str. Nouă nr. 456, Sector 2',
					city: 'București',
					phone_number: '+40712345679',
					email: 'contact.nou@giurom.com',
					website: 'https://www.giurom.ro',
					status: 'activ',
					notes: 'Companie actualizată'
				}
			},
			example2: {
				summary: 'Actualizare parțială - doar contact',
				value: {
					phone_number: '+40712345680',
					email: 'contact@giurom.ro'
				}
			},
			example3: {
				summary: 'Schimbare status',
				value: {
					status: 'inactiv',
					notes: 'Companie suspendată temporar'
				}
			}
		}
	})
	@ApiResponse({ 
		status: 200, 
		description: 'Compania a fost actualizată cu succes',
		schema: {
			example: {
				id: 1,
				company_name: 'SC Giurom SRL - Actualizat',
				cui: 'RO12345678',
				trade_register_number: 'J40/1234/2023',
				address: 'Str. Nouă nr. 456, Sector 2',
				city: 'București',
				county: 'București',
				postal_code: '010101',
				country: 'Romania',
				phone_number: '+40712345679',
				email: 'contact.nou@giurom.com',
				incorporation_date: '2023-01-15',
				legal_form: 'SRL',
				activity_code: '6201',
				vat_payer: true,
				bank_name: 'BCR',
				bank_account_number: 'RO49AAAA1B31007593840000',
				website: 'https://www.giurom.ro',
				status: 'activ',
				notes: 'Companie actualizată',
				created_at: '2023-01-15T10:30:00.000Z',
				updated_at: '2023-12-01T15:45:00.000Z'
			}
		}
	})
	@ApiResponse({ status: 404, description: 'Compania nu a fost găsită' })
	@ApiResponse({ status: 400, description: 'Date invalide' })
	@ApiBearerAuth()
	update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) { return this.service.updateCompany(parseInt(id, 10), dto); }

	@Delete(':id')
	@ApiOperation({ 
		summary: 'Șterge o companie',
		description: 'Șterge o companie din sistem'
	})
	@ApiParam({ name: 'id', type: Number, example: 1, description: 'ID-ul companiei' })
	@ApiResponse({ status: 200, description: 'Compania a fost ștearsă cu succes' })
	@ApiResponse({ status: 404, description: 'Compania nu a fost găsită' })
	@ApiBearerAuth()
	remove(@Param('id') id: string) { return this.service.removeCompany(parseInt(id, 10)); }

	// Documents
	@ApiTags('documents')
	@Get(':companyId/documents')
	@ApiOperation({ 
		summary: 'Obține documentele unei companii',
		description: 'Returnează lista de documente asociate unei companii'
	})
	@ApiParam({ name: 'companyId', type: Number, example: 1, description: 'ID-ul companiei' })
	@ApiResponse({ 
		status: 200, 
		description: 'Lista de documente',
		schema: {
			example: [
				{
					id: 1,
					company_id: 1,
					document_type: 'certificat_inregistrare',
					document_name: 'Certificat înregistrare',
					file_path: '/documents/certificat.pdf',
					issue_date: '2023-01-15',
					expiry_date: '2024-01-15',
					created_at: '2023-01-15T10:30:00.000Z'
				}
			]
		}
	})
	@ApiResponse({ status: 404, description: 'Compania nu a fost găsită' })
	@ApiBearerAuth()
	getDocs(@Param('companyId') companyId: string) { return this.service.findCompanyDocuments(parseInt(companyId, 10)); }

	@ApiTags('documents')
	@Get('documents/:documentId')
	@ApiOperation({ 
		summary: 'Obține un document după ID',
		description: 'Returnează detaliile unui document specific'
	})
	@ApiParam({ name: 'documentId', type: Number, example: 1, description: 'ID-ul documentului' })
	@ApiResponse({ status: 200, description: 'Detaliile documentului' })
	@ApiResponse({ status: 404, description: 'Documentul nu a fost găsit' })
	@ApiBearerAuth()
	getDoc(@Param('documentId') documentId: string) { return this.service.findDocumentById(parseInt(documentId, 10)); }

	@ApiTags('documents')
	@Post(':companyId/documents')
	@ApiOperation({ 
		summary: 'Creează un document pentru o companie',
		description: 'Adaugă un document nou pentru o companie existentă'
	})
	@ApiParam({ name: 'companyId', type: Number, example: 1, description: 'ID-ul companiei' })
	@ApiBody({
		type: CreateCompanyDocumentDto,
		examples: {
			example1: {
				summary: 'Certificat înregistrare',
				value: {
					document_type: 'certificat_inregistrare',
					document_name: 'Certificat înregistrare',
					file_path: '/documents/certificat.pdf',
					issue_date: '2023-01-15',
					expiry_date: '2024-01-15'
				}
			},
			example2: {
				summary: 'Adeverință fiscală',
				value: {
					document_type: 'adeverinta_fiscal',
					document_name: 'Adeverință fiscală',
					file_path: '/documents/adeverinta.pdf',
					issue_date: '2023-01-15'
				}
			}
		}
	})
	@ApiResponse({ 
		status: 201, 
		description: 'Documentul a fost creat cu succes',
		schema: {
			example: {
				id: 1,
				company_id: 1,
				document_type: 'certificat_inregistrare',
				document_name: 'Certificat înregistrare',
				file_path: '/documents/certificat.pdf',
				issue_date: '2023-01-15',
				expiry_date: '2024-01-15',
				created_at: '2023-01-15T10:30:00.000Z'
			}
		}
	})
	@ApiResponse({ status: 404, description: 'Compania nu a fost găsită' })
	@ApiResponse({ status: 400, description: 'Date invalide' })
	@ApiBearerAuth()
	createDoc(@Param('companyId') companyId: string, @Body() dto: Omit<CreateCompanyDocumentDto, 'company_id'>) {
		return this.service.createCompanyDocument({ ...(dto as any), company_id: parseInt(companyId, 10) });
	}

	@ApiTags('documents')
	@Patch('documents/:documentId')
	@ApiOperation({ 
		summary: 'Actualizează un document',
		description: 'Actualizează detaliile unui document existent'
	})
	@ApiParam({ name: 'documentId', type: Number, example: 1, description: 'ID-ul documentului' })
	@ApiBody({
		type: UpdateCompanyDocumentDto,
		examples: {
			example1: {
				summary: 'Actualizare completă',
				value: {
					document_name: 'Certificat înregistrare - Actualizat',
					file_path: '/documents/certificat_nou.pdf',
					expiry_date: '2025-01-15'
				}
			},
			example2: {
				summary: 'Actualizare parțială',
				value: {
					expiry_date: '2025-12-31'
				}
			}
		}
	})
	@ApiResponse({ 
		status: 200, 
		description: 'Documentul a fost actualizat cu succes',
		schema: {
			example: {
				id: 1,
				company_id: 1,
				document_type: 'certificat_inregistrare',
				document_name: 'Certificat înregistrare - Actualizat',
				file_path: '/documents/certificat_nou.pdf',
				issue_date: '2023-01-15',
				expiry_date: '2025-01-15',
				created_at: '2023-01-15T10:30:00.000Z',
				updated_at: '2023-12-01T15:45:00.000Z'
			}
		}
	})
	@ApiResponse({ status: 404, description: 'Documentul nu a fost găsit' })
	@ApiResponse({ status: 400, description: 'Date invalide' })
	@ApiBearerAuth()
	updateDoc(@Param('documentId') documentId: string, @Body() dto: UpdateCompanyDocumentDto) {
		return this.service.updateCompanyDocument(parseInt(documentId, 10), dto);
	}

	@ApiTags('documents')
	@Delete('documents/:documentId')
	@ApiOperation({ 
		summary: 'Șterge un document',
		description: 'Șterge un document din sistem'
	})
	@ApiParam({ name: 'documentId', type: Number, example: 1, description: 'ID-ul documentului' })
	@ApiResponse({ status: 200, description: 'Documentul a fost șters cu succes' })
	@ApiResponse({ status: 404, description: 'Documentul nu a fost găsit' })
	@ApiBearerAuth()
	removeDoc(@Param('documentId') documentId: string) { return this.service.removeCompanyDocument(parseInt(documentId, 10)); }
}


