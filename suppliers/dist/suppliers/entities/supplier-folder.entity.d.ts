import { Supplier } from './supplier.entity';
import { SupplierDocument } from './supplier-document.entity';
export declare class SupplierFolder {
    id: number;
    supplier_id: number;
    description: string;
    folder_path: string;
    created_at: Date;
    updated_at: Date;
    supplier: Supplier;
    documents: SupplierDocument[];
}
