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

  private getRecipesFilesRootDir(): string {
    // Resolve repo root relative to this file location
    const repoRoot = path.resolve(__dirname, '../../../..');
    const fullPath = path.join(repoRoot, 'files', 'recipes');
    console.log(`📁 Recipes files root directory: ${fullPath}`);
    return fullPath;
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

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileExtension = createMediaDto.file_name.split('.').pop() || 'jpg';
    const baseFileName = createMediaDto.file_name.replace(/\.[^/.]+$/, "") || 'recipe-media';
    const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

    console.log(`📝 Original: ${createMediaDto.file_name}, Generated: ${uniqueFileName}`);

    // Update the file_link to use the unique filename
    const updatedFileLink = createMediaDto.file_link.replace(createMediaDto.file_name, uniqueFileName);

    // Create the directory if it doesn't exist
    const recipeId = createMediaDto.recipe_id?.toString() || 'unknown';
    console.log(`📁 Creating directory for recipe ID: ${recipeId}`);
    const baseDir = this.getRecipesFilesRootDir();
    const fileDir = path.join(baseDir, recipeId);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // If file content is provided (base64), save it to disk
    if (createMediaDto.file_content) {
      try {
        const filePath = path.join(fileDir, uniqueFileName);
        
        // Extract base64 content from data URL (remove data:type;base64, prefix)
        let base64Data = createMediaDto.file_content;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        
        console.log(`💾 Saving file with ${base64Data.length} base64 characters`);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ File saved to disk: ${filePath} (${buffer.length} bytes)`);
      } catch (error: any) {
        console.error('❌ Error saving file to disk:', error);
        // Re-throw the error so the caller knows the file save failed
        throw new BadRequestException(`Failed to save file to disk: ${error.message}`);
      }
    }

    // Verifică dacă există deja un fișier cu același nume pentru aceeași rețetă
    const existingFile = await this.mediaRepository.findOne({
      where: {
        recipe_id: createMediaDto.recipe_id,
        file_name: uniqueFileName
      }
    });

    if (existingFile) {
      throw new ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru această rețetă`);
    }

    // Create the media record with unique filename
    const media = this.mediaRepository.create({
      ...createMediaDto,
      file_name: uniqueFileName,
      file_link: updatedFileLink
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

  // Servește fișierul media de pe disk
  async serveMedia(media_id: number): Promise<{ data: string; mimeType: string; fileName: string }> {
    console.log(`🔍 Serving media with ID: ${media_id}`);
    
    const media = await this.findOneMedia(media_id);
    console.log(`📄 Media metadata:`, {
      id: media.id,
      name: media.file_name,
      recipe_id: media.recipe_id,
      file_link: media.file_link
    });
    
    const baseDir = this.getRecipesFilesRootDir();
    const filePath = path.join(baseDir, media.recipe_id.toString(), media.file_name);
    console.log(`📁 Serving file from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found on disk: ${filePath}`);
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
    }
    
    const mimeType = this.getMimeType(media.file_name);
    console.log(`📋 MIME type determined: ${mimeType}`);
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`✅ File read successfully: ${media.file_name} (${fileBuffer.length} bytes)`);

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

  // Șterge un fișier media
  async removeMedia(id: number): Promise<{ message: string }> {
    const media = await this.findOneMedia(id);
    
    // Remove file from disk
    try {
      const baseDir = this.getRecipesFilesRootDir();
      const filePath = path.join(baseDir, media.recipe_id.toString(), media.file_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ File deleted from disk: ${filePath}`);
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