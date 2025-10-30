import { CompanyService } from './company/company.service';
import { CreateCompanyDto } from './company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from './company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './company/dto/update-company-document.dto';
export declare class CompanyHttpController {
    private readonly service;
    constructor(service: CompanyService);
    create(dto: CreateCompanyDto): Promise<import("./company/entity/company.entity").Company>;
    createWithDocs(dto: CreateCompanyWithDocumentsDto): Promise<import("./company/entity/company.entity").Company>;
    findAll(page?: string, limit?: string, search?: string, status?: string): Promise<{
        companies: import("./company/entity/company.entity").Company[];
        total: number;
        totalPages: number;
    }>;
    stats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        vat_payers: number;
    }>;
    findOne(id: string): Promise<import("./company/entity/company.entity").Company>;
    findByCui(cui: string): Promise<import("./company/entity/company.entity").Company>;
    update(id: string, dto: UpdateCompanyDto): Promise<import("./company/entity/company.entity").Company>;
    remove(id: string): Promise<void>;
    getDocs(companyId: string): Promise<import("./company/entity/company-document.entity").CompanyDocument[]>;
    getDoc(documentId: string): Promise<import("./company/entity/company-document.entity").CompanyDocument>;
    createDoc(companyId: string, dto: Omit<CreateCompanyDocumentDto, 'company_id'>): Promise<import("./company/entity/company-document.entity").CompanyDocument>;
    updateDoc(documentId: string, dto: UpdateCompanyDocumentDto): Promise<import("./company/entity/company-document.entity").CompanyDocument>;
    removeDoc(documentId: string): Promise<void>;
}
