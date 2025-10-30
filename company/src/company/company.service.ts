import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entity/company.entity';
import { CompanyDocument } from './entity/company-document.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyDocumentDto } from './dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './dto/update-company-document.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company) private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyDocument) private readonly companyDocumentRepository: Repository<CompanyDocument>,
  ) {}

  async createCompany(dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
    if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    const company = this.companyRepository.create(dto);
    return await this.companyRepository.save(company);
  }

  async createCompanyWithDocuments(dto: CreateCompanyWithDocumentsDto): Promise<Company> {
    const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
    if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    const { documents, ...companyData } = dto as any;
    const companyEntity: Company = this.companyRepository.create(companyData as Partial<Company>);
    const saved: Company = await this.companyRepository.save(companyEntity);
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

  async findAllCompanies(page = 1, limit = 10, search?: string, status?: string): Promise<{ companies: Company[]; total: number; totalPages: number }> {
    const qb = this.companyRepository.createQueryBuilder('company').leftJoinAndSelect('company.documents', 'documents');
    if (search) qb.where('company.company_name LIKE :search OR company.cui LIKE :search', { search: `%${search}%` });
    if (status) qb.andWhere('company.status = :status', { status });
    const offset = (page - 1) * limit;
    const [companies, total] = await qb.orderBy('company.created_at', 'DESC').skip(offset).take(limit).getManyAndCount();
    return { companies, total, totalPages: Math.ceil(total / limit) };
  }

  async findCompanyById(id: number): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id }, relations: ['documents'] });
    if (!company) throw new NotFoundException(`Compania cu ID-ul ${id} nu a fost găsită`);
    return company;
  }

  async findCompanyByCui(cui: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { cui }, relations: ['documents'] });
    if (!company) throw new NotFoundException(`Compania cu CUI-ul ${cui} nu a fost găsită`);
    return company;
  }

  async updateCompany(id: number, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findCompanyById(id);
    if (dto.cui && dto.cui !== company.cui) {
      const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
      if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    }
    Object.assign(company, dto);
    return await this.companyRepository.save(company);
  }

  async removeCompany(id: number): Promise<void> {
    const company = await this.findCompanyById(id);
    await this.companyRepository.remove(company);
  }

  async createCompanyDocument(dto: CreateCompanyDocumentDto): Promise<CompanyDocument> {
    await this.findCompanyById(dto.company_id);
    const document = this.companyDocumentRepository.create(dto);
    return await this.companyDocumentRepository.save(document);
  }

  async findCompanyDocuments(companyId: number): Promise<CompanyDocument[]> {
    await this.findCompanyById(companyId);
    return await this.companyDocumentRepository.find({ where: { company_id: companyId }, relations: ['company'], order: { upload_date: 'DESC' } });
  }

  async findDocumentById(documentId: number): Promise<CompanyDocument> {
    const document = await this.companyDocumentRepository.findOne({ where: { id: documentId }, relations: ['company'] });
    if (!document) throw new NotFoundException(`Documentul cu ID-ul ${documentId} nu a fost găsit`);
    return document;
  }

  async updateCompanyDocument(documentId: number, dto: UpdateCompanyDocumentDto): Promise<CompanyDocument> {
    const document = await this.findDocumentById(documentId);
    Object.assign(document, dto);
    return await this.companyDocumentRepository.save(document);
  }

  async removeCompanyDocument(documentId: number): Promise<void> {
    const document = await this.findDocumentById(documentId);
    await this.companyDocumentRepository.remove(document);
  }

  async getCompanyStatistics(): Promise<{ total: number; active: number; inactive: number; vat_payers: number }> {
    const total = await this.companyRepository.count();
    const active = await this.companyRepository.count({ where: { status: 'activ' } });
    const inactive = await this.companyRepository.count({ where: { status: 'inactiv' } });
    const vat_payers = await this.companyRepository.count({ where: { vat_payer: true } });
    return { total, active, inactive, vat_payers };
  }
} 