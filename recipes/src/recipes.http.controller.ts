import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers, Request, NotFoundException, BadRequestException } from '@nestjs/common';
import { Permissions } from './permissions/permissions.decorator';
import { RecipeService } from './recipes/recipes.service';
import { RecipeMediaService } from './recipes/recipes-media.service';
import { RecipePreparationsService } from './recipes/recipes-preparations.service';
import { RecipesLabelsService } from './recipes/recipes-labels.service';
import { RecipesPrinterService } from './recipes/recipes-printer.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CreateRecipeDto } from './recipes/dto/create-recipe.dto';
import { UpdateRecipeDto } from './recipes/dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './recipes/dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './recipes/dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './recipes/dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './recipes/dto/update-recipe-product.dto';
import { CreateRecipeMediaDto } from './recipes/dto/create-recipe-media.dto';
import { CreateRecipePreparationDto } from './recipes/dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './recipes/dto/update-recipe-preparation.dto';
import { CreateRecipeLabelDto } from './recipes/dto/create-recipe-label.dto';
import { CreateRecipeLocationDto } from './recipes/dto/create-recipe-location.dto';
import { buildRecipeAccessRequester } from './recipes/recipe-access';

@Controller()
export class RecipesHttpController {
  constructor(
    private readonly recipes: RecipeService,
    private readonly media: RecipeMediaService,
    private readonly preps: RecipePreparationsService,
    private readonly labels: RecipesLabelsService,
    private readonly printer: RecipesPrinterService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // Recipes
  @Get('recipes')
  @Permissions('recipes.read')
  async findAll(@Query() q: any, @Request() req?: any) {
    const page = Number.parseInt(q.page, 10);
    const limit = Number.parseInt(q.limit, 10);
    const maybeCid = q.category_id !== undefined ? Number(q.category_id) : undefined;
    const category_id = Number.isFinite(maybeCid as number) && (maybeCid as number) > 0 ? (maybeCid as number) : undefined;
    
    // location_id este OBLIGATORIU - din query sau din user context
    let location_id: number | undefined;
    const maybeLid = q.location_id !== undefined ? Number(q.location_id) : undefined;
    if (Number.isFinite(maybeLid as number) && (maybeLid as number) > 0) {
      location_id = maybeLid as number;
    } else {
      // Încearcă să obțină din user context
      const user = req?.user;
      location_id = user?.work_location_id || user?.work_location_default_id;
    }
    
    // Dacă încă nu avem location_id, aruncă eroare
    if (!location_id) {
      throw new BadRequestException('Parametrul location_id este obligatoriu pentru a obține rețetele');
    }
    
    const result = await this.recipes.findAll({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
      search: q.search,
      category_id,
      location_id
    }, buildRecipeAccessRequester(req?.user));
    
    // Return in the format expected by the frontend
    return {
      data: result.recipes,
      total: result.total,
      page: page || 1,
      totalPages: result.totalPages,
      limit: limit || 50
    };
  }
  
  @Post('recipes')
  @Permissions('recipes.create')
  create(@Body() dto: CreateRecipeDto, @Query('location_id') locationId?: string, @Request() req?: any) {
    // location_id poate veni din query (din UI) sau din user context (JWT)
    let location_id: number | undefined;
    const maybeLid = locationId !== undefined ? Number(locationId) : undefined;
    if (Number.isFinite(maybeLid as number) && (maybeLid as number) > 0) {
      location_id = maybeLid as number;
    } else {
      const user = req?.user;
      location_id = user?.work_location_id || user?.work_location_default_id;
    }
    
    if (!location_id) {
      throw new BadRequestException('Nu se poate crea o rețetă fără o locație asignată. Vă rugăm să selectați o locație.');
    }

    return this.recipes.create(dto, location_id, buildRecipeAccessRequester(req?.user));
  }

  // Categories
  @Get('recipes/categories')
  @Permissions('recipes.read')
  async categoriesFindAll(@Query() q: any) {
    const page = Number.parseInt(q.page, 10);
    const limit = Number.parseInt(q.limit, 10);
    
    const result = await this.recipes.findAllCategories({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
      search: q.search
    });
    
    // Return in the format expected by the frontend
    return {
      data: result.categories,
      total: result.total,
      page: page || 1,
      totalPages: result.totalPages,
      limit: limit || 50
    };
  }
  
  @Get('recipes/categories/:id')
  @Permissions('recipes.read')
  categoryFindOne(@Param('id') id: string) { return this.recipes.findOneCategory(Number(id)); }
  @Post('recipes/categories')
  @Permissions('recipes.create')
  categoryCreate(@Body() dto: CreateRecipeCategoryDto) { return this.recipes.createCategory(dto); }
  @Patch('recipes/categories/:id')
  @Permissions('recipes.update')
  categoryUpdate(@Param('id') id: string, @Body() dto: UpdateRecipeCategoryDto) { return this.recipes.updateCategory(Number(id), dto); }
  @Delete('recipes/categories/:id')
  @Permissions('recipes.delete')
  categoryRemove(@Param('id') id: string) { return this.recipes.removeCategory(Number(id)); }

  // Recipe products (ingredients)
  @Post('recipes/recipe-products')
  @Permissions('recipes.update')
  addRecipeProduct(@Body() dto: CreateRecipeProductDto) { return this.recipes.addProductToRecipe(dto); }
  @Patch('recipes/recipe-products/:id')
  @Permissions('recipes.update')
  updateRecipeProduct(@Param('id') id: string, @Body() dto: UpdateRecipeProductDto) { return this.recipes.updateRecipeProduct(Number(id), dto); }
  @Delete('recipes/recipe-products/:id')
  @Permissions('recipes.update')
  removeRecipeProduct(@Param('id') id: string) { return this.recipes.removeRecipeProduct(Number(id)); }

  // Recipe products list for a recipe
  @Get('recipes/:id/products')
  @Permissions('recipes.read')
  getRecipeProducts(@Param('id') id: string) { return this.recipes.findRecipeProducts(Number(id)); }

  // Recipe Media endpoints
  @Post('recipes/:id/media')
  @Permissions('recipes.create')
  uploadMedia(@Param('id') id: string, @Body() dto: CreateRecipeMediaDto) {
    return this.media.createMedia({ ...dto, recipe_id: Number(id) });
  }

  @Get('recipes/:id/media')
  @Permissions('recipes.read')
  getRecipeMedia(@Param('id') id: string) {
    return this.media.findMediaByRecipe(Number(id));
  }

  @Get('recipes/media/:mediaId')
  @Permissions('recipes.read')
  async serveMedia(@Param('mediaId') mediaId: string) {
    const mediaData = await this.media.serveMedia(Number(mediaId));
    return {
      data: mediaData.data,
      mimeType: mediaData.mimeType,
      fileName: mediaData.fileName
    };
  }

  @Delete('recipes/media/:mediaId')
  @Permissions('recipes.delete')
  deleteMedia(@Param('mediaId') mediaId: string) {
    return this.media.removeMedia(Number(mediaId));
  }
  // Recipe recipes (rețete ca ingrediente)
  @Post('recipes/:id/recipe-ingredients')
  @Permissions('recipes.update')
  addRecipeIngredient(
    @Param('id') recipeId: string,
    @Body() body: { ingredient_recipe_id: number; quantity: number; notes?: string }
  ) {
    return this.recipes.addRecipeToRecipe(Number(recipeId), body.ingredient_recipe_id, body.quantity, body.notes);
  }

  @Get('recipes/:id/recipe-ingredients')
  @Permissions('recipes.read')
  getRecipeIngredients(@Param('id') id: string) { return this.recipes.getRecipeRecipes(Number(id)); }

  @Patch('recipes/recipe-ingredients/:id')
  @Permissions('recipes.update')
  updateRecipeIngredient(
    @Param('id') id: string,
    @Body() body: { quantity: number; notes?: string }
  ) {
    return this.recipes.updateRecipeRecipe(Number(id), body.quantity, body.notes);
  }

  @Delete('recipes/recipe-ingredients/:id')
  @Permissions('recipes.update')
  removeRecipeIngredient(@Param('id') id: string) { return this.recipes.removeRecipeRecipe(Number(id)); }

  // Get scaled ingredients with stock availability (placed before recipes/:id to avoid route conflicts)
  @Get('recipes/:id/scaled-ingredients-with-stock')
  @Permissions('preparation.create')
  getScaledIngredientsWithStock(
    @Param('id') id: string,
    @Query('quantity') quantity: string
  ) {
    const qty = Number(quantity) || 1000;
    return this.recipes.getScaledIngredientsWithStock(Number(id), qty);
  }

  // Recipe by id (placed after static subpaths to avoid matching conflicts)
  @Get('recipes/:id')
  @Permissions('recipes.read')
  findOne(@Param('id') id: string, @Query('location_id') locationId?: string, @Request() req?: any) {
    // location_id poate veni din query (din UI) sau din user context (JWT)
    let location_id: number | undefined;
    const maybeLid = locationId !== undefined ? Number(locationId) : undefined;
    if (Number.isFinite(maybeLid as number) && (maybeLid as number) > 0) {
      location_id = maybeLid as number;
    } else {
      const user = req?.user;
      location_id = user?.work_location_id || user?.work_location_default_id;
    }
    
    if (!location_id) {
      throw new BadRequestException('Nu se poate accesa o rețetă fără o locație asignată. Vă rugăm să selectați o locație.');
    }

    return this.recipes.findOne(Number(id), location_id, buildRecipeAccessRequester(req?.user));
  }
  @Patch('recipes/:id')
  @Permissions('recipes.update')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto, @Query('location_id') locationId?: string, @Request() req?: any) {
    // location_id poate veni din query (din UI) sau din user context (JWT)
    let location_id: number | undefined;
    const maybeLid = locationId !== undefined ? Number(locationId) : undefined;
    if (Number.isFinite(maybeLid as number) && (maybeLid as number) > 0) {
      location_id = maybeLid as number;
    } else {
      const user = req?.user;
      location_id = user?.work_location_id || user?.work_location_default_id;
    }
    return this.recipes.update(Number(id), dto, location_id, buildRecipeAccessRequester(req?.user));
  }
  @Delete('recipes/:id')
  @Permissions('recipes.delete')
  remove(
    @Param('id') id: string,
    @Headers('x-work-location-id') xWorkLocationId?: string,
    @Query('location_id') location_id?: string,
    @Request() req?: any,
  ) {
    const selectedWorkLocationId = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    return this.recipes.remove(Number(id), selectedWorkLocationId, buildRecipeAccessRequester(req?.user));
  }

  // Preparations
  @Get('recipe-preparations')
  @Permissions('preparation.read')
  getPreparations(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('location_id') locationId?: string,
    @Request() req?: any
  ) {
    const user = req?.user;
    const hasRecipesRead = user?.permissions?.includes('recipes.read');
    
    // Dacă utilizatorul nu are permisiunea recipes.read, filtrare OBLIGATORIE după locație
    if (!hasRecipesRead) {
      // Dacă nu are location_id în query, încearcă să obțină din user
      let finalLocationId = locationId ? parseInt(locationId, 10) : undefined;
      if (!finalLocationId) {
        finalLocationId = user?.work_location_id || user?.work_location_default_id;
      }
      if (!finalLocationId) {
        // Dacă nu are locație, returnează array gol
        return [];
      }
      return this.preps.findAll(Number(page), Number(limit), finalLocationId);
    }
    
    // Pentru utilizatori cu recipes.read, permitem fără location_id
    return this.preps.findAll(Number(page), Number(limit), locationId ? parseInt(locationId, 10) : undefined);
  }
  
  @Get('recipe-preparations/batch')
  @Permissions('preparation.read')
  getPreparationsBatch(@Query('ids') ids?: string) {
    const list = String(ids || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    return this.preps.findMany(list);
  }

  @Get('recipe-preparations/:id')
  @Permissions('preparation.read')
  getPreparation(@Param('id') id: string) { return this.preps.findOne(Number(id)); }
  
  @Post('recipe-preparations')
  @Permissions('preparation.create')
  createPreparation(@Body() dto: CreateRecipePreparationDto) { return this.preps.create(dto); }
  
  @Patch('recipe-preparations/:id')
  @Permissions('preparation.update')
  updatePreparation(@Param('id') id: string, @Body() dto: UpdateRecipePreparationDto) {
    const payload: any = { ...dto };
    if (payload.produced_at && typeof payload.produced_at === 'string') {
      payload.produced_at = new Date(payload.produced_at) as any;
    }
    return this.preps.update(Number(id), payload);
  }
  
  @Delete('recipe-preparations/:id')
  @Permissions('preparation.delete')
  removePreparation(@Param('id') id: string) { return this.preps.remove(Number(id)); }
  
  @Post('recipe-preparations/prepare-with-stock')
  @Permissions('preparation.create')
  prepareWithStock(@Body() dto: CreateRecipePreparationDto) { return this.preps.prepareWithStock(dto); }

  // Labels
  @Get('recipe-labels')
  @Permissions('recipes.read')
  labelsAll() { return this.labels.findAll(); }
  
  @Get('recipe-labels/:id')
  @Permissions('recipes.read')
  labelsOne(@Param('id') id: string) { return this.labels.findOne(Number(id)); }
  
  @Post('recipe-labels')
  @Permissions('recipes.create')
  labelsCreate(@Body() dto: CreateRecipeLabelDto, @Request() req: any) { 
    return this.labels.create(dto, req.user); 
  }
  
  @Delete('recipe-labels/:id')
  @Permissions('recipes.delete')
  labelsRemove(@Param('id') id: string) { return this.labels.remove(Number(id)); }
  
  // Print label
  @Post('recipe-labels/:id/print')
  @Permissions('recipes.create')
  async printLabel(
    @Param('id') id: string,
    @Body() body: { copies?: number }
  ) {
    const label = await this.labels.findOne(Number(id));
    if (!label) {
      throw new NotFoundException('Eticheta nu a fost găsită');
    }
    
    // Obține preparatul pentru a extrage datele necesare
    const prep = await this.preps.findOne(label.recipe_preparation_id);
    if (!prep) {
      throw new NotFoundException('Preparatul nu a fost găsit');
    }
    
    const recipe = prep.recipe;
    const copies = body.copies || 1;
    
    // Calculează data expirării din produced_at + expiration_hours
    const baseDate = prep.produced_at || label.generated_at;
    const expirationHours = recipe?.expiration_hours || 48;
    const expirationDate = new Date(new Date(baseDate).getTime() + expirationHours * 60 * 60 * 1000);
    
    // Obține numele angajatului (generated_by_employee_id sau produced_by)
    let generatedBy = 'Necunoscut';
    const employeeId = label.generated_by_employee_id || prep.produced_by;
    
    if (employeeId) {
      try {
        const employeesServiceUrl = this.configService.get<string>('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
        const serviceSecret = process.env.SERVICE_SECRET || '';
        const headers = {
          'Content-Type': 'application/json',
          'x-internal-service': 'recipes',
          'x-service-secret': serviceSecret
        };
        
        const employeeResponse: any = await firstValueFrom(
          this.httpService.get(`${employeesServiceUrl}/employees/${employeeId}`, { headers })
        );
        const employeeData = employeeResponse?.data?.data || employeeResponse?.data || employeeResponse;
        
        if (employeeData) {
          // Formatează numele angajatului
          if (employeeData.name) {
            generatedBy = employeeData.name;
          } else if (employeeData.first_name && employeeData.last_name) {
            generatedBy = `${employeeData.first_name} ${employeeData.last_name}`;
          } else {
            generatedBy = `Angajat ID: ${employeeId}`;
          }
        }
      } catch (error: any) {
        // Dacă nu putem obține numele, folosim ID-ul
        if (error?.response?.status !== 404) {
          console.warn(`⚠️ [RECIPES CONTROLLER] Could not fetch employee ${employeeId}:`, error?.message);
        }
        generatedBy = `Angajat ID: ${employeeId}`;
      }
    }
    
    // Formatează datele pentru printare
    const printData = {
      codEticheta: label.label_code,
      preparatNume: recipe?.name ? `${recipe.name} - ${prep.quantity || 0}g` : 'Preparat necunoscut',
      retetaNume: recipe?.name || 'Rețetă necunoscută',
      dataCrearii: prep.produced_at?.toISOString() || label.generated_at.toISOString(),
      dataExpirarii: expirationDate.toISOString(),
      generataDe: generatedBy,
    };
    
    try {
      await this.printer.printLabel(printData, copies);
      return { success: true, message: `Eticheta a fost trimisă la imprimantă (${copies} copie/copii)` };
    } catch (error) {
      // Re-throw eroarea pentru ca NestJS să o gestioneze corect
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Eroare necunoscută la printare'
      );
    }
  }
  
  // Test printer connection
  @Post('recipe-labels/test-printer')
  @Permissions('recipes.read')
  async testPrinter() {
    const isConnected = await this.printer.testConnection();
    
    if (!isConnected) {
      // Încearcă să găsească portul corect
      const foundPort = await this.printer.findPrinterPort();
      if (foundPort) {
        return {
          success: false,
          message: `Portul configurat nu funcționează, dar am găsit portul ${foundPort} care este deschis. Actualizează PRINTER_PORT=${foundPort} în variabilele de mediu.`,
          foundPort: foundPort
        };
      }
    }
    
    return { 
      success: isConnected, 
      message: isConnected ? 'Conexiunea la imprimantă este funcțională' : 'Nu s-a putut conecta la imprimantă. Verifică IP-ul și portul.' 
    };
  }

  // ==================== RECIPE LOCATIONS ENDPOINTS ====================

  @Post('recipes/locations/assign')
  @Permissions('recipes.update')
  async assignRecipeToLocation(@Body() assignDto: CreateRecipeLocationDto) {
    return this.recipes.assignRecipeToLocation(assignDto);
  }

  @Get('recipes/:recipeId/locations')
  @Permissions('recipes.read')
  async getRecipeLocations(@Param('recipeId') recipeId: string) {
    return this.recipes.findRecipeLocations(Number(recipeId));
  }

  @Delete('recipes/:recipeId/locations/:locationId')
  @Permissions('recipes.update')
  async removeRecipeFromLocation(
    @Param('recipeId') recipeId: string,
    @Param('locationId') locationId: string
  ) {
    await this.recipes.removeRecipeFromLocation(Number(recipeId), Number(locationId));
    return { message: 'Rețeta a fost eliminată de la locație cu succes' };
  }
}

function parseSelectedWorkLocationId(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}