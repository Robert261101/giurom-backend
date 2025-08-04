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
  BadRequestException,
} from "@nestjs/common";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Request } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiExtraModels,
} from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { RecipesService } from "./recipes.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { UpdateRecipeDto } from "./dto/update-recipe.dto";
import { CreateRecipeCategoryDto } from "./dto/create-recipe-category.dto";
import { UpdateRecipeCategoryDto } from "./dto/update-recipe-category.dto";
import { CreateRecipeProductDto } from "./dto/create-recipe-product.dto";
import { UpdateRecipeProductDto } from "./dto/update-recipe-product.dto";
import { Recipe } from "./entities/recipe.entity";
import { RecipeCategory } from "./entities/recipe-category.entity";
import { RecipeProduct } from "./entities/recipe-product.entity";
import { Product } from "../stock/entities/product.entity";

@ApiTags("recipes")
@Controller("recipes")
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
@ApiExtraModels(Recipe, RecipeCategory, RecipeProduct, Product)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  // RECIPE CATEGORY ENDPOINTS
  @Post("categories")
  @Permissions("recipes:categories:create")
  @ApiOperation({
    summary: "Creează o nouă categorie de rețete",
    description:
      "Creează o categorie nouă pentru organizarea rețetelor cu validare de unicitate.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Categoria a fost creată cu succes",
    type: RecipeCategory,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Categoria cu acest nume există deja",
  })
  async createRecipeCategory(
    @Body() createCategoryDto: CreateRecipeCategoryDto
  ): Promise<RecipeCategory> {
    return await this.recipesService.createRecipeCategory(createCategoryDto);
  }

  @Get("categories")
  @Permissions("recipes:categories:read")
  @ApiOperation({
    summary: "Listează toate categoriile de rețete",
    description:
      "Returnează o listă paginată cu toate categoriile de rețete cu opțiuni de căutare.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Numărul paginii",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Numărul de rezultate pe pagină",
    example: 10,
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Căutare după numele categoriei",
    example: "supe",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista categoriilor a fost returnată cu succes",
  })
  async findAllRecipeCategories(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.recipesService.findAllRecipeCategories(
      pageNum,
      limitNum,
      search
    );
  }

  @Get("categories/:id")
  @Permissions("recipes:categories:read")
  @ApiOperation({
    summary: "Obține o categorie după ID",
    description:
      "Returnează detaliile complete ale unei categorii inclusiv rețetele asociate.",
  })
  @ApiParam({ name: "id", description: "ID-ul categoriei", example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Categoria a fost găsită cu succes",
    type: RecipeCategory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Categoria nu a fost găsită",
  })
  async findRecipeCategoryById(
    @Param("id", ParseIntPipe) id: number
  ): Promise<RecipeCategory> {
    return await this.recipesService.findRecipeCategoryById(id);
  }

  @Patch("categories/:id")
  @Permissions("recipes:categories:update")
  @ApiOperation({
    summary: "Actualizează o categorie de rețete",
    description:
      "Actualizează datele unei categorii existente cu validare de unicitate.",
  })
  @ApiParam({ name: "id", description: "ID-ul categoriei", example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Categoria a fost actualizată cu succes",
    type: RecipeCategory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Categoria nu a fost găsită",
  })
  async updateRecipeCategory(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateRecipeCategoryDto
  ): Promise<RecipeCategory> {
    return await this.recipesService.updateRecipeCategory(
      id,
      updateCategoryDto
    );
  }

  @Delete("categories/:id")
  @Permissions("recipes:categories:delete")
  @ApiOperation({
    summary: "Șterge o categorie de rețete",
    description: "Șterge o categorie doar dacă nu are rețete asociate.",
  })
  @ApiParam({ name: "id", description: "ID-ul categoriei", example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Categoria a fost ștersă cu succes",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Categoria nu poate fi ștersă pentru că are rețete asociate",
  })
  async deleteRecipeCategory(
    @Param("id", ParseIntPipe) id: number
  ): Promise<void> {
    return await this.recipesService.deleteRecipeCategory(id);
  }

  // RECIPE ENDPOINTS
  @Post()
  @Permissions("recipes:create")
  @ApiOperation({
    summary: "Creează o nouă rețetă",
    description:
      "Creează o rețetă nouă cu validare completă a tuturor câmpurilor.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Rețeta a fost creată cu succes",
    type: Recipe,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Date invalide pentru rețetă",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Categoria specificată nu a fost găsită",
  })
  async createRecipe(
    @Req() req: Request,
    @Body() createRecipeDto: CreateRecipeDto
  ): Promise<Recipe> {
    console.log("=== Request Debug Info ===");
    console.log("Headers:", req.headers);
    console.log("Raw body:", req.body);

    console.log("=== DTO Debug Info ===");
    console.log("Received DTO:", createRecipeDto);

    // Manual instantiation test
    const manualDto = new CreateRecipeDto();
    Object.assign(manualDto, req.body);
    console.log("Manual DTO:", manualDto);

    if (!createRecipeDto.name) {
      throw new BadRequestException({
        statusCode: 400,
        error: "Debug Info",
        message: "Name is missing",
        receivedBody: req.body,
        receivedDto: createRecipeDto,
        manualDto: manualDto,
      });
    }

    return await this.recipesService.createRecipe(createRecipeDto);
  }

  @Get()
  @Permissions("recipes:read")
  @ApiOperation({
    summary: "Listează toate rețetele",
    description:
      "Returnează o listă paginată cu toate rețetele cu opțiuni avansate de filtrare și căutare.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Numărul paginii",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Numărul de rezultate pe pagină",
    example: 10,
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Căutare după numele sau descrierea rețetei",
    example: "supă",
  })
  @ApiQuery({
    name: "category_id",
    required: false,
    description: "Filtrare după categoria rețetei",
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista rețetelor a fost returnată cu succes",
  })
  async findAllRecipes(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("category_id") category_id?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const categoryIdNum = category_id ? parseInt(category_id, 10) : undefined;
    return await this.recipesService.findAllRecipes(
      pageNum,
      limitNum,
      search,
      categoryIdNum
    );
  }

  @Get(":id")
  @Permissions("recipes:read")
  @ApiOperation({
    summary: "Obține o rețetă după ID",
    description:
      "Returnează detaliile complete ale unei rețete inclusiv categoria și produsele.",
  })
  @ApiParam({ name: "id", description: "ID-ul rețetei", example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Rețeta a fost găsită cu succes",
    type: Recipe,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Rețeta nu a fost găsită",
  })
  async findRecipeById(@Param("id", ParseIntPipe) id: number): Promise<Recipe> {
    return await this.recipesService.findRecipeById(id);
  }

  @Patch(":id")
  @Permissions("recipes:update")
  @ApiOperation({
    summary: "Actualizează o rețetă",
    description:
      "Actualizează datele unei rețete existente cu validare completă.",
  })
  @ApiParam({ name: "id", description: "ID-ul rețetei", example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Rețeta a fost actualizată cu succes",
    type: Recipe,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Rețeta nu a fost găsită",
  })
  async updateRecipe(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRecipeDto: UpdateRecipeDto
  ): Promise<Recipe> {
    return await this.recipesService.updateRecipe(id, updateRecipeDto);
  }

  @Delete(":id")
  @Permissions("recipes:delete")
  @ApiOperation({
    summary: "Șterge o rețetă",
    description: "Șterge definitiv o rețetă și toate asocierile cu produsele.",
  })
  @ApiParam({ name: "id", description: "ID-ul rețetei", example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Rețeta a fost ștersă cu succes",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Rețeta nu a fost găsită",
  })
  async deleteRecipe(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return await this.recipesService.deleteRecipe(id);
  }

  // RECIPE PRODUCT ENDPOINTS
  @Post("recipe-products")
  @Permissions("recipes:products:create")
  @ApiOperation({
    summary: "Adaugă un produs la o rețetă",
    description:
      "Creează o asociere între o rețetă și un produs cu cantitatea specificată.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Produsul a fost adăugat cu succes la rețetă",
    type: RecipeProduct,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Produsul este deja adăugat în rețetă",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Rețeta sau produsul nu a fost găsit",
  })
  async addProductToRecipe(
    @Body() createRecipeProductDto: CreateRecipeProductDto
  ): Promise<RecipeProduct> {
    return await this.recipesService.addProductToRecipe(createRecipeProductDto);
  }

  @Get(":recipe_id/products")
  @Permissions("recipes:products:read")
  @ApiOperation({
    summary: "Listează produsele unei rețete",
    description:
      "Returnează toate produsele folosite într-o rețetă cu cantitățile specificate.",
  })
  @ApiParam({ name: "recipe_id", description: "ID-ul rețetei", example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista produselor a fost returnată cu succes",
  })
  async findRecipeProducts(
    @Param("recipe_id", ParseIntPipe) recipe_id: number
  ): Promise<RecipeProduct[]> {
    return await this.recipesService.findRecipeProducts(recipe_id);
  }

  @Patch("recipe-products/:id")
  @Permissions("recipes:products:update")
  @ApiOperation({
    summary: "Actualizează cantitatea unui produs în rețetă",
    description:
      "Modifică cantitatea sau notele pentru un produs dintr-o rețetă.",
  })
  @ApiParam({
    name: "id",
    description: "ID-ul asocierii rețetă-produs",
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Asocierea a fost actualizată cu succes",
    type: RecipeProduct,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Asocierea nu a fost găsită",
  })
  async updateRecipeProduct(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRecipeProductDto: UpdateRecipeProductDto
  ): Promise<RecipeProduct> {
    return await this.recipesService.updateRecipeProduct(
      id,
      updateRecipeProductDto
    );
  }

  @Delete("recipe-products/:id")
  @Permissions("recipes:products:delete")
  @ApiOperation({
    summary: "Elimină un produs din rețetă",
    description: "Șterge asocierea dintre o rețetă și un produs.",
  })
  @ApiParam({
    name: "id",
    description: "ID-ul asocierii rețetă-produs",
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Produsul a fost eliminat cu succes din rețetă",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Asocierea nu a fost găsită",
  })
  async removeProductFromRecipe(
    @Param("id", ParseIntPipe) id: number
  ): Promise<void> {
    return await this.recipesService.removeProductFromRecipe(id);
  }

  // STATISTICS ENDPOINT
  @Get("statistics/overview")
  @ApiOperation({
    summary: "Obține statistici generale despre rețete",
    description:
      "Generează rapoarte și statistici detaliate despre rețete, categorii și produse.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Statisticile au fost generate cu succes",
  })
  async getRecipeStatistics() {
    return await this.recipesService.getRecipeStatistics();
  }
}
