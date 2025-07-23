import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  ParseIntPipe,
  Req,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CreateRecipeIngredientDto } from './dto/create-recipe-ingredient.dto';
import { UpdateRecipeIngredientDto } from './dto/update-recipe-ingredient.dto';
import { Recipe, DifficultyLevel } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';

@ApiTags('recipes')
@Controller('recipes')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
@ApiExtraModels(Recipe, RecipeCategory, Ingredient, RecipeIngredient)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  // RECIPE CATEGORY ENDPOINTS
  @Post('categories')
  @ApiOperation({
    summary: 'Creează o nouă categorie de rețete',
    description: 'Creează o categorie nouă pentru organizarea rețetelor cu validare de unicitate.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Categoria a fost creată cu succes',
    type: RecipeCategory,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Categoria cu acest nume există deja',
  })
  async createRecipeCategory(@Body() createCategoryDto: CreateRecipeCategoryDto): Promise<RecipeCategory> {
    return await this.recipesService.createRecipeCategory(createCategoryDto);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Listează toate categoriile de rețete',
    description: 'Returnează o listă paginată cu toate categoriile de rețete cu opțiuni de căutare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 })
  @ApiQuery({ name: 'search', required: false, description: 'Căutare după numele categoriei', example: 'supe' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista categoriilor a fost returnată cu succes',
  })
  async findAllRecipeCategories(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.recipesService.findAllRecipeCategories(pageNum, limitNum, search);
  }

  @Get('categories/:id')
  @ApiOperation({
    summary: 'Obține o categorie după ID',
    description: 'Returnează detaliile complete ale unei categorii inclusiv rețetele asociate.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul categoriei', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoria a fost găsită cu succes',
    type: RecipeCategory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoria nu a fost găsită',
  })
  async findRecipeCategoryById(@Param('id', ParseIntPipe) id: number): Promise<RecipeCategory> {
    return await this.recipesService.findRecipeCategoryById(id);
  }

  @Patch('categories/:id')
  @ApiOperation({
    summary: 'Actualizează o categorie de rețete',
    description: 'Actualizează datele unei categorii existente cu validare de unicitate.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul categoriei', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoria a fost actualizată cu succes',
    type: RecipeCategory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoria nu a fost găsită',
  })
  async updateRecipeCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateRecipeCategoryDto,
  ): Promise<RecipeCategory> {
    return await this.recipesService.updateRecipeCategory(id, updateCategoryDto);
  }

  @Delete('categories/:id')
  @ApiOperation({
    summary: 'Șterge o categorie de rețete',
    description: 'Șterge o categorie doar dacă nu are rețete asociate.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul categoriei', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Categoria a fost ștersă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Categoria nu poate fi ștersă pentru că are rețete asociate',
  })
  async deleteRecipeCategory(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.recipesService.deleteRecipeCategory(id);
  }

  // INGREDIENT ENDPOINTS
  @Post('ingredients')
  @ApiOperation({
    summary: 'Creează un nou ingredient',
    description: 'Adaugă un ingredient nou în baza de date cu validare de unicitate.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ingredientul a fost creat cu succes',
    type: Ingredient,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ingredientul cu acest nume există deja',
  })
  async createIngredient(@Body() createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    return await this.recipesService.createIngredient(createIngredientDto);
  }

  @Get('ingredients')
  @ApiOperation({
    summary: 'Listează toate ingredientele',
    description: 'Returnează o listă paginată cu toate ingredientele cu opțiuni de filtrare și căutare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 })
  @ApiQuery({ name: 'search', required: false, description: 'Căutare după numele ingredientului', example: 'cartofi' })
  @ApiQuery({ name: 'category', required: false, description: 'Filtrare după categoria ingredientului', example: 'legume' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista ingredientelor a fost returnată cu succes',
  })
  async findAllIngredients(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.recipesService.findAllIngredients(pageNum, limitNum, search, category);
  }

  @Get('ingredients/:id')
  @ApiOperation({
    summary: 'Obține un ingredient după ID',
    description: 'Returnează detaliile complete ale unui ingredient inclusiv rețetele în care este folosit.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul ingredientului', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ingredientul a fost găsit cu succes',
    type: Ingredient,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ingredientul nu a fost găsit',
  })
  async findIngredientById(@Param('id', ParseIntPipe) id: number): Promise<Ingredient> {
    return await this.recipesService.findIngredientById(id);
  }

  @Patch('ingredients/:id')
  @ApiOperation({
    summary: 'Actualizează un ingredient',
    description: 'Actualizează datele unui ingredient existent cu validare de unicitate.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul ingredientului', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ingredientul a fost actualizat cu succes',
    type: Ingredient,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ingredientul nu a fost găsit',
  })
  async updateIngredient(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateIngredientDto: UpdateIngredientDto,
  ): Promise<Ingredient> {
    return await this.recipesService.updateIngredient(id, updateIngredientDto);
  }

  @Delete('ingredients/:id')
  @ApiOperation({
    summary: 'Șterge un ingredient',
    description: 'Șterge un ingredient doar dacă nu este folosit în nicio rețetă.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul ingredientului', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Ingredientul a fost șters cu succes',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Ingredientul nu poate fi șters pentru că este folosit în rețete',
  })
  async deleteIngredient(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.recipesService.deleteIngredient(id);
  }

  // RECIPE ENDPOINTS
  @Post()
  @ApiOperation({
    summary: 'Creează o nouă rețetă',
    description: 'Creează o rețetă nouă cu validare completă a tuturor câmpurilor.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Rețeta a fost creată cu succes',
    type: Recipe,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru rețetă',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoria specificată nu a fost găsită',
  })
  async createRecipe(@Req() req: Request, @Body() createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    console.log('=== Request Debug Info ===');
    console.log('Headers:', req.headers);
    console.log('Raw body:', req.body);
    
    console.log('=== DTO Debug Info ===');
    console.log('Received DTO:', createRecipeDto);
    
    // Manual instantiation test
    const manualDto = new CreateRecipeDto();
    Object.assign(manualDto, req.body);
    console.log('Manual DTO:', manualDto);
    
    if (!createRecipeDto.name) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Debug Info',
        message: 'Name is missing',
        receivedBody: req.body,
        receivedDto: createRecipeDto,
        manualDto: manualDto
      });
    }

    return await this.recipesService.createRecipe(createRecipeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listează toate rețetele',
    description: 'Returnează o listă paginată cu toate rețetele cu opțiuni avansate de filtrare și căutare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 })
  @ApiQuery({ name: 'search', required: false, description: 'Căutare după numele sau descrierea rețetei', example: 'supă' })
  @ApiQuery({ name: 'category_id', required: false, description: 'Filtrare după categoria rețetei', example: 1 })
  @ApiQuery({ name: 'difficulty', required: false, enum: DifficultyLevel, description: 'Filtrare după dificultate' })
  @ApiQuery({ name: 'max_cooking_time', required: false, description: 'Timpul maxim de gătire în minute', example: 60 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista rețetelor a fost returnată cu succes',
  })
  async findAllRecipes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category_id') category_id?: string,
    @Query('difficulty') difficulty?: DifficultyLevel,
    @Query('max_cooking_time') max_cooking_time?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const categoryIdNum = category_id ? parseInt(category_id, 10) : undefined;
    const maxCookingTimeNum = max_cooking_time ? parseInt(max_cooking_time, 10) : undefined;
    return await this.recipesService.findAllRecipes(pageNum, limitNum, search, categoryIdNum, difficulty, maxCookingTimeNum);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obține o rețetă după ID',
    description: 'Returnează detaliile complete ale unei rețete inclusiv categoria și ingredientele.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul rețetei', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Rețeta a fost găsită cu succes',
    type: Recipe,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Rețeta nu a fost găsită',
  })
  async findRecipeById(@Param('id', ParseIntPipe) id: number): Promise<Recipe> {
    return await this.recipesService.findRecipeById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizează o rețetă',
    description: 'Actualizează datele unei rețete existente cu validare completă.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul rețetei', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Rețeta a fost actualizată cu succes',
    type: Recipe,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Rețeta nu a fost găsită',
  })
  async updateRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRecipeDto: UpdateRecipeDto,
  ): Promise<Recipe> {
    return await this.recipesService.updateRecipe(id, updateRecipeDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Șterge o rețetă',
    description: 'Șterge definitiv o rețetă și toate asocierile cu ingredientele.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul rețetei', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Rețeta a fost ștersă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Rețeta nu a fost găsită',
  })
  async deleteRecipe(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.recipesService.deleteRecipe(id);
  }

  // RECIPE INGREDIENT ENDPOINTS
  @Post('recipe-ingredients')
  @ApiOperation({
    summary: 'Adaugă un ingredient la o rețetă',
    description: 'Creează o asociere între o rețetă și un ingredient cu cantitatea specificată.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ingredientul a fost adăugat cu succes la rețetă',
    type: RecipeIngredient,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ingredientul este deja adăugat în rețetă',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Rețeta sau ingredientul nu a fost găsit',
  })
  async addIngredientToRecipe(@Body() createRecipeIngredientDto: CreateRecipeIngredientDto): Promise<RecipeIngredient> {
    return await this.recipesService.addIngredientToRecipe(createRecipeIngredientDto);
  }

  @Get(':recipe_id/ingredients')
  @ApiOperation({
    summary: 'Listează ingredientele unei rețete',
    description: 'Returnează toate ingredientele folosite într-o rețetă cu cantitățile specificate.',
  })
  @ApiParam({ name: 'recipe_id', description: 'ID-ul rețetei', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista ingredientelor a fost returnată cu succes',
  })
  async findRecipeIngredients(@Param('recipe_id', ParseIntPipe) recipe_id: number): Promise<RecipeIngredient[]> {
    return await this.recipesService.findRecipeIngredients(recipe_id);
  }

  @Patch('recipe-ingredients/:id')
  @ApiOperation({
    summary: 'Actualizează cantitatea unui ingredient în rețetă',
    description: 'Modifică cantitatea sau notele pentru un ingredient dintr-o rețetă.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii rețetă-ingredient', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Asocierea a fost actualizată cu succes',
    type: RecipeIngredient,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Asocierea nu a fost găsită',
  })
  async updateRecipeIngredient(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRecipeIngredientDto: UpdateRecipeIngredientDto,
  ): Promise<RecipeIngredient> {
    return await this.recipesService.updateRecipeIngredient(id, updateRecipeIngredientDto);
  }

  @Delete('recipe-ingredients/:id')
  @ApiOperation({
    summary: 'Elimină un ingredient din rețetă',
    description: 'Șterge asocierea dintre o rețetă și un ingredient.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii rețetă-ingredient', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Ingredientul a fost eliminat cu succes din rețetă',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Asocierea nu a fost găsită',
  })
  async removeIngredientFromRecipe(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.recipesService.removeIngredientFromRecipe(id);
  }

  // STATISTICS ENDPOINT
  @Get('statistics/overview')
  @ApiOperation({
    summary: 'Obține statistici generale despre rețete',
    description: 'Generează rapoarte și statistici detaliate despre rețete, categorii și ingrediente.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost generate cu succes',
  })
  async getRecipeStatistics() {
    return await this.recipesService.getRecipeStatistics();
  }
}
