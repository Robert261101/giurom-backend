"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeMediaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = require("fs");
const path = require("path");
const recipe_media_entity_1 = require("./entities/recipe-media.entity");
const recipe_entity_1 = require("./entities/recipe.entity");
let RecipeMediaService = class RecipeMediaService {
    constructor(mediaRepository, recipeRepository) {
        this.mediaRepository = mediaRepository;
        this.recipeRepository = recipeRepository;
    }
    getRecipesFilesRootDir() {
        const repoRoot = path.resolve(__dirname, '../../../..');
        const fullPath = path.join(repoRoot, 'files', 'recipes');
        console.log(`📁 Recipes files root directory: ${fullPath}`);
        return fullPath;
    }
    async createMedia(createMediaDto) {
        console.log('📥 Received createMediaDto:', {
            recipe_id: createMediaDto.recipe_id,
            file_name: createMediaDto.file_name,
            file_type: createMediaDto.file_type,
            has_content: !!createMediaDto.file_content,
            content_length: createMediaDto.file_content?.length || 0
        });
        const recipe = await this.recipeRepository.findOne({
            where: { id: createMediaDto.recipe_id }
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Rețeta cu ID-ul ${createMediaDto.recipe_id} nu a fost găsită`);
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileExtension = createMediaDto.file_name.split('.').pop() || 'jpg';
        const baseFileName = createMediaDto.file_name.replace(/\.[^/.]+$/, "") || 'recipe-media';
        const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;
        console.log(`📝 Original: ${createMediaDto.file_name}, Generated: ${uniqueFileName}`);
        const updatedFileLink = createMediaDto.file_link.replace(createMediaDto.file_name, uniqueFileName);
        const recipeId = createMediaDto.recipe_id?.toString() || 'unknown';
        console.log(`📁 Creating directory for recipe ID: ${recipeId}`);
        const baseDir = this.getRecipesFilesRootDir();
        const fileDir = path.join(baseDir, recipeId);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        if (createMediaDto.file_content) {
            try {
                const filePath = path.join(fileDir, uniqueFileName);
                let base64Data = createMediaDto.file_content;
                if (base64Data.includes(',')) {
                    base64Data = base64Data.split(',')[1];
                }
                console.log(`💾 Saving file with ${base64Data.length} base64 characters`);
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(filePath, buffer);
                console.log(`✅ File saved to disk: ${filePath} (${buffer.length} bytes)`);
            }
            catch (error) {
                console.error('❌ Error saving file to disk:', error);
                throw new common_1.BadRequestException(`Failed to save file to disk: ${error.message}`);
            }
        }
        const existingFile = await this.mediaRepository.findOne({
            where: {
                recipe_id: createMediaDto.recipe_id,
                file_name: uniqueFileName
            }
        });
        if (existingFile) {
            throw new common_1.ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru această rețetă`);
        }
        const media = this.mediaRepository.create({
            ...createMediaDto,
            file_name: uniqueFileName,
            file_link: updatedFileLink
        });
        const savedMedia = await this.mediaRepository.save(media);
        console.log(`✅ Media record saved to database with ID: ${savedMedia.id}`);
        return savedMedia;
    }
    async findOneMedia(id) {
        const media = await this.mediaRepository.findOne({
            where: { id },
            relations: ['recipe'],
        });
        if (!media) {
            throw new common_1.NotFoundException(`Fișierul media cu ID-ul ${id} nu a fost găsit`);
        }
        return media;
    }
    async findMediaByRecipe(recipe_id) {
        const recipe = await this.recipeRepository.findOne({
            where: { id: recipe_id }
        });
        if (!recipe) {
            throw new common_1.NotFoundException(`Rețeta cu ID-ul ${recipe_id} nu a fost găsită`);
        }
        return await this.mediaRepository.find({
            where: { recipe_id },
            relations: ['recipe'],
            order: { updated_at: 'DESC' },
        });
    }
    async serveMedia(media_id) {
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
            throw new common_1.NotFoundException('Fișierul nu a fost găsit pe disk');
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
    getMimeType(fileName) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
        };
        return mimeTypes[extension || ''] || 'application/octet-stream';
    }
    async removeMedia(id) {
        const media = await this.findOneMedia(id);
        try {
            const baseDir = this.getRecipesFilesRootDir();
            const filePath = path.join(baseDir, media.recipe_id.toString(), media.file_name);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`✅ File deleted from disk: ${filePath}`);
            }
        }
        catch (error) {
            console.error('❌ Error deleting file from disk:', error);
        }
        await this.mediaRepository.delete(id);
        return {
            message: `Fișierul media "${media.file_name}" al rețetei ${media.recipe.name} a fost șters cu succes`,
        };
    }
};
exports.RecipeMediaService = RecipeMediaService;
exports.RecipeMediaService = RecipeMediaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recipe_media_entity_1.RecipeMedia)),
    __param(1, (0, typeorm_1.InjectRepository)(recipe_entity_1.Recipe)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], RecipeMediaService);
//# sourceMappingURL=recipes-media.service.js.map