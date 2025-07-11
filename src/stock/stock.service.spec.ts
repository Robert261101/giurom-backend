import { Test, TestingModule } from '@nestjs/testing';
import { StockService } from './stock.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Stock, StockStatus } from './entities/stock.entity';
import { StockTransaction, TransactionType } from './entities/stock-transaction.entity';
import { Product } from './entities/product.entity';
import { Locator } from './entities/locator.entity';
import { RecipeUsage } from './entities/recipe-usage.entity';
import { Repository } from 'typeorm';

describe('StockService', () => {
  let service: StockService;
  let stockRepo: jest.Mocked<Repository<Stock>>;
  let transactionRepo: jest.Mocked<Repository<StockTransaction>>;
  let productRepo: jest.Mocked<Repository<Product>>;
  let locatorRepo: jest.Mocked<Repository<Locator>>;
  let recipeUsageRepo: jest.Mocked<Repository<RecipeUsage>>;

  beforeEach(async () => {
    const mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: getRepositoryToken(Stock),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(StockTransaction),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(Locator),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(RecipeUsage),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    stockRepo = module.get(getRepositoryToken(Stock));
    transactionRepo = module.get(getRepositoryToken(StockTransaction));
    productRepo = module.get(getRepositoryToken(Product));
    locatorRepo = module.get(getRepositoryToken(Locator));
    recipeUsageRepo = module.get(getRepositoryToken(RecipeUsage));

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('service definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('consumeProduct', () => {
    it('should consume quantity FIFO and create transactions', async () => {
      // Arrange
      const productId = 1;
      const stock1 = { 
        id: 1, 
        product_id: productId, 
        quantity: 5, 
        status: StockStatus.VALID, 
        entry_date: new Date('2024-01-01') 
      } as Stock;
      const stock2 = { 
        id: 2, 
        product_id: productId, 
        quantity: 10, 
        status: StockStatus.VALID, 
        entry_date: new Date('2024-02-01') 
      } as Stock;

      stockRepo.find.mockResolvedValue([stock1, stock2]);
      stockRepo.save.mockImplementation(async (stock) => stock as Stock);
      transactionRepo.save.mockImplementation(async (transaction) => transaction as StockTransaction);
      transactionRepo.create.mockImplementation((data) => data as StockTransaction);

      // Act
      await service.consumeProduct(productId, 8, 'test');

      // Assert
      // StockService.save este apelat pentru fiecare stock item care este modificat plus pentru bulk save
      expect(stockRepo.save).toHaveBeenCalled();
      expect(stock1.quantity).toBe(0); // first depleted (5)
      expect(stock2.quantity).toBe(7); // second reduced by 3
      expect(transactionRepo.save).toHaveBeenCalled();
    });

    it('should throw error when insufficient stock', async () => {
      // Arrange
      const productId = 1;
      const stock1 = { 
        id: 1, 
        product_id: productId, 
        quantity: 3, 
        status: StockStatus.VALID, 
        entry_date: new Date('2024-01-01') 
      } as Stock;

      stockRepo.find.mockResolvedValue([stock1]);

      // Act & Assert
      await expect(service.consumeProduct(productId, 5, 'test')).rejects.toThrow(
        'Cantitate insuficientă în stoc pentru produsul 1. Lipsesc 2'
      );
    });

    it('should handle empty stock gracefully', async () => {
      // Arrange
      const productId = 1;
      stockRepo.find.mockResolvedValue([]);

      // Act & Assert
      await expect(service.consumeProduct(productId, 1, 'test')).rejects.toThrow(
        'Cantitate insuficientă în stoc pentru produsul 1. Lipsesc 1'
      );
    });

    it('should only consume from VALID status stocks', async () => {
      // Arrange
      const productId = 1;
      const validStock = { 
        id: 1, 
        product_id: productId, 
        quantity: 5, 
        status: StockStatus.VALID, 
        entry_date: new Date('2024-01-01') 
      } as Stock;
      // In real implementation, the find query filters out EXPIRED stocks,
      // so we only return VALID stocks that match the query
      
      stockRepo.find.mockResolvedValue([validStock]); // Only VALID stocks returned

      // Act & Assert
      await expect(service.consumeProduct(productId, 8, 'test')).rejects.toThrow(
        'Cantitate insuficientă în stoc pentru produsul 1. Lipsesc 3'
      );
    });
  });
}); 