import { CompanyDocument } from './company-document.entity';
export declare class Company {
    id: number;
    company_name: string;
    cui: string;
    trade_register_number: string;
    address: string;
    city: string;
    county: string;
    postal_code: string | null;
    country: string;
    phone_number: string | null;
    email: string | null;
    incorporation_date: Date;
    legal_form: string;
    activity_code: string;
    vat_payer: boolean;
    bank_name: string | null;
    bank_account_number: string | null;
    website: string | null;
    status: string;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
    documents: CompanyDocument[];
}
