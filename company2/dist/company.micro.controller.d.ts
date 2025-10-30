import { CompanyService } from './company/company.service';
import { CreateCompanyDto } from './company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from './company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './company/dto/update-company-document.dto';
export declare class CompanyMicroController {
    private readonly companyService;
    constructor(companyService: CompanyService);
    create(dto: CreateCompanyDto): Promise<import("./company/entity/company.entity").Company>;
    createWithDocuments(dto: CreateCompanyWithDocumentsDto): Promise<import("./company/entity/company.entity").Company>;
    findAll(payload: {
        page: number;
        limit: number;
        search?: string;
        status?: string;
    }): Promise<{
        companies: import("./company/entity/company.entity").Company[];
        total: number;
        totalPages: number;
    }>;
    statistics(): Promise<{
        total: number;
        active: number;
        inactive: number;
        vat_payers: number;
    }>;
    findById(id: number): Promise<import("./company/entity/company.entity").Company>;
    findByCui(cui: string): Promise<import("./company/entity/company.entity").Company>;
    update(payload: {
        id: number;
        dto: UpdateCompanyDto;
    }): Promise<import("./company/entity/company.entity").Company>;
    remove(id: number): Promise<void>;
    createDocument(dto: CreateCompanyDocumentDto): Promise<import("./company/entity/company-document.entity").CompanyDocument>;
    findCompanyDocuments(companyId: number): Promise<import("./company/entity/company-document.entity").CompanyDocument[]>;
    findDocumentById(documentId: number): Promise<import("./company/entity/company-document.entity").CompanyDocument>;
    updateDocument(payload: {
        documentId: number;
        dto: UpdateCompanyDocumentDto;
    }): Promise<import("./company/entity/company-document.entity").CompanyDocument>;
    removeDocument(documentId: number): Promise<void>;
}
