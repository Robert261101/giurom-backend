import { SupplierFolder } from './supplier-folder.entity';
export declare enum DocumentType {
    CONTRACT = "contract",
    INVOICE = "invoice",
    CERTIFICATE = "certificate",
    ORDER = "order",
    OTHER = "other"
}
export declare class SupplierDocument {
    id: number;
    folder_id: number;
    document_type: DocumentType;
    file_name: string;
    file_path: string;
    expire_date: Date | null;
    notes?: string;
    created_at: Date;
    updated_at: Date;
    folder: SupplierFolder;
}
