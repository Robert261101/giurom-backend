import { Supplier } from './supplier.entity';
export declare class WorkLocation {
    id: number;
    company_id: number;
    location_name: string;
    address: string;
    city: string;
}
export declare class SupplierLocations {
    id: number;
    supplier_id: number;
    id_location: number;
    created_at: Date;
    updated_at: Date;
    supplier: Supplier;
    workLocation?: WorkLocation;
}
