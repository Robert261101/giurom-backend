import { Recipe } from './recipe.entity';
export declare class RecipeCategory {
    id: number;
    name: string;
    created_at: Date;
    updated_at: Date;
    recipes: Recipe[];
}
