import { Controller, Get, Post, Patch, Delete, Body, Param, Inject, ParseIntPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('stock')
export class StockController {
  constructor(@Inject('STOCK_SERVICE') private readonly client: ClientProxy) {}

  // Products
  @Post('products')
  async createProduct(@Body() dto: any) {
    return await lastValueFrom(this.client.send('stock.products.create', dto));
  }

  @Get('products')
  async findAllProducts() {
    return await lastValueFrom(this.client.send('stock.products.findAll', {}));
  }

  @Get('products/:id')
  async findProduct(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('stock.products.findOne', id));
  }

  @Patch('products/:id')
  async updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('stock.products.update', { id, dto }));
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('stock.products.delete', id));
  }

  // Stock items
  @Post('items')
  async createStock(@Body() dto: any) {
    return await lastValueFrom(this.client.send('stock.items.create', dto));
  }

  @Get('items')
  async findAllStocks() {
    return await lastValueFrom(this.client.send('stock.items.findAll', {}));
  }

  @Get('items/:id')
  async findStock(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('stock.items.findOne', id));
  }

  @Patch('items/:id')
  async updateStock(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('stock.items.update', { id, dto }));
  }

  @Delete('items/:id')
  async deleteStock(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('stock.items.delete', id));
  }

  // Transactions
  @Post('transactions')
  async createTransaction(@Body() dto: any) {
    return await lastValueFrom(this.client.send('stock.transactions.create', dto));
  }

  @Get('transactions')
  async findAllTransactions() {
    return await lastValueFrom(this.client.send('stock.transactions.findAll', {}));
  }
}


