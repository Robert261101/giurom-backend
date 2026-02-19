import { SupplierFolder } from './supplier-folder.entity';
import { SupplierProduct } from './supplier-product.entity';
import { SupplierOrder } from './supplier-order.entity';
export declare class Supplier {
    id: number;
    supplier_name: string;
    registration_number: string;
    vat_number: string;
    address: string;
    city: string;
    region: string;
    country: string;
    postal_code: string;
    phone: string;
    email: string;
    contact_person: string;
    bank_name: string | null;
    bank_account_number: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    folders: SupplierFolder[];
    products: SupplierProduct[];
    orders: SupplierOrder[];
    locations: any[];
}
