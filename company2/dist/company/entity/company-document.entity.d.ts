import { Company } from './company.entity';
export declare class CompanyDocument {
    id: number;
    company_id: number;
    document_name: string;
    document_type: string;
    location_path: string;
    upload_date: Date;
    notes: string | null;
    company: Company;
}
