import { Controller, Post, Get, Patch, Delete, Param, Body, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { StockService } from './stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { Product } from './entities/product.entity';
import { Stock } from './entities/stock.entity';
import { StockTransaction } from './entities/stock-transaction.entity';

@ApiTags('stock')
@Controller('stock')
@ApiBearerAuth()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  /* PRODUCTS */
  @Post('products')
  @Permissions('stock:products:create')
  @ApiOperation({ summary: 'Creează produs' })
  @ApiResponse({ status: HttpStatus.CREATED, type: Product })
  createProduct(@Body() dto: CreateProductDto): Promise<Product> {
    return this.stockService.createProduct(dto);
  }

  @Get('products')
  @Permissions('stock:products:read')
  @ApiOperation({ summary: 'Listează produse' })
  @ApiResponse({ status: HttpStatus.OK, type: [Product] })
  findAllProducts() {
    return this.stockService.findAllProducts();
  }

  @Get('products/:id')
  @Permissions('stock:products:read')
  @ApiParam({ name: 'id', example: 1 })
  findProduct(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.findProduct(id);
  }

  @Patch('products/:id')
  @Permissions('stock:products:update')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.stockService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @Permissions('stock:products:delete')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteProduct(id);
  }



  /* STOCK ITEMS */
  @Post('items')
  @Permissions('stock:items:create')
  createStock(@Body() dto: CreateStockDto): Promise<Stock> {
    return this.stockService.createStock(dto);
  }
  
  @Get('items')
  @Permissions('stock:items:read')
  findAllStocks(): Promise<Stock[]> {
    return this.stockService.findAllStocks();
  }
  
  @Get('items/:id')
  @Permissions('stock:items:read')
  findStock(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.findStock(id);
  }
  
  @Patch('items/:id')
  @Permissions('stock:items:update')
  updateStock(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockDto) {
    return this.stockService.updateStock(id, dto);
  }
  
  @Delete('items/:id')
  @Permissions('stock:items:delete')
  deleteStock(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteStock(id);
  }

  /* TRANSACTIONS */
  @Post('transactions')
  @Permissions('stock:transactions:create')
  createTransaction(@Body() dto: CreateStockTransactionDto): Promise<StockTransaction> {
    return this.stockService.createTransaction(dto);
  }
  
  @Get('transactions')
  @Permissions('stock:transactions:read')
  findAllTransactions(): Promise<StockTransaction[]> {
    return this.stockService.findAllTransactions();
  }


} 