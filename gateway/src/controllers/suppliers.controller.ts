import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, ParseIntPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('suppliers')
export class SuppliersController {
  constructor(@Inject('SUPPLIERS_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('suppliers.create', dto));
  }

  @Post('with-documents')
  async createWithDocuments(@Body() dto: any) {
    return await lastValueFrom(this.client.send('suppliers.createWithDocuments', dto));
  }

  @Get()
  async findAll() {
    return await lastValueFrom(this.client.send('suppliers.findAll', {}));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('suppliers.findOne', id));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('suppliers.update', { id, dto }));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('suppliers.remove', id));
  }

  // Products
  @Post('products')
  async addProduct(@Body() dto: any) {
    return await lastValueFrom(this.client.send('suppliers.products.add', dto));
  }

  @Get(':supplierId/products')
  async getSupplierProducts(@Param('supplierId', ParseIntPipe) supplierId: number) {
    return await lastValueFrom(this.client.send('suppliers.products.findBySupplier', supplierId));
  }

  @Patch('products/:productId')
  async updateSupplierProduct(@Param('productId', ParseIntPipe) productId: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('suppliers.products.update', { productId, dto }));
  }

  @Delete('products/:productId')
  async removeSupplierProduct(@Param('productId', ParseIntPipe) productId: number) {
    return await lastValueFrom(this.client.send('suppliers.products.remove', productId));
  }

  // Orders
  @Post('orders')
  async createOrder(@Body() dto: any) {
    return await lastValueFrom(this.client.send('suppliers.orders.create', dto));
  }

  @Get(':supplierId/orders')
  async getSupplierOrders(@Param('supplierId', ParseIntPipe) supplierId: number) {
    return await lastValueFrom(this.client.send('suppliers.orders.findBySupplier', supplierId));
  }

  @Patch('orders/:orderId/deliver')
  async markOrderAsDelivered(@Param('orderId', ParseIntPipe) orderId: number) {
    return await lastValueFrom(this.client.send('suppliers.orders.deliver', orderId));
  }

  @Patch('orders/:orderId/status')
  async updateOrderStatus(@Param('orderId', ParseIntPipe) orderId: number, @Body('status') status: string) {
    return await lastValueFrom(this.client.send('suppliers.orders.updateStatus', { orderId, status }));
  }

  // Documents
  @Post(':supplierId/documents')
  async addDocument(
    @Param('supplierId', ParseIntPipe) supplierId: number,
    @Body() documentData: { fileName: string; folderId: number; notes?: string; file_content?: string },
  ) {
    return await lastValueFrom(
      this.client.send('suppliers.documents.add', { supplierId, documentData }),
    );
  }

  @Delete('documents/:documentId')
  async removeDocument(@Param('documentId', ParseIntPipe) documentId: number) {
    return await lastValueFrom(this.client.send('suppliers.documents.remove', documentId));
  }
}


