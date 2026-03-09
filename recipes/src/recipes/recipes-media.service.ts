import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { RecipeMedia } from './entities/recipe-media.entity';
import { Recipe } from './entities/recipe.entity';
import { CreateRecipeMediaDto } from './dto/create-recipe-media.dto';

@Injectable()
export class RecipeMediaService {
  constructor(
    @InjectRepository(RecipeMedia)
    private mediaRepository: Repository<RecipeMedia>,
    @InjectRepository(Recipe)
    private recipeRepository: Repository<Recipe>,
  ) {}

  /**
   * Repo root – unde stau images/ (același ca products, tasks).
   * Pe server setează REPO_ROOT=/home/giurombitap ca să salvezi în /home/giurombitap/images/recipes.
   */
  private getRepoRoot(): string {
    const fromEnv = (process.env.REPO_ROOT || process.env.IMAGES_ROOT || '').trim();
    if (fromEnv) return fromEnv;
    return path.resolve(__dirname, '../../../..');
  }

  /** Director vechi: files/recipes (pentru compatibilitate cu înregistrări existente). */
  private getRecipesFilesRootDir(): string {
    return path.join(this.getRepoRoot(), 'files', 'recipes');
  }

  /** Director images/recipes – același pattern ca images/products, images/tasks. */
  private getRecipesImagesDir(): string {
    return path.join(this.getRepoRoot(), 'images', 'recipes');
  }

  private isNewImagesPath(fileLink: string): boolean {
    return fileLink?.includes('/api/images/recipes/') ?? false;
  }

  // Creează un nou fișier media pentru rețetă
  async createMedia(createMediaDto: CreateRecipeMediaDto): Promise<RecipeMedia> {
    console.log('📥 Received createMediaDto:', {
      recipe_id: createMediaDto.recipe_id,
      file_name: createMediaDto.file_name,
      file_type: createMediaDto.file_type,
      has_content: !!createMediaDto.file_content,
      content_length: createMediaDto.file_content?.length || 0
    });
    
    // Verifică dacă rețeta există
    const recipe = await this.recipeRepository.findOne({
      where: { id: createMediaDto.recipe_id }
    });

    if (!recipe) {
      throw new NotFoundException(`Rețeta cu ID-ul ${createMediaDto.recipe_id} nu a fost găsită`);
    }

    // Nume unic: timestamp + nume original (același pattern ca la produse în images/products)
    const timestamp = Date.now();
    const fileExtension = createMediaDto.file_name.split('.').pop() || 'jpg';
    const baseFileName = createMediaDto.file_name.replace(/\.[^/.]+$/, '') || 'recipe-media';
    const uniqueFileName = `${timestamp}_${baseFileName}.${fileExtension}`;

    // Salvare în images/recipes/ (același pattern ca images/products)
    const imagesDir = this.getRecipesImagesDir();
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`📁 Created images/recipes directory: ${imagesDir}`);
    }

    const fileLink = `/api/images/recipes/${uniqueFileName}`;

    if (createMediaDto.file_content) {
      try {
        const filePath = path.join(imagesDir, uniqueFileName);
        let base64Data = createMediaDto.file_content;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ Recipe image saved: ${filePath} (${buffer.length} bytes)`);
      } catch (error: any) {
        console.error('❌ Error saving recipe image:', error);
        throw new BadRequestException(`Eroare la salvarea imaginii: ${error.message}`);
      }
    }

    const existingFile = await this.mediaRepository.findOne({
      where: {
        recipe_id: createMediaDto.recipe_id,
        file_name: uniqueFileName,
      },
    });
    if (existingFile) {
      throw new ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru această rețetă`);
    }

    const media = this.mediaRepository.create({
      ...createMediaDto,
      file_name: uniqueFileName,
      file_link: fileLink,
    });

    const savedMedia = await this.mediaRepository.save(media);
    console.log(`✅ Media record saved to database with ID: ${savedMedia.id}`);
    
    return savedMedia;
  }

  // Găsește un fișier media după ID
  async findOneMedia(id: number): Promise<RecipeMedia> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['recipe'],
    });

    if (!media) {
      throw new NotFoundException(`Fișierul media cu ID-ul ${id} nu a fost găsit`);
    }

    return media;
  }

  // Găsește toate fișierele media ale unei rețete
  async findMediaByRecipe(recipe_id: number): Promise<RecipeMedia[]> {
    const recipe = await this.recipeRepository.findOne({
      where: { id: recipe_id }
    });

    if (!recipe) {
      throw new NotFoundException(`Rețeta cu ID-ul ${recipe_id} nu a fost găsită`);
    }

    return await this.mediaRepository.find({
      where: { recipe_id },
      relations: ['recipe'],
      order: { updated_at: 'DESC' },
    });
  }

  async serveMedia(media_id: number): Promise<{ data: string; mimeType: string; fileName: string }> {
    const media = await this.findOneMedia(media_id);
    let filePath: string;
    if (this.isNewImagesPath(media.file_link)) {
      const fileName = media.file_link.replace(/^.*\/api\/images\/recipes\//, '').split('?')[0];
      filePath = path.join(this.getRecipesImagesDir(), fileName);
    } else {
      filePath = path.join(this.getRecipesFilesRootDir(), media.recipe_id.toString(), media.file_name);
    }
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
    }
    const mimeType = this.getMimeType(media.file_name);
    const fileBuffer = fs.readFileSync(filePath);
    return {
      data: fileBuffer.toString('base64'),
      mimeType,
      fileName: media.file_name,
    };
  }

  // Determină tipul MIME bazat pe extensia fișierului
  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  async removeMedia(id: number): Promise<{ message: string }> {
    const media = await this.findOneMedia(id);
    try {
      let filePath: string;
      if (this.isNewImagesPath(media.file_link)) {
        const fileName = media.file_link.replace(/^.*\/api\/images\/recipes\//, '').split('?')[0];
        filePath = path.join(this.getRecipesImagesDir(), fileName);
      } else {
        filePath = path.join(this.getRecipesFilesRootDir(), media.recipe_id.toString(), media.file_name);
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('❌ Error deleting file from disk:', error);
    }
    await this.mediaRepository.delete(id);
    return {
      message: `Fișierul media "${media.file_name}" al rețetei ${media.recipe.name} a fost șters cu succes`,
    };
  }
}