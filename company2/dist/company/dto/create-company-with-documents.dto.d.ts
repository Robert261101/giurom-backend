import { CreateCompanyDto } from './create-company.dto';
export declare class CreateCompanyDocumentUploadDto {
    fileName?: string;
    name?: string;
    id?: string;
    document_type?: string;
    note?: string;
    notes?: string;
    content?: string;
    type?: string;
    size?: number;
}
export declare class CreateCompanyWithDocumentsDto extends CreateCompanyDto {
    documents?: CreateCompanyDocumentUploadDto[];
}
