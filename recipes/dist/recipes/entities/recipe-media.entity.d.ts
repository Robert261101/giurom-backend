import { Recipe } from './recipe.entity';
export declare class RecipeMedia {
    id: number;
    recipe_id: number;
    file_name: string;
    file_type: string;
    file_link: string;
    updated_at: Date;
    recipe: Recipe;
}
