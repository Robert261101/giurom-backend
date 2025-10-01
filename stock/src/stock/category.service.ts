import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AssignCategoryDto } from './dto/assign-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' }
    });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['products']
    });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    await this.categoryRepository.update(id, updateCategoryDto);
    return this.categoryRepository.findOne({ where: { id } }) as Promise<Category>;
  }

  async remove(id: number): Promise<void> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    await this.categoryRepository.delete(id);
  }

  async findByType(type: string): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { type, is_active: true },
      order: { name: 'ASC' }
    });
  }

  async assignCategoriesToProduct(productId: number, assignCategoryDto: AssignCategoryDto): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['categories']
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (assignCategoryDto.category_ids) {
      const categories = await this.categoryRepository.findByIds(assignCategoryDto.category_ids);
      product.categories = categories;
    } else {
      product.categories = [];
    }

    return this.productRepository.save(product);
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: ['products']
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category.products;
  }
}