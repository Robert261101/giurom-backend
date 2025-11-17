import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { Response } from 'express';
import { Permissions } from '../permissions/permissions.decorator';
import { PermissionsGuard } from '../permissions/permissions.guard';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(PermissionsGuard)
export class SuppliersHttpController {
	constructor(private readonly service: SuppliersService) {}

	@Get()
	@Permissions('suppliers.read')
	getSuppliers(
		@Query('page') _page?: string, 
		@Query('limit') _limit?: string, 
		@Query('search') _search?: string, 
		@Query('is_active') _is_active?: string,
		@Query('location_id') location_id?: string
	) {
		const locationId = location_id ? parseInt(location_id, 10) : undefined;
		return this.service.findAll(locationId);
	}

	@Post()
	@Permissions('suppliers.create')
	create(@Body() dto: CreateSupplierDto) { return this.service.create(dto); }

	@Post('with-documents')
	@Permissions('suppliers.create')
	createWithDocs(@Body() dto: CreateSupplierWithDocumentsDto) { return this.service.createWithDocuments(dto); }

	@Get(':id')
	@Permissions('suppliers.read')
	findOne(@Param('id') id: string) { return this.service.findOne(Number(id)); }

	@Patch(':id')
	@Permissions('suppliers.update')
	update(@Param('id') id: string, @Body() dto: any) { return this.service.update(Number(id), dto); }

	@Delete(':id')
	@Permissions('suppliers.delete')
	remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

	// Products
	@Get(':supplierId/products') 
	@Permissions('suppliers.read')
	getProducts(@Param('supplierId') supplierId: string) { return this.service.getSupplierProducts(Number(supplierId)); }
	
	@Post('products') 
	@Permissions('suppliers.create')
	addProduct(@Body() dto: any) { return this.service.addProduct(dto); }
	
	@Patch('products/:productId') 
	@Permissions('suppliers.update')
	updateProduct(@Param('productId') productId: string, @Body() dto: any) { return this.service.updateSupplierProduct(Number(productId), dto); }
	
	@Delete('products/:productId') 
	@Permissions('suppliers.delete')
	removeProduct(@Param('productId') productId: string) { return this.service.removeSupplierProduct(Number(productId)); }

	// Orders
	@Get(':supplierId/orders') 
	@Permissions('suppliers.read')
	getOrders(
		@Param('supplierId') supplierId: string,
		@Query('location_id') location_id?: string
	) { 
		const locationId = location_id ? parseInt(location_id, 10) : undefined;
		return this.service.getSupplierOrders(Number(supplierId), locationId); 
	}
	
	@Post('orders') 
	@Permissions('suppliers.create')
	createOrder(@Body() dto: any) { return this.service.createOrder(dto); }
	
	@Patch('orders/:orderId/deliver') 
	@Permissions('suppliers.update')
	deliver(@Param('orderId') orderId: string) { return this.service.markOrderAsDelivered(Number(orderId)); }
	
	@Post('orders/partial-reception')
	@Permissions('suppliers.update')
	partialReception(@Body() dto: any) { return this.service.markOrderAsPartiallyReceived(dto); }
	
	@Get('orders/reception-report')
	@Permissions('suppliers.read')
	@ApiOperation({ summary: 'Raport recepții și returnări pe perioadă' })
	getReceptionReport(
		@Query('start_date') startDate: string,
		@Query('end_date') endDate: string
	) { 
		if (!startDate || !endDate) {
			throw new Error('start_date și end_date sunt obligatorii');
		}
		return this.service.getReceptionReport(startDate, endDate); 
	}
	
	@Get('orders/reception-report/events')
	@Permissions('suppliers.read')
	@ApiOperation({ summary: 'Evenimente individuale de recepție/returnare pe perioadă (cronologic)' })
	getReceptionEvents(
		@Query('start_date') startDate: string,
		@Query('end_date') endDate: string,
		@Query('order_id') orderId?: string,
		@Query('order_item_id') orderItemId?: string,
		@Query('product_id') productId?: string,
		@Query('user_id') userId?: string,
	) {
		if (!startDate || !endDate) {
			throw new Error('start_date și end_date sunt obligatorii');
		}
		return this.service.getReceptionEvents(
			startDate,
			endDate,
			orderId ? Number(orderId) : undefined,
			orderItemId ? Number(orderItemId) : undefined,
			productId ? Number(productId) : undefined,
			userId ? Number(userId) : undefined,
		);
	}
	
	@Patch('orders/:orderId/status') 
	@Permissions('suppliers.update')
	updateStatus(@Param('orderId') orderId: string, @Body() body: any) { return this.service.updateOrderStatus(Number(orderId), body.status); }
	@Get(':supplierId/orders/:orderId/email-link') 
	@Permissions('suppliers.read')
	emailLink(@Param('supplierId') supplierId: string, @Param('orderId') orderId: string) { return { emailLink: this.service.generateEmailLink(Number(supplierId), Number(orderId)) }; }
	
	@Get(':supplierId/orders/:orderId/whatsapp-link') 
	@Permissions('suppliers.read')
	whatsappLink(@Param('supplierId') supplierId: string, @Param('orderId') orderId: string) { return { whatsappLink: this.service.generateWhatsAppLink(Number(supplierId), Number(orderId)) }; }

	// Documents
	@Post(':supplierId/documents') 
	@Permissions('suppliers.create')
	addDocument(@Param('supplierId') supplierId: string, @Body() body: any) { return this.service.addDocument(Number(supplierId), body); }
	
	@Delete('documents/:documentId') 
	@Permissions('suppliers.delete')
	removeDocument(@Param('documentId') documentId: string) { return this.service.removeDocument(Number(documentId)); }

	// Serve supplier document (download or inline)
	@Get('file/:fileId')
	@Permissions('suppliers.read')
	async getSupplierFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Query('download') download: string,
		@Res() res: Response,
	) {
		const forceDownload = download === 'true';
		const served = await this.service.serveDocument(fileId, forceDownload);
		const buffer = Buffer.from(served.data, 'base64');
		res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
		res.setHeader(
			'Content-Disposition',
			`${forceDownload || served.disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${served.fileName}"`
		);
		res.setHeader('Content-Length', buffer.length.toString());
		return res.send(buffer);
	}

	@Get('file/:fileId/view')
	@Permissions('suppliers.read')
	async viewSupplierFile(
		@Param('fileId', ParseIntPipe) fileId: number,
		@Res() res: Response,
	) {
		const served = await this.service.serveDocument(fileId, false);
		const buffer = Buffer.from(served.data, 'base64');
		res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
		res.setHeader('Content-Disposition', `inline; filename="${served.fileName}"`);
		res.setHeader('Content-Length', buffer.length.toString());
		return res.send(buffer);
	}

	// === SUPPLIER LOCATIONS ENDPOINTS ===
	@Post(':supplierId/locations/:locationId')
	@Permissions('suppliers.create')
	@ApiOperation({ summary: 'Atribuie un furnizor la o locație' })
	@ApiParam({ name: 'supplierId', description: 'ID-ul furnizorului' })
	@ApiParam({ name: 'locationId', description: 'ID-ul locației' })
	@ApiResponse({ status: 201, description: 'Furnizorul a fost atribuit cu succes la locație' })
	assignSupplierToLocation(
		@Param('supplierId') supplierId: string,
		@Param('locationId') locationId: string,
	) {
		return this.service.assignSupplierToLocation(Number(supplierId), Number(locationId));
	}

	@Get(':supplierId/locations')
	@Permissions('suppliers.read')
	@ApiOperation({ summary: 'Listă locațiile unui furnizor' })
	@ApiParam({ name: 'supplierId', description: 'ID-ul furnizorului' })
	@ApiResponse({ status: 200, description: 'Lista locațiilor furnizorului' })
	findSupplierLocations(@Param('supplierId') supplierId: string) {
		return this.service.findSupplierLocations(Number(supplierId));
	}

	@Get('locations/:locationId/suppliers')
	@Permissions('suppliers.read')
	@ApiOperation({ summary: 'Listă furnizorii unei locații' })
	@ApiParam({ name: 'locationId', description: 'ID-ul locației' })
	@ApiResponse({ status: 200, description: 'Lista furnizorilor locației' })
	findLocationSuppliers(@Param('locationId') locationId: string) {
		return this.service.findLocationSuppliers(Number(locationId));
	}

	@Delete(':supplierId/locations/:locationId')
	@Permissions('suppliers.delete')
	@ApiOperation({ summary: 'Îndepărtează un furnizor dintr-o locație' })
	@ApiParam({ name: 'supplierId', description: 'ID-ul furnizorului' })
	@ApiParam({ name: 'locationId', description: 'ID-ul locației' })
	@ApiResponse({ status: 200, description: 'Furnizorul a fost îndepărtat cu succes din locație' })
	removeSupplierFromLocation(
		@Param('supplierId') supplierId: string,
		@Param('locationId') locationId: string,
	) {
		return this.service.removeSupplierFromLocation(Number(supplierId), Number(locationId));
	}

	// Get documents expiring on a specific date
	@Get('documents/expiring/:targetDate')
	@Permissions('suppliers.read')
	getExpiringDocuments(@Param('targetDate') targetDate: string) {
		console.log(`[SUPPLIERS CONTROLLER] Getting documents expiring on ${targetDate}`);
		return this.service.findExpiringDocuments(targetDate);
	}

	// Get documents that have already expired
	@Get('documents/expired')
	@Permissions('suppliers.read')
	getExpiredDocuments() {
		console.log(`[SUPPLIERS CONTROLLER] Getting expired documents`);
		return this.service.findExpiredDocuments();
	}
}

