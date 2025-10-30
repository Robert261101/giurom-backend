export declare class CreateWorkLocationDto {
    company_id: number;
    location_name: string;
    address: string;
    city: string;
    county: string;
    postal_code?: string;
    country?: string;
    phone_number?: string;
    email?: string;
    employee_id?: number;
    notes?: string;
    gps_lat?: number;
    gps_lng?: number;
    gps_radius_m?: number;
    points?: number;
}
