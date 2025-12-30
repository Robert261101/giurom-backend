import { RecipeCategory } from './recipe-category.entity';
import { RecipeProduct } from './recipe-product.entity';
import { RecipePreparation } from './recipe-preparation.entity';
import { RecipeMedia } from './recipe-media.entity';
import { RecipeRecipe } from './recipe-recipe.entity';
export declare class Recipe {
    id: number;
    name: string;
    description: string;
    category_id: number;
    location_id?: number;
    created_at: Date;
    updated_at: Date;
    expiration_hours: number;
    quantity: number;
    video_link: string | null;
    is_consumable: boolean;
    category: RecipeCategory;
    recipe_products: RecipeProduct[];
    recipe_recipes: RecipeRecipe[];
    recipe_preparations: RecipePreparation[];
    recipeMedia: RecipeMedia[];
}
