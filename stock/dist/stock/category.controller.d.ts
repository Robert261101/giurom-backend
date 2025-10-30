import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AssignCategoryDto } from './dto/assign-category.dto';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
export declare class CategoryController {
    private readonly categoryService;
    constructor(categoryService: CategoryService);
    create(createCategoryDto: CreateCategoryDto): Promise<Category>;
    findAll(): Promise<Category[]>;
    findByType(type: string): Promise<Category[]>;
    findOne(id: number): Promise<Category>;
    update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category>;
    remove(id: number): Promise<void>;
    assignCategoriesToProduct(productId: number, assignCategoryDto: AssignCategoryDto): Promise<Product>;
    getProductsByCategory(id: number): Promise<Product[]>;
}
