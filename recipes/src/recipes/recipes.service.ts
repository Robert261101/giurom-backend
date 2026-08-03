import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThan, LessThan, DeepPartial } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { Recipe } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeProduct } from './entities/recipe-product.entity';
import { RecipeRecipe } from './entities/recipe-recipe.entity';
import { RecipeMedia } from './entities/recipe-media.entity';
import { RecipeLocation } from './entities/recipe-location.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './dto/update-recipe-product.dto';
import { CreateRecipeLocationDto } from './dto/create-recipe-location.dto';
import { RecipeMediaService } from './recipes-media.service';
import { ProductRef } from '../external/product-ref.entity';
import { isRecipeAdminUser, type RecipeAccessRequester } from './recipe-access';

@Injectable()
export class RecipeService {
  private readonly stockServiceUrl: string;

  constructor(
    @InjectRepository(Recipe)
    private recipesRepository: Repository<Recipe>,
    @InjectRepository(RecipeCategory)
    private categoriesRepository: Repository<RecipeCategory>,
    @InjectRepository(RecipeProduct)
    private recipeProductsRepository: Repository<RecipeProduct>,
    @InjectRepository(RecipeRecipe)
    private recipeRecipesRepository: Repository<RecipeRecipe>,
    @InjectRepository(RecipeLocation)
    private recipeLocationRepository: Repository<RecipeLocation>,
    private recipeMediaService: RecipeMediaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {
    this.stockServiceUrl = this.configService.get<string>('STOCK_HTTP_URL') || 'http://localhost:3006';
  }

  /** selectedWorkLocationId = locația selectată în UI (colț dreapta sus). */
  private async sendRecipeNotification(
    type: string,
    title: string,
    description: string,
    recipeId: number,
    metadata?: any,
    target_url?: string,
    selectedWorkLocationId?: number,
  ): Promise<void> {
    try {
      const payloadMetadata = {
        ...metadata,
        ...(selectedWorkLocationId != null && { work_location_id: selectedWorkLocationId }),
      };
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'recipes.notification' }, {
          type,
          title,
          description,
          entity_id: recipeId,
          entity_type: 'recipe',
          metadata: payloadMetadata,
          priority: 'medium',
          target_url,
        })
      );
    } catch (error) {
      console.error('Failed to send recipe notification:', error);
    }
  }

  // ==================== RECIPES METHODS ====================

  async create(createRecipeDto: CreateRecipeDto, location_id?: number, requester?: RecipeAccessRequester): Promise<Recipe> {
    // Verificare reală de acces: nu asigna rețeta la o locație pe care angajatul n-o are.
    if (requester && !isRecipeAdminUser(requester.permissions || []) && location_id != null) {
      const employeeLocationIds = await this.getEmployeeLocationIds(requester);
      if (!employeeLocationIds.includes(location_id)) {
        throw new BadRequestException('Nu ai acces la locația specificată');
      }
    }
    // `is_consumable` este per-locație (recipe_locations), nu global.
    const { is_consumable, ...rest } = createRecipeDto as any;
    const recipe = this.recipesRepository.create(rest as DeepPartial<Recipe>);
    const savedRecipe = await this.recipesRepository.save(recipe);
    
    // Asignează automat rețeta la locația utilizatorului dacă este furnizată
    if (location_id) {
      try {
        const recipeLocation = this.recipeLocationRepository.create({
          recipeId: savedRecipe.id,
          idLocation: location_id,
          isConsumable: !!is_consumable,
        });
        await this.recipeLocationRepository.save(recipeLocation);
        console.log(`✅ [RecipesService] Rețeta ${savedRecipe.id} a fost asignată automat la locația ${location_id}`);
      } catch (error) {
        // Dacă există deja, nu e problemă (ar trebui să fie imposibil, dar să fie safe)
        console.warn(`⚠️ [RecipesService] Eroare la asignarea automată a rețetei ${savedRecipe.id} la locația ${location_id}:`, error);
      }
    }
    
    await this.sendRecipeNotification(
      'recipe_created',
      'S-a adăugat rețeta',
      `S-a adăugat rețeta ${savedRecipe.name}`,
      savedRecipe.id,
      { recipeName: savedRecipe.name, audience: 'admin_only' },
      `/retetar/${savedRecipe.id}`,
      location_id,
    );
    
    // expunem `is_consumable` în payload ca valoare per locația curentă (dacă există)
    if (location_id) (savedRecipe as any).is_consumable = !!(createRecipeDto as any).is_consumable;
    return savedRecipe;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: number;
    location_id: number; // OBLIGATORIU
    difficulty?: 'easy' | 'medium' | 'hard';
    max_cooking_time?: number;
  }, requester?: RecipeAccessRequester): Promise<{ recipes: Recipe[]; total: number; totalPages: number }> {
    // Verificare reală de acces: location_id vine de la client (query/JWT), dar trebuie
    // să fie efectiv o locație a angajatului — altfel oricine ar putea citi rețetele
    // (date sensibile de business) ale altei companii doar ghicind un location_id.
    if (requester && !isRecipeAdminUser(requester.permissions || [])) {
      const employeeLocationIds = await this.getEmployeeLocationIds(requester);
      if (!employeeLocationIds.includes(params.location_id)) {
        throw new BadRequestException('Nu ai acces la locația specificată');
      }
    }
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const queryBuilder = this.recipesRepository.createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.category', 'category')
      .leftJoinAndSelect('recipe.recipe_products', 'recipe_products');
    
    // Add search filter
    if (params.search) {
      queryBuilder.andWhere('recipe.name LIKE :search', { search: `%${params.search}%` });
    }
    
    // Add category filter
    if (params.category_id) {
      queryBuilder.andWhere('recipe.category_id = :category_id', { category_id: params.category_id });
    }
    
    // Add location filter - OBLIGATORIU - folosim recipe_locations pentru many-to-many
    queryBuilder
      .leftJoinAndSelect('recipe.recipeLocations', 'recipe_location')
      .andWhere('recipe_location.idLocation = :location_id', { location_id: params.location_id });
    console.log('🔍 [RecipesService] Filtrăm recipes după location_id (prin recipe_locations):', params.location_id);
    
    const offset = (page - 1) * limit;
    const [recipes, total] = await queryBuilder
      .orderBy('recipe.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    // Expune `is_consumable` și `consumabil_pentru_angajat` per locație (pentru afișare în UI)
    for (const r of recipes) {
      const rl = Array.isArray((r as any).recipeLocations) ? (r as any).recipeLocations[0] : undefined;
      const consumable = rl?.isConsumable ?? false;
      (r as any).is_consumable = consumable;
      (r as any).consumabil_pentru_angajat = consumable;
    }
    
    // Populate product data for each recipe
    for (const recipe of recipes) {
      if (recipe.recipe_products && recipe.recipe_products.length > 0) {
        for (const recipeProduct of recipe.recipe_products) {
          if (recipeProduct.product_id) {
            try {
              const response = await lastValueFrom(
                this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
                  headers: {
                    'x-internal-service': 'recipes',
                    'x-service-secret': process.env.SERVICE_SECRET || ''
                  }
                })
              );
              recipeProduct.product = response.data;
            } catch (error) {
              // Handle case where product might not exist
              recipeProduct.product = null;
            }
          }
        }
      }
    }
    
    const totalPages = Math.ceil(total / limit);
    
    return { recipes, total, totalPages };
  }

  private internalServiceHeaders(): Record<string, string> {
    return {
      'x-internal-service': 'recipes',
      'x-service-secret': process.env.SERVICE_SECRET || '',
    };
  }

  /** Locațiile reale la care angajatul are acces, verificate via employees-ms (nu doar declarate de client). */
  private async getEmployeeLocationIds(requester?: RecipeAccessRequester): Promise<number[]> {
    const fallback = [requester?.work_location_id, requester?.work_location_default_id].filter(
      (v): v is number => Number.isFinite(v as number) && (v as number) > 0,
    );

    const employeeId = requester?.userId;
    if (!employeeId || !Number.isFinite(employeeId)) {
      return Array.from(new Set(fallback));
    }

    try {
      const employeesServiceUrl = this.configService.get<string>('EMPLOYEES_HTTP_URL') || 'http://localhost:3011';
      const resp: any = await firstValueFrom(
        this.httpService.get(`${employeesServiceUrl}/employees/${employeeId}/locations`, {
          headers: this.internalServiceHeaders(),
          timeout: 3000,
        }),
      );
      const rows = Array.isArray(resp?.data) ? resp.data : [];
      const ids = rows
        .map((el: any) => Number(el.idLocation ?? el.id_location ?? el.locationId ?? el.location_id))
        .filter((id: number) => Number.isFinite(id) && id > 0);
      return Array.from(new Set([...ids, ...fallback]));
    } catch {
      return Array.from(new Set(fallback));
    }
  }

  /**
   * Verifică — independent de orice `location_id` trimis de client — dacă angajatul curent
   * are efectiv acces la cel puțin una dintre locațiile la care e asignată rețeta.
   * Admin/manager company-wide (assignment.read_all/read_company) sare peste verificare.
   * Fără `requester` = apel intern (server-to-server), comportament neschimbat.
   */
  private async assertRecipeAccessibleToRequester(
    recipe: Recipe,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    if (!requester) {
      return;
    }
    if (isRecipeAdminUser(requester.permissions || [])) {
      return;
    }

    const recipeLocationIds = (recipe.recipeLocations || [])
      .map((rl: any) => Number(rl.idLocation))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    if (recipeLocationIds.length === 0) {
      throw new NotFoundException(`Rețeta cu ID ${recipe.id} nu a fost găsită`);
    }

    const employeeLocationIds = await this.getEmployeeLocationIds(requester);
    const hasAccess = recipeLocationIds.some((id) => employeeLocationIds.includes(id));

    if (!hasAccess) {
      throw new NotFoundException(`Rețeta cu ID ${recipe.id} nu a fost găsită`);
    }
  }

  async findOne(id: number, location_id?: number, requester?: RecipeAccessRequester): Promise<Recipe> {
    const recipe = await this.recipesRepository.findOne({
      where: { id },
      relations: [
        'category',
        'recipe_products',
        'recipe_recipes',
        'recipe_recipes.ingredient_recipe',
        'recipe_recipes.ingredient_recipe.recipe_products',
        'recipeMedia',
        'recipeLocations',
      ],
    });
    
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }
    
    // Dacă location_id este furnizat, verifică dacă rețeta este asignată la acea locație
    if (location_id !== undefined) {
      const isAssignedToLocation = recipe.recipeLocations?.some(
        (rl) => rl.idLocation === location_id
      );
      
      if (!isAssignedToLocation) {
        throw new NotFoundException(`Rețeta cu ID ${id} nu este asignată la locația specificată`);
      }
    }

    // Verificare reală de acces (independentă de ce location_id a trimis clientul) —
    // vezi assertRecipeAccessibleToRequester. Blochează accesul cross-companie la rețete.
    await this.assertRecipeAccessibleToRequester(recipe, requester);

    // Expune `is_consumable` și `consumabil_pentru_angajat` per locație (pentru afișare în UI)
    if (location_id !== undefined) {
      const rl = recipe.recipeLocations?.find((x: any) => x.idLocation === location_id);
      const consumable = (rl as any)?.isConsumable ?? false;
      (recipe as any).is_consumable = consumable;
      (recipe as any).consumabil_pentru_angajat = consumable;
    }

    // Populate product data for main recipe_products
    if (recipe.recipe_products && recipe.recipe_products.length > 0) {
      for (const recipeProduct of recipe.recipe_products) {
        if (recipeProduct.product_id) {
          try {
            const response = await lastValueFrom(
              this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
                headers: {
                  'x-internal-service': 'recipes',
                  'x-service-secret': process.env.SERVICE_SECRET || ''
                }
              })
            );
            recipeProduct.product = response.data;
          } catch (error) {
            recipeProduct.product = null;
          }
        }
      }
    }

    // Populate product data for ingredient_recipe.recipe_products (rețete ca ingrediente)
    if (recipe.recipe_recipes && recipe.recipe_recipes.length > 0) {
      for (const rr of recipe.recipe_recipes) {
        const subRecipe = rr.ingredient_recipe;
        if (subRecipe?.recipe_products && subRecipe.recipe_products.length > 0) {
          for (const rp of subRecipe.recipe_products) {
            if (rp.product_id) {
              try {
                const response = await lastValueFrom(
                  this.httpService.get(`${this.stockServiceUrl}/stock/products/${rp.product_id}`, {
                    headers: {
                      'x-internal-service': 'recipes',
                      'x-service-secret': process.env.SERVICE_SECRET || ''
                    }
                  })
                );
                rp.product = response.data;
              } catch (error) {
                rp.product = null;
              }
            }
          }
        }
      }
    }

    return recipe;
  }

  async update(
    id: number,
    updateRecipeDto: UpdateRecipeDto,
    location_id?: number,
    requester?: RecipeAccessRequester,
  ): Promise<Recipe> {
    // location_id nu restricționează update-ul (o rețetă poate fi asignată la mai multe
    // locații), dar `requester` verifică independent că angajatul are acces la rețetă.
    const recipe = await this.findOne(id, undefined, requester);
    const oldName = recipe.name;
    const { is_consumable, ...rest } = updateRecipeDto as any;
    Object.assign(recipe, rest);
    const updatedRecipe = await this.recipesRepository.save(recipe);

    // Dacă primim `is_consumable` și avem location_id, îl setăm per-locație în recipe_locations
    if (location_id !== undefined && is_consumable !== undefined) {
      const existing = await this.recipeLocationRepository.findOne({
        where: { recipeId: id, idLocation: location_id },
      });
      if (existing) {
        (existing as any).isConsumable = !!is_consumable;
        await this.recipeLocationRepository.save(existing);
      } else {
        // dacă nu există încă asignare, o creăm ca să putem seta flag-ul per locație
        const rl = this.recipeLocationRepository.create({
          recipeId: id,
          idLocation: location_id,
          isConsumable: !!is_consumable,
        } as any);
        await this.recipeLocationRepository.save(rl);
      }
      (updatedRecipe as any).is_consumable = !!is_consumable;
    }
    
    await this.sendRecipeNotification(
      'recipe_updated',
      'S-a modificat rețeta',
      `S-a modificat rețeta ${updatedRecipe.name}`,
      updatedRecipe.id,
      { oldName, newName: updatedRecipe.name, audience: 'admin_only' },
      `/retetar/${updatedRecipe.id}`,
      location_id,
    );
    
    return updatedRecipe;
  }

  async remove(
    id: number,
    selectedWorkLocationId?: number,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    const recipe = await this.findOne(id, undefined, requester);
    const recipeName = recipe.name;
    await this.recipesRepository.remove(recipe);
    await this.sendRecipeNotification(
      'recipe_deleted',
      'S-a șters rețeta',
      `S-a șters rețeta ${recipeName}`,
      id,
      { recipeName, audience: 'admin_only' },
      undefined,
      selectedWorkLocationId,
    );
  }

  // ==================== CATEGORIES METHODS ====================

  async createCategory(createCategoryDto: CreateRecipeCategoryDto): Promise<RecipeCategory> {
    const category = this.categoriesRepository.create(createCategoryDto);
    return await this.categoriesRepository.save(category);
  }

  async findAllCategories(params: { 
    page?: number; 
    limit?: number; 
    search?: string 
  }): Promise<{ categories: RecipeCategory[]; total: number; totalPages: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const queryBuilder = this.categoriesRepository.createQueryBuilder('category');
    
    // Add search filter
    if (params.search) {
      queryBuilder.andWhere('category.name LIKE :search', { search: `%${params.search}%` });
    }
    
    const offset = (page - 1) * limit;
    const [categories, total] = await queryBuilder
      .orderBy('category.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    
    const totalPages = Math.ceil(total / limit);
    
    return { categories, total, totalPages };
  }

  async findOneCategory(id: number): Promise<RecipeCategory> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['recipes'],
    });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    return category;
  }

  async updateCategory(id: number, updateCategoryDto: UpdateRecipeCategoryDto): Promise<RecipeCategory> {
    const category = await this.findOneCategory(id);
    Object.assign(category, updateCategoryDto);
    return await this.categoriesRepository.save(category);
  }

  async removeCategory(id: number): Promise<void> {
    const category = await this.findOneCategory(id);
    await this.categoriesRepository.remove(category);
  }

  // ==================== RECIPE PRODUCTS METHODS ====================

  async ensureRecipeAccess(
    recipeId: number,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    await this.findOne(recipeId, undefined, requester);
  }

  /** Verifică acces la preparat via rețetă + locație producție. */
  async assertPreparationRecipeAccess(
    recipeId: number,
    locationId: number | null | undefined,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    await this.ensureRecipeAccess(recipeId, requester);
    if (!requester || isRecipeAdminUser(requester.permissions || [])) {
      return;
    }
    const normalizedLocationId = Number(locationId);
    if (!Number.isFinite(normalizedLocationId) || normalizedLocationId <= 0) {
      throw new NotFoundException('Preparation not found');
    }
    const locIds = await this.getEmployeeLocationIds(requester);
    if (!locIds.includes(normalizedLocationId)) {
      throw new NotFoundException('Preparation not found');
    }
  }

  async addProductToRecipe(
    createRecipeProductDto: CreateRecipeProductDto,
    requester?: RecipeAccessRequester,
  ): Promise<RecipeProduct> {
    await this.ensureRecipeAccess(createRecipeProductDto.recipe_id, requester);
    // Verify product exists via HTTP call
    try {
      const productUrl = `${this.stockServiceUrl}/stock/products/${createRecipeProductDto.product_id}`;
      const serviceSecret = process.env.SERVICE_SECRET || '';
      const headers = {
        'x-internal-service': 'recipes',
        'x-service-secret': serviceSecret
      };
      
      console.log(`🔍 [RecipesService] Verifying product ${createRecipeProductDto.product_id} at: ${productUrl}`);
      console.log(`🔑 [RecipesService] Using service secret: ${serviceSecret.substring(0, 5)}...`);
      console.log(`📤 [RecipesService] Headers:`, headers);
      
      const response = await lastValueFrom(
        this.httpService.get(productUrl, { headers })
      );
      console.log(`✅ [RecipesService] Product ${createRecipeProductDto.product_id} verified:`, response.data);
    } catch (error: any) {
      console.error(`❌ [RecipesService] Error verifying product ${createRecipeProductDto.product_id}:`, error?.response?.data || error?.message);
      console.error(`❌ [RecipesService] Full error:`, error?.response?.status, error?.response?.statusText);
      throw new BadRequestException(`Product with ID ${createRecipeProductDto.product_id} not found`);
    }
    
    const recipeProduct = this.recipeProductsRepository.create(createRecipeProductDto);
    return await this.recipeProductsRepository.save(recipeProduct);
  }

  async findRecipeProducts(
    recipe_id: number,
    requester?: RecipeAccessRequester,
  ): Promise<RecipeProduct[]> {
    await this.ensureRecipeAccess(recipe_id, requester);
    const recipeProducts = await this.recipeProductsRepository.find({
      where: { recipe_id },
      relations: ['recipe'],
    });
    
    // Populate product data
    for (const recipeProduct of recipeProducts) {
      if (recipeProduct.product_id) {
        try {
          const response = await lastValueFrom(
            this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
              headers: {
                'x-internal-service': 'recipes',
                'x-service-secret': process.env.SERVICE_SECRET || ''
              }
            })
          );
          recipeProduct.product = response.data;
        } catch (error) {
          // Handle case where product might not exist
          recipeProduct.product = null;
        }
      }
    }
    
    return recipeProducts;
  }

  async updateRecipeProduct(
    id: number,
    updateRecipeProductDto: UpdateRecipeProductDto,
    requester?: RecipeAccessRequester,
  ): Promise<RecipeProduct> {
    const recipeProduct = await this.recipeProductsRepository.findOne({
      where: { id },
      relations: ['recipe'],
    });
    
    if (!recipeProduct) {
      throw new NotFoundException(`Recipe product with ID ${id} not found`);
    }

    await this.ensureRecipeAccess(recipeProduct.recipe_id, requester);
    // If product_id is being updated, verify the new product exists
    if (updateRecipeProductDto.product_id && updateRecipeProductDto.product_id !== recipeProduct.product_id) {
      try {
        await lastValueFrom(
          this.httpService.get(`${this.stockServiceUrl}/stock/products/${updateRecipeProductDto.product_id}`, {
            headers: {
              'x-internal-service': 'recipes',
              'x-service-secret': process.env.SERVICE_SECRET || ''
            }
          })
        );
      } catch (error) {
        throw new BadRequestException(`Product with ID ${updateRecipeProductDto.product_id} not found`);
      }
    }
    
    Object.assign(recipeProduct, updateRecipeProductDto);
    return await this.recipeProductsRepository.save(recipeProduct);
  }

  async removeRecipeProduct(
    id: number,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    const recipeProduct = await this.recipeProductsRepository.findOne({
      where: { id },
    });
    
    if (!recipeProduct) {
      throw new NotFoundException(`Recipe product with ID ${id} not found`);
    }

    await this.ensureRecipeAccess(recipeProduct.recipe_id, requester);
    
    await this.recipeProductsRepository.remove(recipeProduct);
  }

  // ==================== RECIPE RECIPES METHODS (Rețete ca ingrediente) ====================

  async addRecipeToRecipe(
    recipeId: number,
    ingredientRecipeId: number,
    quantity: number,
    notes?: string,
    requester?: RecipeAccessRequester,
  ): Promise<RecipeRecipe> {
    await this.ensureRecipeAccess(recipeId, requester);
    // Verifică dacă rețeta-ingredient există
    const ingredientRecipe = await this.recipesRepository.findOne({
      where: { id: ingredientRecipeId }
    });
    
    if (!ingredientRecipe) {
      throw new NotFoundException(`Ingredient recipe with ID ${ingredientRecipeId} not found`);
    }

    // Verifică dacă nu se încearcă să adauge rețeta la ea însăși (circular reference)
    if (recipeId === ingredientRecipeId) {
      throw new BadRequestException('Nu poți adăuga o rețetă ca ingredient la ea însăși');
    }

    // Verifică dacă nu există deja această rețetă ca ingredient
    const existing = await this.recipeRecipesRepository.findOne({
      where: { recipe_id: recipeId, ingredient_recipe_id: ingredientRecipeId }
    });

    if (existing) {
      throw new BadRequestException('Această rețetă este deja adăugată ca ingredient');
    }

    const recipeRecipe = this.recipeRecipesRepository.create({
      recipe_id: recipeId,
      ingredient_recipe_id: ingredientRecipeId,
      quantity,
      notes
    });

    return await this.recipeRecipesRepository.save(recipeRecipe);
  }

  async getRecipeRecipes(
    recipeId: number,
    requester?: RecipeAccessRequester,
  ): Promise<RecipeRecipe[]> {
    await this.ensureRecipeAccess(recipeId, requester);
    const recipeRecipes = await this.recipeRecipesRepository.find({
      where: { recipe_id: recipeId },
      relations: ['ingredient_recipe', 'ingredient_recipe.category'],
      order: { created_at: 'ASC' }
    });

    return recipeRecipes;
  }

  async updateRecipeRecipe(
    id: number,
    quantity: number,
    notes?: string,
    requester?: RecipeAccessRequester,
  ): Promise<RecipeRecipe> {
    const recipeRecipe = await this.recipeRecipesRepository.findOne({
      where: { id },
      relations: ['recipe', 'ingredient_recipe']
    });
    
    if (!recipeRecipe) {
      throw new NotFoundException(`Recipe recipe with ID ${id} not found`);
    }

    await this.ensureRecipeAccess(recipeRecipe.recipe_id, requester);
    recipeRecipe.quantity = quantity;
    if (notes !== undefined) {
      recipeRecipe.notes = notes;
    }
    
    return await this.recipeRecipesRepository.save(recipeRecipe);
  }

  async removeRecipeRecipe(
    id: number,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    const recipeRecipe = await this.recipeRecipesRepository.findOne({
      where: { id },
    });
    
    if (!recipeRecipe) {
      throw new NotFoundException(`Recipe recipe with ID ${id} not found`);
    }

    await this.ensureRecipeAccess(recipeRecipe.recipe_id, requester);
    await this.recipeRecipesRepository.remove(recipeRecipe);
  }

  // ==================== STATISTICS METHODS ====================

  async getStatistics(): Promise<any> {
    const total = await this.recipesRepository.count();
    
    const byCategory = await this.recipesRepository
      .createQueryBuilder('recipe')
      .select('category.name', 'category')
      .addSelect('COUNT(recipe.id)', 'count')
      .leftJoin('recipe.category', 'category')
      .groupBy('category.name')
      .getRawMany();
    
    return {
      total,
      byCategory,
    };
  }

  // ==================== SCALED INGREDIENTS WITH STOCK ====================

  /**
   * Calculează ingredientele scalate pentru o rețetă și verifică stocul disponibil
   * Folosește comunicare internă cu stock service (fără să necesite stock.read de la user)
   */
  async getScaledIngredientsWithStock(
    recipeId: number,
    quantity: number,
    requester?: RecipeAccessRequester,
  ): Promise<Array<{
    product_id: number;
    product_name: string;
    unit: string;
    required_quantity: number;
    available_quantity: number;
    sufficient: boolean;
  }>> {
    await this.ensureRecipeAccess(recipeId, requester);
    // Obține rețeta cu ingredientele (fără product pentru că nu e relație TypeORM)
    const recipe = await this.recipesRepository.findOne({
      where: { id: recipeId },
      relations: ['recipe_products'],
    });

    if (!recipe) {
      throw new NotFoundException(`Rețeta cu ID ${recipeId} nu a fost găsită`);
    }

    // Calculează factorul de scalare
    const baseQty = Number(recipe.quantity) || 1;
    const scalingFactor = Number(quantity) / baseQty;

    // Unități care necesită numere întregi
    const wholeNumberUnits = ['buc', 'bucati', 'bucăți', 'sticla', 'sticle', 'cutie', 'cutii', 'pachet', 'pachete'];

    const serviceSecret = process.env.SERVICE_SECRET || '';
    const headers = {
      'x-internal-service': 'recipes',
      'x-service-secret': serviceSecret
    };

    const result: Array<{
      product_id: number;
      product_name: string;
      unit: string;
      required_quantity: number;
      available_quantity: number;
      sufficient: boolean;
    }> = [];

    // Procesează fiecare ingredient din rețetă
    if (Array.isArray(recipe.recipe_products)) {
      for (const rp of recipe.recipe_products) {
        if (!rp.product_id) continue;

        const originalQuantity = Number(rp.quantity) || 0;
        let scaledQuantity = originalQuantity * scalingFactor;
        
        console.log(`🔍 [RecipeService] Ingredient calculation: product_id=${rp.product_id}, originalQuantity=${originalQuantity}, scalingFactor=${scalingFactor}, scaledQuantity=${scaledQuantity}`);

        // Încarcă datele produsului prin HTTP request (pentru că nu e relație TypeORM)
        let productUnit = 'g';
        let productName = 'Ingredient necunoscut';
        try {
          const productResponse = await lastValueFrom(
            this.httpService.get(`${this.stockServiceUrl}/stock/products/${rp.product_id}`, {
              headers
            })
          );
          if (productResponse.data) {
            productUnit = productResponse.data.unit || 'g';
            productName = productResponse.data.name || 'Ingredient necunoscut';
          }
        } catch (error) {
          // Dacă nu putem încărca produsul, folosim valorile default
          console.warn(`⚠️ [RecipeService] Nu s-a putut încărca produsul ${rp.product_id}`);
        }

        // Rotunjire pentru unități întregi
        const requiresWholeNumber = wholeNumberUnits.some(unit =>
          productUnit?.toLowerCase().includes(unit.toLowerCase())
        );
        const finalQuantity = requiresWholeNumber
          ? Math.ceil(scaledQuantity)
          : Math.round(scaledQuantity * 100) / 100;

        // Verifică stocul disponibil prin comunicare internă cu stock service
        let availableQuantity = 0;
        try {
          const stockResponse = await lastValueFrom(
            this.httpService.get(`${this.stockServiceUrl}/stock/items`, {
              headers,
              params: {
                product_id: rp.product_id,
                limit: 1000
              }
            })
          );

          // Suma stocului disponibil pentru acest produs (doar stoc VALID cu quantity > 0)
          const stockItems = stockResponse.data?.data || stockResponse.data || [];
          if (Array.isArray(stockItems)) {
            // Filtrează doar stocul VALID cu quantity > 0
            const validStockItems = stockItems.filter((item: any) => {
              const quantity = parseFloat(item.quantity?.toString() || '0') || 0;
              const status = item.status?.toLowerCase();
              return status === 'valid' && quantity > 0;
            });
            
            availableQuantity = validStockItems.reduce((sum: number, item: any) => {
              return sum + (parseFloat(item.quantity?.toString() || '0') || 0);
            }, 0);
            
            console.log(`📊 [RecipeService] Product ${rp.product_id} (${productName}): total stock items=${stockItems.length}, valid items=${validStockItems.length}, availableQuantity=${availableQuantity}${productUnit}`);
          }
        } catch (error: any) {
          console.error(`⚠️ [RecipeService] Eroare la verificarea stocului pentru produs ${rp.product_id}:`, error?.response?.data || error?.message);
          // Dacă nu putem verifica stocul, setăm disponibil la 0
          availableQuantity = 0;
        }

        result.push({
          product_id: rp.product_id,
          product_name: productName,
          unit: productUnit,
          required_quantity: finalQuantity,
          available_quantity: availableQuantity,
          sufficient: availableQuantity >= finalQuantity,
        });
      }
    }

    return result;
  }

  // ==================== RECIPE LOCATIONS METHODS ====================

  /**
   * Asignează o rețetă la o locație
   */
  async assignRecipeToLocation(assignDto: CreateRecipeLocationDto): Promise<RecipeLocation> {
    // Verifică dacă rețeta există
    const recipe = await this.recipesRepository.findOne({ where: { id: assignDto.recipe_id } });
    if (!recipe) {
      throw new NotFoundException(`Rețeta cu ID-ul ${assignDto.recipe_id} nu a fost găsită`);
    }

    // Verifică dacă asocierea există deja
    const existingAssignment = await this.recipeLocationRepository.findOne({
      where: {
        recipeId: assignDto.recipe_id,
        idLocation: assignDto.id_location,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException(`Rețeta este deja asignată la această locație`);
    }

    const recipeLocation = this.recipeLocationRepository.create({
      recipeId: assignDto.recipe_id,
      idLocation: assignDto.id_location,
      isConsumable: !!(assignDto as any).is_consumable,
    });
    
    return await this.recipeLocationRepository.save(recipeLocation);
  }

  /**
   * Obține locațiile unei rețete
   */
  async findRecipeLocations(recipe_id: number): Promise<RecipeLocation[]> {
    return await this.recipeLocationRepository.find({
      where: { recipeId: recipe_id },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Elimină asignarea unei rețete de la o locație
   */
  async removeRecipeFromLocation(recipe_id: number, location_id: number): Promise<void> {
    const assignment = await this.recipeLocationRepository.findOne({
      where: {
        recipeId: recipe_id,
        idLocation: location_id,
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Rețeta nu este asignată la această locație`);
    }

    await this.recipeLocationRepository.remove(assignment);
  }
}