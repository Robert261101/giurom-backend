import { CreateSupplierDto } from './create-supplier.dto';
export declare class CreateSupplierDocumentDto {
    fileName?: string;
    name?: string;
    id?: string;
    note?: string;
    notes?: string;
    content?: string;
    type?: string;
    size?: number;
}
export declare class CreateSupplierWithDocumentsDto extends CreateSupplierDto {
    folderName?: string;
    documents?: CreateSupplierDocumentDto[];
}
