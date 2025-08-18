import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';

@Controller('suppliers')
export class SuppliersHttpController {
	constructor(private readonly service: SuppliersService) {}

	@Get()
	getSuppliers(@Query('page') _page?: string, @Query('limit') _limit?: string, @Query('search') _search?: string, @Query('is_active') _is_active?: string) {
		return this.service.findAll();
	}

	@Post()
	create(@Body() dto: CreateSupplierDto) { return this.service.create(dto); }

	@Post('with-documents')
	createWithDocs(@Body() dto: CreateSupplierWithDocumentsDto) { return this.service.createWithDocuments(dto); }

	@Get(':id')
	findOne(@Param('id') id: string) { return this.service.findOne(Number(id)); }

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: any) { return this.service.update(Number(id), dto); }

	@Delete(':id')
	remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

	// Products
	@Get(':supplierId/products') getProducts(@Param('supplierId') supplierId: string) { return this.service.getSupplierProducts(Number(supplierId)); }
	@Post('products') addProduct(@Body() dto: any) { return this.service.addProduct(dto); }
	@Patch('products/:productId') updateProduct(@Param('productId') productId: string, @Body() dto: any) { return this.service.updateSupplierProduct(Number(productId), dto); }
	@Delete('products/:productId') removeProduct(@Param('productId') productId: string) { return this.service.removeSupplierProduct(Number(productId)); }

	// Orders
	@Get(':supplierId/orders') getOrders(@Param('supplierId') supplierId: string) { return this.service.getSupplierOrders(Number(supplierId)); }
	@Post('orders') createOrder(@Body() dto: any) { return this.service.createOrder(dto); }
	@Patch('orders/:orderId/deliver') deliver(@Param('orderId') orderId: string) { return this.service.markOrderAsDelivered(Number(orderId)); }
	@Patch('orders/:orderId/status') updateStatus(@Param('orderId') orderId: string, @Body() body: any) { return this.service.updateOrderStatus(Number(orderId), body.status); }
	@Get(':supplierId/orders/:orderId/email-link') emailLink(@Param('supplierId') supplierId: string, @Param('orderId') orderId: string) { return { emailLink: this.service.generateEmailLink(Number(supplierId), Number(orderId)) }; }
	@Get(':supplierId/orders/:orderId/whatsapp-link') whatsappLink(@Param('supplierId') supplierId: string, @Param('orderId') orderId: string) { return { whatsappLink: this.service.generateWhatsAppLink(Number(supplierId), Number(orderId)) }; }

	// Documents
	@Post(':supplierId/documents') addDocument(@Param('supplierId') supplierId: string, @Body() body: any) { return this.service.addDocument(Number(supplierId), body); }
	@Delete('documents/:documentId') removeDocument(@Param('documentId') documentId: string) { return this.service.removeDocument(Number(documentId)); }
}


