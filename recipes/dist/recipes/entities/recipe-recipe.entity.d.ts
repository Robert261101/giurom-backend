import { Recipe } from './recipe.entity';
export declare class RecipeRecipe {
    id: number;
    recipe_id: number;
    ingredient_recipe_id: number;
    quantity: number;
    notes: string;
    created_at: Date;
    updated_at: Date;
    recipe: Recipe;
    ingredient_recipe: Recipe;
}
