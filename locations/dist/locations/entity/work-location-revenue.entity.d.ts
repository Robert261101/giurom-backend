export declare enum RevenueStatus {
    Pending = "pending",
    Approved = "approved",
    Canceled = "canceled"
}
export declare class WorkLocationRevenue {
    id: number;
    work_location_id: number;
    revenue_date: string;
    online_amount: number;
    cash_amount: number;
    card_amount: number;
    total_amount: number;
    status?: RevenueStatus;
    image_url?: string;
    user_id?: number;
}
