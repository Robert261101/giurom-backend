import { Recipe } from './recipe.entity';
export declare class RecipeLocation {
    id: number;
    recipeId: number;
    idLocation: number;
    isConsumable: boolean;
    createdAt: Date;
    updatedAt: Date;
    recipe: Recipe;
}
