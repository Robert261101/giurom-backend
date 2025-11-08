import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { Permissions } from '../permissions/permissions.decorator';
import { StockService } from './stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';
import { CreateConsumptionRecordDto } from './dto/create-consumption-record.dto';
import { UpdateConsumptionRecordDto } from './dto/update-consumption-record.dto';
import { AssignCategoryDto } from './dto/assign-category.dto';

@Controller('stock')
export class StockHttpController {
	constructor(private readonly service: StockService) {}

	// Products
	@Post('products') @Permissions('stock.create') createProduct(@Body() dto: CreateProductDto) { return this.service.createProduct(dto); }
	@Get('products') @Permissions('stock.read') getProducts() { return this.service.findAllProducts(); }
	@Get('products/:id') @Permissions('stock.read') getProduct(@Param('id') id: string) { return this.service.findProduct(Number(id)); }
	@Patch('products/:id') @Permissions('stock.update') updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.service.updateProduct(Number(id), dto); }
	@Delete('products/:id') @Permissions('stock.delete') deleteProduct(@Param('id') id: string) { return this.service.deleteProduct(Number(id)); }

	// Stock items
	@Post('items') @Permissions('stock.create') createStock(@Body() dto: CreateStockDto) { return this.service.createStock(dto); }
	@Get('items') @Permissions('stock.read') getStocks(@Query('location_id') locationId?: string) { return this.service.findAllStocks(locationId ? Number(locationId) : undefined); }
	@Get('items/:id') @Permissions('stock.read') getStock(@Param('id') id: string) { return this.service.findStock(Number(id)); }
	@Patch('items/:id') @Permissions('stock.update') updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) { return this.service.updateStock(Number(id), dto); }
	@Delete('items/:id') @Permissions('stock.delete') deleteStock(@Param('id') id: string) { return this.service.deleteStock(Number(id)); }

	// Transactions
	@Post('transactions') @Permissions('stock.create') createTx(@Body() dto: CreateStockTransactionDto) { return this.service.createTransaction(dto); }
	@Get('transactions') @Permissions('stock.read') getTxs() { return this.service.findAllTransactions(); }

	// Consume product (FIFO by expiration)
	@Post('consume') @Permissions('stock.update')
	consume(@Body() dto: { product_id: number; quantity: number; target?: string; employee_id?: number; location_id?: number }) {
		return this.service.consumeProduct(Number(dto.product_id), Number(dto.quantity), dto.target, dto.employee_id, dto.location_id);
	}

	// === WASTE RECORDS ===
	@Post('waste-records') @Permissions('stock.create')
	createWasteRecord(@Body() dto: CreateWasteRecordDto) { return this.service.createWasteRecord(dto); }

	@Get('waste-records') @Permissions('stock.read')
	getWasteRecords() { return this.service.findAllWasteRecords(); }

	@Get('waste-records/:id') @Permissions('stock.read')
	getWasteRecord(@Param('id') id: string) { return this.service.findWasteRecord(Number(id)); }

	@Patch('waste-records/:id') @Permissions('stock.update')
	updateWasteRecord(@Param('id') id: string, @Body() dto: UpdateWasteRecordDto) { return this.service.updateWasteRecord(Number(id), dto); }

	@Delete('waste-records/:id') @Permissions('stock.delete')
	deleteWasteRecord(@Param('id') id: string) { return this.service.deleteWasteRecord(Number(id)); }

  // === CATEGORY ENDPOINTS ===
  @Get('categories')
  getCategories() { return this.service.findAllCategories(); }

  @Get('categories/type/:type')
  getCategoriesByType(@Param('type') type: string) { return this.service.findCategoriesByType(type); }

  @Get('products-with-categories')
  getProductsWithCategories() { return this.service.findProductsWithCategories(); }

  @Post('products/:id/categories')
  assignCategoriesToProduct(
    @Param('id') id: string,
    @Body() assignCategoryDto: AssignCategoryDto
  ) { 
    return this.service.assignCategoriesToProduct(Number(id), assignCategoryDto); 
  }

  // === MANUAL NOTIFICATION TRIGGERS ===
  @Post('trigger-expiring-check') @Permissions('stock.update')
  triggerExpiringProductsCheck() { 
    return this.service.checkExpiringProducts(); 
  }

  @Post('trigger-low-stock-check') @Permissions('stock.update')
  triggerLowStockCheck() { 
    return this.service.checkLowStockProducts(); 
  }

  // === CONSUMPTION RECORDS ===
  @Post('consumption-records') @Permissions('stock.create')
  createConsumptionRecord(@Body() dto: CreateConsumptionRecordDto) { 
    return this.service.createConsumptionRecord(dto); 
  }

  @Get('consumption-records') @Permissions('stock.read')
  getConsumptionRecords(
    @Query('product_id') productId?: string,
    @Query('location_id') locationId?: string,
    @Query('employee_id') employeeId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) { 
    const filters = {
      ...(productId && { product_id: Number(productId) }),
      ...(locationId && { location_id: Number(locationId) }),
      ...(employeeId && { employee_id: Number(employeeId) }),
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate })
    };
    return this.service.findAllConsumptionRecords(Object.keys(filters).length > 0 ? filters : undefined); 
  }

  @Get('consumption-records/:id') @Permissions('stock.read')
  getConsumptionRecord(@Param('id') id: string) { 
    return this.service.findConsumptionRecord(Number(id)); 
  }

  @Patch('consumption-records/:id') @Permissions('stock.update')
  updateConsumptionRecord(@Param('id') id: string, @Body() dto: UpdateConsumptionRecordDto) { 
    return this.service.updateConsumptionRecord(Number(id), dto); 
  }

  @Delete('consumption-records/:id') @Permissions('stock.delete')
  deleteConsumptionRecord(@Param('id') id: string) { 
    return this.service.deleteConsumptionRecord(Number(id)); 
  }

  @Get('consumption-records/stats') @Permissions('stock.read')
  getConsumptionStats(
    @Query('product_id') productId?: string,
    @Query('location_id') locationId?: string,
    @Query('employee_id') employeeId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) { 
    const filters = {
      ...(productId && { product_id: Number(productId) }),
      ...(locationId && { location_id: Number(locationId) }),
      ...(employeeId && { employee_id: Number(employeeId) }),
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate })
    };
    return this.service.getConsumptionStats(Object.keys(filters).length > 0 ? filters : undefined); 
  }

  @Post('consume-for-recipe') @Permissions('stock.update')
  consumeForRecipe(@Body() payload: { 
    recipe_preparation_id: number; 
    ingredients: Array<{ product_id: number; quantity: number }>; 
    employee_id: number; 
    location_id: number 
  }) {
    return this.service.consumeForRecipePreparation(payload);
  }
}


