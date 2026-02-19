import { Supplier } from './supplier.entity';
import { SupplierDocument } from './supplier-document.entity';
export declare class SupplierFolder {
    id: number;
    supplier_id: number;
    description: string;
    folder_path: string;
    parent_id: number | null;
    created_at: Date;
    updated_at: Date;
    supplier: Supplier;
    parent: SupplierFolder | null;
    children: SupplierFolder[];
    documents: SupplierDocument[];
}
