export declare class CreateSupplierDto {
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
    bank_name?: string;
    bank_account_number?: string;
    is_active?: boolean;
    location_id?: number;
}
