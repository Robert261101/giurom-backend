import { Recipe } from './recipe.entity';
import { ProductRef } from '../../external/product-ref.entity';
export declare class RecipeProduct {
    id: number;
    recipe_id: number;
    product_id: number;
    quantity: number;
    notes: string;
    created_at: Date;
    updated_at: Date;
    recipe: Recipe;
    product?: ProductRef | null;
}
