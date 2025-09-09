import { RecipeCategory } from './recipe-category.entity';
import { RecipeProduct } from './recipe-product.entity';
export declare class Recipe {
    id: number;
    name: string;
    description: string;
    category_id: number;
    created_at: Date;
    updated_at: Date;
    expiration_hours: number;
    quantity: number;
    category: RecipeCategory;
    recipe_products: RecipeProduct[];
}
