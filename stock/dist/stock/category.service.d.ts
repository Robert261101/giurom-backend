import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AssignCategoryDto } from './dto/assign-category.dto';
export declare class CategoryService {
    private categoryRepository;
    private productRepository;
    constructor(categoryRepository: Repository<Category>, productRepository: Repository<Product>);
    create(createCategoryDto: CreateCategoryDto): Promise<Category>;
    findAll(): Promise<Category[]>;
    findOne(id: number): Promise<Category>;
    update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category>;
    remove(id: number): Promise<void>;
    findByType(type: string): Promise<Category[]>;
    assignCategoriesToProduct(productId: number, assignCategoryDto: AssignCategoryDto): Promise<Product>;
    getProductsByCategory(categoryId: number): Promise<Product[]>;
}
