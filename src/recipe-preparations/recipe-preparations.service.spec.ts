import { Test, TestingModule } from '@nestjs/testing';
import { RecipePreparationsService } from './recipe-preparations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { Employee } from '../employee/entity/employee.entity';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity';
import { RecipeLabelsService } from '../recipe-labels/recipe-labels.service';
import { StockService } from '../stock/stock.service';

describe('RecipePreparationsService', () => {
  let service: RecipePreparationsService;
  let stockService: jest.Mocked<StockService>;
  let labelsService: jest.Mocked<RecipeLabelsService>;
  let recipeIngredientRepo: any;
  let recipeRepo: any;
  let employeeRepo: any;
  let prepRepo: any;

  beforeEach(async () => {
    const mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipePreparationsService,
        {
          provide: getRepositoryToken(RecipePreparation),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Recipe),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(RecipeIngredient),
          useValue: mockRepo,
        },
        {
          provide: RecipeLabelsService,
          useValue: {
            generateForPreparation: jest.fn(),
          },
        },
        {
          provide: StockService,
          useValue: {
            consumeProduct: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecipePreparationsService>(RecipePreparationsService);
    stockService = module.get(StockService);
    labelsService = module.get(RecipeLabelsService);
    recipeIngredientRepo = module.get(getRepositoryToken(RecipeIngredient));
    recipeRepo = module.get(getRepositoryToken(Recipe));
    employeeRepo = module.get(getRepositoryToken(Employee));
    prepRepo = module.get(getRepositoryToken(RecipePreparation));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should consume ingredients from stock and generate label when creating labeled preparation', async () => {
    // Arrange
    const mockRecipe = { id: 1, name: 'Supă de legume', expiration_days: 7 };
    const mockEmployee = { id: 1, first_name: 'Ion', last_name: 'Popescu' };
    const mockIngredients = [
      { ingredient_id: 10, quantity_grams: 100 }, // cartofi
      { ingredient_id: 20, quantity_grams: 50 },  // ceapă
    ];
    const mockPreparation = { id: 1, recipe_id: 1, employee_id: 1, quantity: 4, is_labeled: true };

    recipeRepo.findOne.mockResolvedValue(mockRecipe);
    employeeRepo.findOne.mockResolvedValue(mockEmployee);
    prepRepo.create.mockReturnValue(mockPreparation);
    prepRepo.save.mockResolvedValue(mockPreparation);
    recipeIngredientRepo.find.mockResolvedValue(mockIngredients);
    stockService.consumeProduct.mockResolvedValue(undefined);
    labelsService.generateForPreparation.mockResolvedValue({} as any);

    const createDto = {
      recipe_id: 1,
      employee_id: 1,
      quantity: 4,
      produced_at: '2024-07-07T10:00:00Z',
      is_labeled: true,
    };

    // Act
    await service.create(createDto);

    // Assert
    // Verifică că ingredientele au fost consumate din stoc
    expect(stockService.consumeProduct).toHaveBeenCalledWith(10, 100, 'recipe-preparation 1');
    expect(stockService.consumeProduct).toHaveBeenCalledWith(20, 50, 'recipe-preparation 1');
    expect(stockService.consumeProduct).toHaveBeenCalledTimes(2);

    // Verifică că eticheta a fost generată
    expect(labelsService.generateForPreparation).toHaveBeenCalledWith(1);
  });

  it('should not generate label when is_labeled is false', async () => {
    // Arrange
    const mockRecipe = { id: 1, name: 'Supă de legume' };
    const mockEmployee = { id: 1, first_name: 'Ion', last_name: 'Popescu' };
    const mockPreparation = { id: 1, recipe_id: 1, employee_id: 1, quantity: 4, is_labeled: false };

    recipeRepo.findOne.mockResolvedValue(mockRecipe);
    employeeRepo.findOne.mockResolvedValue(mockEmployee);
    prepRepo.create.mockReturnValue(mockPreparation);
    prepRepo.save.mockResolvedValue(mockPreparation);
    recipeIngredientRepo.find.mockResolvedValue([]);

    const createDto = {
      recipe_id: 1,
      employee_id: 1,
      quantity: 4,
      produced_at: '2024-07-07T10:00:00Z',
      is_labeled: false,
    };

    // Act
    await service.create(createDto);

    // Assert
    expect(labelsService.generateForPreparation).not.toHaveBeenCalled();
  });
}); 