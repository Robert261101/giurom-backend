import { Repository } from 'typeorm';
import { RecipeMedia } from './entities/recipe-media.entity';
import { Recipe } from './entities/recipe.entity';
import { CreateRecipeMediaDto } from './dto/create-recipe-media.dto';
export declare class RecipeMediaService {
    private mediaRepository;
    private recipeRepository;
    constructor(mediaRepository: Repository<RecipeMedia>, recipeRepository: Repository<Recipe>);
    private getRecipesFilesRootDir;
    createMedia(createMediaDto: CreateRecipeMediaDto): Promise<RecipeMedia>;
    findOneMedia(id: number): Promise<RecipeMedia>;
    findMediaByRecipe(recipe_id: number): Promise<RecipeMedia[]>;
    serveMedia(media_id: number): Promise<{
        data: string;
        mimeType: string;
        fileName: string;
    }>;
    private getMimeType;
    removeMedia(id: number): Promise<{
        message: string;
    }>;
}
