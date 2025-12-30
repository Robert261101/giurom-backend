export declare class CreateRecipeDto {
    name: string;
    description: string;
    category_id: number;
    location_id?: number;
    expiration_hours: number;
    quantity: number;
    video_link?: string;
    is_consumable?: boolean;
}
