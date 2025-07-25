import { Controller, Post, Get, Patch, Delete, Param, Body, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Creează produs' })
  @ApiResponse({ status: HttpStatus.CREATED, type: Product })
  createProduct(@Body() dto: CreateProductDto): Promise<Product> {
    return this.stockService.createProduct(dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Listează produse' })
  @ApiResponse({ status: HttpStatus.OK, type: [Product] })
  findAllProducts() {
    return this.stockService.findAllProducts();
  }

  @Get('products/:id')
  @ApiParam({ name: 'id', example: 1 })
  findProduct(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.findProduct(id);
  }

  @Patch('products/:id')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.stockService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteProduct(id);
  }



  /* STOCK ITEMS */
  @Post('items')
  createStock(@Body() dto: CreateStockDto): Promise<Stock> {
    return this.stockService.createStock(dto);
  }
  @Get('items')
  findAllStocks(): Promise<Stock[]> {
    return this.stockService.findAllStocks();
  }
  @Get('items/:id')
  findStock(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.findStock(id);
  }
  @Patch('items/:id')
  updateStock(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockDto) {
    return this.stockService.updateStock(id, dto);
  }
  @Delete('items/:id')
  deleteStock(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteStock(id);
  }

  /* TRANSACTIONS */
  @Post('transactions')
  createTransaction(@Body() dto: CreateStockTransactionDto): Promise<StockTransaction> {
    return this.stockService.createTransaction(dto);
  }
  @Get('transactions')
  findAllTransactions(): Promise<StockTransaction[]> {
    return this.stockService.findAllTransactions();
  }


} 