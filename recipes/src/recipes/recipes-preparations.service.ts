import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  OnModuleInit,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ClientProxy } from "@nestjs/microservices";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { RecipePreparation } from "./entities/recipe-preparation.entity";
import { Recipe } from "./entities/recipe.entity";
import { RecipeLocation } from "./entities/recipe-location.entity";
import { RecipeService } from "./recipes.service";
import { RecipeAccessRequester, isRecipeAdminUser } from "./recipe-access";

@Injectable()
export class RecipePreparationsService implements OnModuleInit {
  private readonly stockServiceUrl: string;

  constructor(
    @InjectRepository(RecipePreparation)
    private readonly prepRepo: Repository<RecipePreparation>,
    @InjectRepository(Recipe) private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeLocation)
    private readonly recipeLocationRepo: Repository<RecipeLocation>,
    @Inject("NOTIFICATIONS_RMQ")
    private readonly notificationsClient: ClientProxy,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RecipeService))
    private readonly recipesService: RecipeService,
  ) {
    this.stockServiceUrl =
      this.configService.get<string>("STOCK_HTTP_URL") ||
      "http://localhost:3006";
  }

  /**
   * Rulează la startup pentru a actualiza preparatele existente care nu au status setat
   */
  async onModuleInit() {
    await this.updateExistingPreparationsStatus();
  }

  /**
   * Actualizează preparatele existente care nu au status setat la 'active'
   */
  private async updateExistingPreparationsStatus() {
    try {
      const result = await this.prepRepo
        .createQueryBuilder()
        .update(RecipePreparation)
        .set({ status: "active" })
        .where("status IS NULL OR status = :empty", { empty: "" })
        .execute();
      if (result.affected && result.affected > 0) {
        console.log(
          `✅ [RecipePreparationsService] Updated ${result.affected} existing preparations with status = "active"`
        );
      }
    } catch (error) {
      console.error(
        "❌ [RecipePreparationsService] Error updating existing preparations status:",
        error
      );
    }
  }

  private async sendPreparationNotification(
    type: string,
    title: string,
    description: string,
    preparationId: number,
    recipeId: number,
    user_id?: number,
    metadata?: any,
    target_url?: string,
    workLocationId?: number,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit(
          { cmd: "recipes.notification" },
          {
            type,
            title,
            description,
            user_id,
            entity_id: preparationId,
            entity_type: "recipe_preparation",
            metadata: {
              ...metadata,
              recipeId,
              ...(workLocationId != null ? { work_location_id: workLocationId } : {}),
            },
            priority: "medium",
            target_url,
          }
        )
      );
    } catch (error) {
      console.error("Failed to send preparation notification:", error);
    }
  }

  async findAll(page = 1, limit = 50, locationId?: number) {
    const queryBuilder = this.prepRepo
      .createQueryBuilder("preparation")
      .leftJoinAndSelect("preparation.recipe", "recipe")
      .leftJoinAndSelect("recipe.category", "category");

    // Add location filter - if locationId is provided, filter by it
    // if not provided, still filter out preparations without location_id
    if (locationId !== undefined) {
      queryBuilder.andWhere("preparation.location_id = :locationId", {
        locationId,
      });
      console.log(
        "🔍 [RecipePreparationsService] Filtrăm preparations după location_id:",
        locationId
      );
    } else {
      // FILTRARE OBLIGATORIE - afișează DOAR preparations cu location_id setat
      queryBuilder.andWhere("preparation.location_id IS NOT NULL");
    }

    // Filtrează doar preparatele active (status = 'active' sau status IS NULL pentru compatibilitate)
    queryBuilder.andWhere(
      "(preparation.status = :activeStatus OR preparation.status IS NULL)",
      { activeStatus: "active" }
    );

    const rows = await queryBuilder
      .orderBy("preparation.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    // Expune consumabil_pentru_angajat pentru afișare în UI (alias pentru is_consumable)
    for (const row of rows) {
      (row as any).consumabil_pentru_angajat = row.is_consumable ?? false;
    }
    return rows;
  }

  async findOne(id: number, requester?: RecipeAccessRequester) {
    const p = await this.prepRepo.findOne({
      where: { id },
      relations: ["recipe", "recipe.category", "labels"],
    });
    if (!p) throw new NotFoundException("Preparation not found");
    await this.assertPreparationAccess(p, requester);
    await this.enrichWithProducedByName(p);
    return p;
  }

  /**
   * Încarcă numele angajatului (produced_by) din serviciul employees și îl expune ca produced_by_name.
   * Expune și consumabil_pentru_angajat (alias pentru is_consumable) pentru frontend.
   */
  private async enrichWithProducedByName(prep: RecipePreparation): Promise<void> {
    (prep as any).consumabil_pentru_angajat = prep.is_consumable ?? false;
    const employeeId = prep.produced_by;
    if (!employeeId) {
      (prep as any).produced_by_name = null;
      return;
    }
    try {
      const employeesServiceUrl =
        this.configService.get<string>("EMPLOYEES_HTTP_URL") || "http://localhost:3012";
      const serviceSecret = process.env.SERVICE_SECRET || '';
      const headers = {
        "Content-Type": "application/json",
        "x-internal-service": "recipes",
        "x-service-secret": serviceSecret,
      };
      const response: any = await firstValueFrom(
        this.httpService.get(`${employeesServiceUrl}/employees/${employeeId}`, { headers })
      );
      const data = response?.data?.data || response?.data || response;
      if (data?.name) {
        (prep as any).produced_by_name = data.name;
      } else if (data?.first_name && data?.last_name) {
        (prep as any).produced_by_name = `${data.first_name} ${data.last_name}`;
      } else {
        (prep as any).produced_by_name = `Angajat #${employeeId}`;
      }
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        console.warn(
          `⚠️ [RecipePreparationsService] Nu s-a putut încărca angajatul ${employeeId}:`,
          error?.message
        );
      }
      (prep as any).produced_by_name = `Angajat #${employeeId}`;
    }
  }

  private async assertPreparationAccess(
    prep: RecipePreparation,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    await this.recipesService.assertPreparationRecipeAccess(
      prep.recipe_id,
      prep.location_id,
      requester,
    );
  }

  async findMany(ids: number[], requester?: RecipeAccessRequester) {
    const unique = Array.from(
      new Set(
        (ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0)
      )
    );
    if (unique.length === 0) return [];
    const rows = await this.prepRepo.find({
      where: { id: In(unique) } as any,
      relations: ["recipe", "recipe.category", "labels"],
    });
    if (!requester || isRecipeAdminUser(requester.permissions || [])) {
      return rows;
    }
    const allowed: RecipePreparation[] = [];
    for (const row of rows) {
      try {
        await this.assertPreparationAccess(row, requester);
        allowed.push(row);
      } catch {
        // omit inaccessible preparations
      }
    }
    return allowed;
  }

  async create(
    dto: {
    recipe_id: number;
    employee_id?: number;
    location_id?: number;
    quantity: number;
    produced_at?: string;
  },
    requester?: RecipeAccessRequester,
  ) {
    await this.recipesService.assertPreparationRecipeAccess(
      dto.recipe_id,
      dto.location_id,
      requester,
    );
    const recipe = await this.recipeRepo.findOne({
      where: { id: dto.recipe_id },
    });
    if (!recipe) throw new NotFoundException("Rețeta nu a fost găsită");

    // STEP 1: Colectează toate ingredientele necesare (recursiv)
    const allIngredients = await this.collectAllIngredients(
      dto.recipe_id,
      dto.quantity
    );
    console.log(
      `🔍 [RecipePreparationsService] Collected ${allIngredients.length} ingredients for recipe ${dto.recipe_id}`
    );

    // STEP 2: Verifică disponibilitatea TUTUROR ingredientelor ÎNAINTE de a consuma ceva
    if (allIngredients.length > 0) {
      const serviceSecret =
        process.env.SERVICE_SECRET || '';
      const headers = {
        "x-internal-service": "recipes",
        "x-service-secret": serviceSecret,
      };

      try {
        const checkResponse = await lastValueFrom(
          this.httpService.post(
            `${this.stockServiceUrl}/stock/check-availability`,
            { products: allIngredients },
            { headers }
          )
        );

        const availabilityResult = checkResponse.data;
        if (!availabilityResult.available) {
          const missingDetails = availabilityResult.missing
            .map(
              (m: any) =>
                `${m.product_name || `Produs ${m.product_id}`}: necesar ${m.needed}, disponibil ${m.available}`
            )
            .join("; ");
          throw new BadRequestException(
            `Stoc insuficient pentru: ${missingDetails}`
          );
        }
        console.log(
          `✅ [RecipePreparationsService] All ingredients available for recipe ${dto.recipe_id}`
        );
      } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          "Eroare la verificarea stocului";
        throw new BadRequestException(
          `Eroare la verificarea disponibilității stocului: ${errorMessage}`
        );
      }
    }

    // STEP 3: Acum că știm că stocul e disponibil, creăm preparatul
    let isConsumable = false;
    if (dto.location_id) {
      const rl = await this.recipeLocationRepo.findOne({
        where: { recipeId: dto.recipe_id, idLocation: dto.location_id },
      });
      isConsumable = rl?.isConsumable ?? false;
    }
    const p = this.prepRepo.create({
      recipe_id: dto.recipe_id,
      produced_by: dto.employee_id,
      location_id: dto.location_id,
      quantity: dto.quantity as any,
      produced_at: dto.produced_at
        ? (new Date(dto.produced_at) as any)
        : (new Date() as any),
      is_labeled: false,
      is_consumable: isConsumable,
      status: "active",
    } as any);
    const saved: RecipePreparation = (await this.prepRepo.save(
      p as any
    )) as RecipePreparation;

    // Send notification for new preparation (work_location_id pentru [Locație] în notificare)
    const user_id = dto.employee_id || undefined;
    await this.sendPreparationNotification(
      "recipe_preparation_created",
      "Preparat realizat",
      `S-a creat ${dto.quantity}${(recipe as any).unit || "g"} de ${recipe.name}${user_id ? ` de către utilizatorul ${user_id}` : ""}`,
      saved.id,
      recipe.id,
      user_id,
      {
        recipeName: recipe.name,
        quantity: dto.quantity,
        producedBy: dto.employee_id,
      },
      `/retetar/preparate/${saved.id}`,
      saved.location_id ?? dto.location_id,
    );

    // STEP 4: Consumă stocul (acum suntem siguri că e disponibil)
    try {
      await this.consumeRecipeIngredients(
        dto.recipe_id,
        dto.quantity,
        saved.id
      );
    } catch (e) {
      // rollback preparation if stock consumption fails (shouldn't happen after check)
      console.error(
        `❌ [RecipePreparationsService] Rolling back preparation ${saved.id} due to stock consumption error`
      );
      try {
        await this.prepRepo.remove(saved);
      } catch (rollbackError) {
        console.error(
          `❌ [RecipePreparationsService] Error during rollback:`,
          rollbackError
        );
      }
      throw e;
    }

    // Returnează preparatul complet (cu recipe, produced_by_name, consumabil_pentru_angajat) ca la GET :id
    return this.findOne(saved.id);
  }

  /**
   * Colectează recursiv toate ingredientele (produse) necesare pentru o rețetă
   * Returnează o listă agregată de produse cu cantitățile totale necesare
   */
  private async collectAllIngredients(
    recipeId: number,
    quantity: number,
    visitedRecipeIds: Set<number> = new Set()
  ): Promise<Array<{ product_id: number; quantity: number }>> {
    // Previne referințe circulare
    if (visitedRecipeIds.has(recipeId)) {
      throw new BadRequestException(
        `Referință circulară detectată pentru rețeta ${recipeId}`
      );
    }
    visitedRecipeIds.add(recipeId);

    const fullRecipe = await this.recipeRepo.findOne({
      where: { id: recipeId },
      relations: [
        "recipe_products",
        "recipe_recipes",
        "recipe_recipes.ingredient_recipe",
      ],
    });

    if (!fullRecipe) {
      throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
    }

    const baseQty = Number(fullRecipe.quantity) || 1;
    const factor = Number(quantity) / baseQty;

    const ingredientsMap = new Map<number, number>();

    // 1. Adaugă produsele directe
    if (Array.isArray(fullRecipe.recipe_products)) {
      for (const rp of fullRecipe.recipe_products) {
        const neededTotal = Number(rp.quantity) * factor;
        if (!rp.product_id || !Number.isFinite(neededTotal) || neededTotal <= 0)
          continue;

        const current = ingredientsMap.get(rp.product_id) || 0;
        ingredientsMap.set(rp.product_id, current + neededTotal);
      }
    }

    // 2. Adaugă recursiv ingredientele din rețetele-ingrediente
    if (Array.isArray(fullRecipe.recipe_recipes)) {
      for (const rr of fullRecipe.recipe_recipes) {
        if (!rr.ingredient_recipe_id || !rr.ingredient_recipe) continue;

        if (rr.ingredient_recipe_id === recipeId) {
          throw new BadRequestException(
            `Rețeta ${recipeId} nu poate conține ca ingredient rețeta ${rr.ingredient_recipe_id} (referință circulară directă)`
          );
        }

        const neededRecipeQuantity = Number(rr.quantity) * factor;
        const newVisitedSet = new Set(visitedRecipeIds);
        const nestedIngredients = await this.collectAllIngredients(
          rr.ingredient_recipe_id,
          neededRecipeQuantity,
          newVisitedSet
        );

        for (const ni of nestedIngredients) {
          const current = ingredientsMap.get(ni.product_id) || 0;
          ingredientsMap.set(ni.product_id, current + ni.quantity);
        }
      }
    }

    return Array.from(ingredientsMap.entries()).map(([product_id, qty]) => ({
      product_id,
      quantity: qty,
    }));
  }

  /**
   * Consumă recursiv ingredientele unei rețete (produse directe + produse din rețete-ingrediente)
   * @param recipeId ID-ul rețetei
   * @param quantity Cantitatea de rețetă de preparat
   * @param preparationId ID-ul preparării (pentru tracking)
   * @param visitedRecipeIds Set pentru a preveni referințe circulare
   */
  private async consumeRecipeIngredients(
    recipeId: number,
    quantity: number,
    preparationId: number,
    visitedRecipeIds: Set<number> = new Set()
  ): Promise<void> {
    // Previne referințe circulare
    if (visitedRecipeIds.has(recipeId)) {
      throw new BadRequestException(
        `Referință circulară detectată pentru rețeta ${recipeId}`
      );
    }
    visitedRecipeIds.add(recipeId);

    // Obține rețeta completă cu toate ingredientele
    const fullRecipe = await this.recipeRepo.findOne({
      where: { id: recipeId },
      relations: [
        "recipe_products",
        "recipe_recipes",
        "recipe_recipes.ingredient_recipe",
      ],
    });

    if (!fullRecipe) {
      throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
    }

    // Calculează factorul de scalare
    const baseQty = Number(fullRecipe.quantity) || 1;
    const factor = Number(quantity) / baseQty;

    const serviceSecret =
      process.env.SERVICE_SECRET || '';
    const headers = {
      "x-internal-service": "recipes",
      "x-service-secret": serviceSecret,
    };

    // 1. Consumă produsele directe din rețetă
    if (Array.isArray(fullRecipe.recipe_products)) {
      for (const rp of fullRecipe.recipe_products) {
        const neededTotal = Number(rp.quantity) * factor;
        if (!rp.product_id || !Number.isFinite(neededTotal) || neededTotal <= 0)
          continue;

        console.log(
          `🔍 [RecipePreparationsService] Consuming ${neededTotal} units of product ${rp.product_id} for preparation ${preparationId}`
        );

        try {
          await lastValueFrom(
            this.httpService.post(
              `${this.stockServiceUrl}/stock/consume`,
              {
                product_id: rp.product_id,
                quantity: neededTotal,
                target: `recipe-preparation:${preparationId}`,
              },
              { headers }
            )
          );
          console.log(
            `✅ [RecipePreparationsService] Successfully consumed ${neededTotal} units of product ${rp.product_id}`
          );
        } catch (error: any) {
          console.error(
            `❌ [RecipePreparationsService] Error consuming product ${rp.product_id}:`,
            error?.response?.data || error?.message
          );
          const errorMessage =
            error?.response?.data?.message ||
            error?.message ||
            "Eroare necunoscută la consumarea stocului";
          throw new BadRequestException(
            `Cantitate insuficientă în stoc pentru produs ${rp.product_id}. ${errorMessage}`
          );
        }
      }
    }

    // 2. Consumă recursiv ingredientele din rețetele-ingrediente
    if (Array.isArray(fullRecipe.recipe_recipes)) {
      for (const rr of fullRecipe.recipe_recipes) {
        if (!rr.ingredient_recipe_id || !rr.ingredient_recipe) continue;

        // Calculează cantitatea necesară de rețetă-ingredient
        const neededRecipeQuantity = Number(rr.quantity) * factor;

        console.log(
          `🔍 [RecipePreparationsService] Consuming ${neededRecipeQuantity} units of recipe ${rr.ingredient_recipe_id} (${rr.ingredient_recipe.name}) for preparation ${preparationId}`
        );

        // Consumă recursiv ingredientele din rețeta-ingredient
        // IMPORTANT: Nu adăugăm rețeta-ingredient în visitedRecipeIds înainte de apelul recursiv
        // pentru a permite aceeași rețetă să fie folosită de mai multe ori în aceeași rețetă
        // (ex: burger cu 2 chifle = aceeași rețetă de chifla folosită de 2 ori)
        // Doar verificăm dacă există o referință circulară (rețetă care se referă la ea însăși)
        if (rr.ingredient_recipe_id === recipeId) {
          throw new BadRequestException(
            `Rețeta ${recipeId} nu poate conține ca ingredient rețeta ${rr.ingredient_recipe_id} (referință circulară directă)`
          );
        }

        // Creează un nou set pentru fiecare rețetă-ingredient
        // Acest set va preveni doar referințele circulare în ierarhie, nu utilizarea multiplă
        const newVisitedSet = new Set(visitedRecipeIds);
        await this.consumeRecipeIngredients(
          rr.ingredient_recipe_id,
          neededRecipeQuantity,
          preparationId,
          newVisitedSet
        );

        console.log(
          `✅ [RecipePreparationsService] Successfully consumed recipe ${rr.ingredient_recipe_id} (${rr.ingredient_recipe.name})`
        );
      }
    }
  }

  async update(
    id: number,
    dto: Partial<RecipePreparation>,
    requester?: RecipeAccessRequester,
  ) {
    const p = await this.findOne(id, requester);
    Object.assign(p, dto);
    return this.prepRepo.save(p);
  }

  async remove(id: number, requester?: RecipeAccessRequester) {
    const p = await this.findOne(id, requester);
    await this.prepRepo.remove(p);
  }

  // Composite: create preparation and return mock stock transactions
  async prepareWithStock(
    dto: {
    recipe_id: number;
    quantity: number;
    employee_id?: number;
    location_id?: number;
    produced_at?: string;
  },
    requester?: RecipeAccessRequester,
  ) {
    const preparation = await this.create(dto, requester);
    // mock stock transactions result for UI (stock integration can be added later)
    const stockTransactions = [
      {
        id: Date.now(),
        stock_id: 0,
        type: "exit",
        quantity: dto.quantity,
        location: "Bucătărie",
        target: `Preparare rețetă #${(preparation as any).id}`,
        timestamp: new Date().toISOString(),
      },
    ];
    return { preparation, stockTransactions };
  }
}
