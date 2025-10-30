export declare class Employee {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    hire_date: Date;
    termination_date: Date;
    contract_type: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    get full_name(): string;
}
