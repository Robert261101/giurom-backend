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
exports.CompanyService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const company_entity_1 = require("./entity/company.entity");
const company_document_entity_1 = require("./entity/company-document.entity");
let CompanyService = class CompanyService {
    constructor(companyRepository, companyDocumentRepository) {
        this.companyRepository = companyRepository;
        this.companyDocumentRepository = companyDocumentRepository;
    }
    async createCompany(dto) {
        const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
        if (existing)
            throw new common_1.ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
        const company = this.companyRepository.create(dto);
        return await this.companyRepository.save(company);
    }
    async createCompanyWithDocuments(dto) {
        const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
        if (existing)
            throw new common_1.ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
        const { documents, ...companyData } = dto;
        const companyEntity = this.companyRepository.create(companyData);
        const saved = await this.companyRepository.save(companyEntity);
        if (Array.isArray(documents) && documents.length) {
            for (const doc of documents) {
                const document = this.companyDocumentRepository.create({
                    company_id: saved.id,
                    document_name: doc.fileName || doc.document_name,
                    document_type: doc.document_type || 'Document',
                    location_path: doc.location_path || '',
                    upload_date: new Date(),
                    notes: doc.note || doc.notes || null,
                });
                await this.companyDocumentRepository.save(document);
            }
        }
        return saved;
    }
    async findAllCompanies(page = 1, limit = 10, search, status) {
        const qb = this.companyRepository.createQueryBuilder('company').leftJoinAndSelect('company.documents', 'documents');
        if (search)
            qb.where('company.company_name LIKE :search OR company.cui LIKE :search', { search: `%${search}%` });
        if (status)
            qb.andWhere('company.status = :status', { status });
        const offset = (page - 1) * limit;
        const [companies, total] = await qb.orderBy('company.created_at', 'DESC').skip(offset).take(limit).getManyAndCount();
        return { companies, total, totalPages: Math.ceil(total / limit) };
    }
    async findCompanyById(id) {
        const company = await this.companyRepository.findOne({ where: { id }, relations: ['documents'] });
        if (!company)
            throw new common_1.NotFoundException(`Compania cu ID-ul ${id} nu a fost găsită`);
        return company;
    }
    async findCompanyByCui(cui) {
        const company = await this.companyRepository.findOne({ where: { cui }, relations: ['documents'] });
        if (!company)
            throw new common_1.NotFoundException(`Compania cu CUI-ul ${cui} nu a fost găsită`);
        return company;
    }
    async updateCompany(id, dto) {
        const company = await this.findCompanyById(id);
        if (dto.cui && dto.cui !== company.cui) {
            const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
            if (existing)
                throw new common_1.ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
        }
        Object.assign(company, dto);
        return await this.companyRepository.save(company);
    }
    async removeCompany(id) {
        const company = await this.findCompanyById(id);
        await this.companyRepository.remove(company);
    }
    async createCompanyDocument(dto) {
        await this.findCompanyById(dto.company_id);
        const document = this.companyDocumentRepository.create(dto);
        return await this.companyDocumentRepository.save(document);
    }
    async findCompanyDocuments(companyId) {
        await this.findCompanyById(companyId);
        return await this.companyDocumentRepository.find({ where: { company_id: companyId }, relations: ['company'], order: { upload_date: 'DESC' } });
    }
    async findDocumentById(documentId) {
        const document = await this.companyDocumentRepository.findOne({ where: { id: documentId }, relations: ['company'] });
        if (!document)
            throw new common_1.NotFoundException(`Documentul cu ID-ul ${documentId} nu a fost găsit`);
        return document;
    }
    async updateCompanyDocument(documentId, dto) {
        const document = await this.findDocumentById(documentId);
        Object.assign(document, dto);
        return await this.companyDocumentRepository.save(document);
    }
    async removeCompanyDocument(documentId) {
        const document = await this.findDocumentById(documentId);
        await this.companyDocumentRepository.remove(document);
    }
    async getCompanyStatistics() {
        const total = await this.companyRepository.count();
        const active = await this.companyRepository.count({ where: { status: 'activ' } });
        const inactive = await this.companyRepository.count({ where: { status: 'inactiv' } });
        const vat_payers = await this.companyRepository.count({ where: { vat_payer: true } });
        return { total, active, inactive, vat_payers };
    }
};
exports.CompanyService = CompanyService;
exports.CompanyService = CompanyService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __param(1, (0, typeorm_1.InjectRepository)(company_document_entity_1.CompanyDocument)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CompanyService);
//# sourceMappingURL=company.service.js.map