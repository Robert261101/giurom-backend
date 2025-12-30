import { Recipe } from './recipe.entity';
import { RecipeLabel } from './recipe-label.entity';
export declare class RecipePreparation {
    id: number;
    recipe_id: number;
    produced_by?: number;
    location_id?: number;
    quantity: number;
    produced_at: Date;
    is_labeled: boolean;
    is_consumable: boolean;
    created_at: Date;
    updated_at: Date;
    recipe: Recipe;
    labels: RecipeLabel[];
}
