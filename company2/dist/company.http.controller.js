"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyHttpController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const company_service_1 = require("./company/company.service");
const create_company_dto_1 = require("./company/dto/create-company.dto");
const create_company_with_documents_dto_1 = require("./company/dto/create-company-with-documents.dto");
const update_company_dto_1 = require("./company/dto/update-company.dto");
const create_company_document_dto_1 = require("./company/dto/create-company-document.dto");
const update_company_document_dto_1 = require("./company/dto/update-company-document.dto");
let CompanyHttpController = class CompanyHttpController {
    constructor(service) {
        this.service = service;
    }
    create(dto) { return this.service.createCompany(dto); }
    createWithDocs(dto) { return this.service.createCompanyWithDocuments(dto); }
    findAll(page = '1', limit = '10', search, status) {
        return this.service.findAllCompanies(parseInt(page, 10), parseInt(limit, 10), search, status);
    }
    stats() { return this.service.getCompanyStatistics(); }
    findOne(id) { return this.service.findCompanyById(parseInt(id, 10)); }
    findByCui(cui) { return this.service.findCompanyByCui(cui); }
    update(id, dto) { return this.service.updateCompany(parseInt(id, 10), dto); }
    remove(id) { return this.service.removeCompany(parseInt(id, 10)); }
    getDocs(companyId) { return this.service.findCompanyDocuments(parseInt(companyId, 10)); }
    getDoc(documentId) { return this.service.findDocumentById(parseInt(documentId, 10)); }
    createDoc(companyId, dto) {
        return this.service.createCompanyDocument({ ...dto, company_id: parseInt(companyId, 10) });
    }
    updateDoc(documentId, dto) {
        return this.service.updateCompanyDocument(parseInt(documentId, 10), dto);
    }
    removeDoc(documentId) { return this.service.removeCompanyDocument(parseInt(documentId, 10)); }
};
exports.CompanyHttpController = CompanyHttpController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Creează o companie nouă',
        description: 'Creează o companie nouă cu toate detaliile necesare'
    }),
    (0, swagger_1.ApiBody)({
        type: create_company_dto_1.CreateCompanyDto,
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
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Date invalide' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Compania cu acest CUI există deja' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_dto_1.CreateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('with-documents'),
    (0, swagger_1.ApiOperation)({
        summary: 'Creează o companie cu documente',
        description: 'Creează o companie nouă împreună cu documentele asociate'
    }),
    (0, swagger_1.ApiBody)({
        type: create_company_with_documents_dto_1.CreateCompanyWithDocumentsDto,
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
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Compania cu documente a fost creată cu succes' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Date invalide' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_with_documents_dto_1.CreateCompanyWithDocumentsDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "createWithDocs", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține lista de companii',
        description: 'Returnează o listă paginată de companii cu opțiuni de filtrare'
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, example: 1, description: 'Numărul paginii' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, example: 10, description: 'Numărul de elemente per pagină' }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String, example: 'Giurom', description: 'Căutare după nume sau CUI' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, type: String, example: 'activ', description: 'Filtrare după status' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține statistici despre companii',
        description: 'Returnează statistici generale despre companiile din sistem'
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține o companie după ID',
        description: 'Returnează detaliile complete ale unei companii'
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: Number, example: 1, description: 'ID-ul companiei' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Compania nu a fost găsită' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('cui/:cui'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține o companie după CUI',
        description: 'Returnează detaliile unei companii pe baza CUI-ului'
    }),
    (0, swagger_1.ApiParam)({ name: 'cui', type: String, example: 'RO12345678', description: 'CUI-ul companiei' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Detaliile companiei' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Compania cu acest CUI nu a fost găsită' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('cui')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "findByCui", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizează o companie',
        description: 'Actualizează detaliile unei companii existente'
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: Number, example: 1, description: 'ID-ul companiei' }),
    (0, swagger_1.ApiBody)({
        type: update_company_dto_1.UpdateCompanyDto,
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
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Compania nu a fost găsită' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Date invalide' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_company_dto_1.UpdateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Șterge o companie',
        description: 'Șterge o companie din sistem'
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: Number, example: 1, description: 'ID-ul companiei' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Compania a fost ștearsă cu succes' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Compania nu a fost găsită' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "remove", null);
__decorate([
    (0, swagger_1.ApiTags)('documents'),
    (0, common_1.Get)(':companyId/documents'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține documentele unei companii',
        description: 'Returnează lista de documente asociate unei companii'
    }),
    (0, swagger_1.ApiParam)({ name: 'companyId', type: Number, example: 1, description: 'ID-ul companiei' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Compania nu a fost găsită' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "getDocs", null);
__decorate([
    (0, swagger_1.ApiTags)('documents'),
    (0, common_1.Get)('documents/:documentId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obține un document după ID',
        description: 'Returnează detaliile unui document specific'
    }),
    (0, swagger_1.ApiParam)({ name: 'documentId', type: Number, example: 1, description: 'ID-ul documentului' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Detaliile documentului' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Documentul nu a fost găsit' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "getDoc", null);
__decorate([
    (0, swagger_1.ApiTags)('documents'),
    (0, common_1.Post)(':companyId/documents'),
    (0, swagger_1.ApiOperation)({
        summary: 'Creează un document pentru o companie',
        description: 'Adaugă un document nou pentru o companie existentă'
    }),
    (0, swagger_1.ApiParam)({ name: 'companyId', type: Number, example: 1, description: 'ID-ul companiei' }),
    (0, swagger_1.ApiBody)({
        type: create_company_document_dto_1.CreateCompanyDocumentDto,
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
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Compania nu a fost găsită' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Date invalide' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "createDoc", null);
__decorate([
    (0, swagger_1.ApiTags)('documents'),
    (0, common_1.Patch)('documents/:documentId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizează un document',
        description: 'Actualizează detaliile unui document existent'
    }),
    (0, swagger_1.ApiParam)({ name: 'documentId', type: Number, example: 1, description: 'ID-ul documentului' }),
    (0, swagger_1.ApiBody)({
        type: update_company_document_dto_1.UpdateCompanyDocumentDto,
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
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Documentul nu a fost găsit' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Date invalide' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_company_document_dto_1.UpdateCompanyDocumentDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "updateDoc", null);
__decorate([
    (0, swagger_1.ApiTags)('documents'),
    (0, common_1.Delete)('documents/:documentId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Șterge un document',
        description: 'Șterge un document din sistem'
    }),
    (0, swagger_1.ApiParam)({ name: 'documentId', type: Number, example: 1, description: 'ID-ul documentului' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Documentul a fost șters cu succes' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Documentul nu a fost găsit' }),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "removeDoc", null);
exports.CompanyHttpController = CompanyHttpController = __decorate([
    (0, swagger_1.ApiTags)('companies'),
    (0, common_1.Controller)('companies'),
    __metadata("design:paramtypes", [company_service_1.CompanyService])
], CompanyHttpController);
//# sourceMappingURL=company.http.controller.js.map