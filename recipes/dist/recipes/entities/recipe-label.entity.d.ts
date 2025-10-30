import { RecipePreparation } from './recipe-preparation.entity';
export declare class RecipeLabel {
    id: number;
    recipe_preparation_id: number;
    label_code: string;
    label_file_path: string;
    generated_at: Date;
    preparation: RecipePreparation;
}
