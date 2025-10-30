import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Permissions } from '../permissions/permissions.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AssignCategoryDto } from './dto/assign-category.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';

@Controller('stock/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Permissions('stock.create')
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  @Permissions('stock.read')
  async findAll(): Promise<Category[]> {
    return this.categoryService.findAll();
  }

  @Get('type/:type')
  @Permissions('stock.read')
  async findByType(@Param('type') type: string): Promise<Category[]> {
    return this.categoryService.findByType(type);
  }

  @Get(':id')
  @Permissions('stock.read')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Category> {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @Permissions('stock.update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @Permissions('stock.delete')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoryService.remove(id);
  }

  @Post('products/:productId/assign')
  @Permissions('stock.update')
  async assignCategoriesToProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() assignCategoryDto: AssignCategoryDto,
  ): Promise<Product> {
    return this.categoryService.assignCategoriesToProduct(productId, assignCategoryDto);
  }

  @Get(':id/products')
  @Permissions('stock.read')
  async getProductsByCategory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Product[]> {
    return this.categoryService.getProductsByCategory(id);
  }
}