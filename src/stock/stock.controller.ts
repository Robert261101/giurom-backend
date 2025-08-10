import { Controller, Post, Get, Patch, Delete, Param, Body, ParseIntPipe, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
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
  constructor(@Inject('STOCK_SERVICE') private readonly stockClient: ClientProxy) {}

  /* PRODUCTS */
  @Post('products')
  @Permissions('stock:products:create')
  @ApiOperation({ summary: 'Creează produs' })
  @ApiResponse({ status: HttpStatus.CREATED, type: Product })
  createProduct(@Body() dto: CreateProductDto): Promise<Product> {
    return lastValueFrom(this.stockClient.send<Product>('stock.products.create', dto));
  }

  @Get('products')
  @Permissions('stock:products:read')
  @ApiOperation({ summary: 'Listează produse' })
  @ApiResponse({ status: HttpStatus.OK, type: [Product] })
  findAllProducts() {
    return lastValueFrom(this.stockClient.send<Product[]>('stock.products.findAll', {}));
  }

  @Get('products/:id')
  @Permissions('stock:products:read')
  @ApiParam({ name: 'id', example: 1 })
  findProduct(@Param('id', ParseIntPipe) id: number) {
    return lastValueFrom(this.stockClient.send<Product>('stock.products.findOne', id));
  }

  @Patch('products/:id')
  @Permissions('stock:products:update')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return lastValueFrom(this.stockClient.send<Product>('stock.products.update', { id, dto }));
  }

  @Delete('products/:id')
  @Permissions('stock:products:delete')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return lastValueFrom(this.stockClient.send<void>('stock.products.delete', id));
  }

  /* STOCK ITEMS */
  @Post('items')
  @Permissions('stock:items:create')
  createStock(@Body() dto: CreateStockDto): Promise<Stock> {
    return lastValueFrom(this.stockClient.send<Stock>('stock.items.create', dto));
  }
  
  @Get('items')
  @Permissions('stock:items:read')
  findAllStocks(): Promise<Stock[]> {
    return lastValueFrom(this.stockClient.send<Stock[]>('stock.items.findAll', {}));
  }
  
  @Get('items/:id')
  @Permissions('stock:items:read')
  findStock(@Param('id', ParseIntPipe) id: number) {
    return lastValueFrom(this.stockClient.send<Stock>('stock.items.findOne', id));
  }
  
  @Patch('items/:id')
  @Permissions('stock:items:update')
  updateStock(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockDto) {
    return lastValueFrom(this.stockClient.send<Stock>('stock.items.update', { id, dto }));
  }
  
  @Delete('items/:id')
  @Permissions('stock:items:delete')
  deleteStock(@Param('id', ParseIntPipe) id: number) {
    return lastValueFrom(this.stockClient.send<void>('stock.items.delete', id));
  }

  /* TRANSACTIONS */
  @Post('transactions')
  @Permissions('stock:transactions:create')
  createTransaction(@Body() dto: CreateStockTransactionDto): Promise<StockTransaction> {
    return lastValueFrom(this.stockClient.send<StockTransaction>('stock.transactions.create', dto));
  }
  
  @Get('transactions')
  @Permissions('stock:transactions:read')
  findAllTransactions(): Promise<StockTransaction[]> {
    return lastValueFrom(this.stockClient.send<StockTransaction[]>('stock.transactions.findAll', {}));
  }
} 