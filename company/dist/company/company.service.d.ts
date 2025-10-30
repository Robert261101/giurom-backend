import { Repository } from 'typeorm';
import { Company } from './entity/company.entity';
import { CompanyDocument } from './entity/company-document.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyDocumentDto } from './dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './dto/update-company-document.dto';
export declare class CompanyService {
    private readonly companyRepository;
    private readonly companyDocumentRepository;
    constructor(companyRepository: Repository<Company>, companyDocumentRepository: Repository<CompanyDocument>);
    createCompany(dto: CreateCompanyDto): Promise<Company>;
    createCompanyWithDocuments(dto: CreateCompanyWithDocumentsDto): Promise<Company>;
    findAllCompanies(page?: number, limit?: number, search?: string, status?: string): Promise<{
        companies: Company[];
        total: number;
        totalPages: number;
    }>;
    findCompanyById(id: number): Promise<Company>;
    findCompanyByCui(cui: string): Promise<Company>;
    updateCompany(id: number, dto: UpdateCompanyDto): Promise<Company>;
    removeCompany(id: number): Promise<void>;
    createCompanyDocument(dto: CreateCompanyDocumentDto): Promise<CompanyDocument>;
    findCompanyDocuments(companyId: number): Promise<CompanyDocument[]>;
    findDocumentById(documentId: number): Promise<CompanyDocument>;
    updateCompanyDocument(documentId: number, dto: UpdateCompanyDocumentDto): Promise<CompanyDocument>;
    removeCompanyDocument(documentId: number): Promise<void>;
    getCompanyStatistics(): Promise<{
        total: number;
        active: number;
        inactive: number;
        vat_payers: number;
    }>;
}
