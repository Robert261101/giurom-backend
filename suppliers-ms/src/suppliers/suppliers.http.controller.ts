import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { Response } from 'express';

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersHttpController {
	constructor(private readonly service: SuppliersService) {}

	@Get()
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
	@Get(':supplierId/orders') getOrders(
		@Param('supplierId') supplierId: string,
		@Query('location_id') location_id?: string
	) { 
		const locationId = location_id ? parseInt(location_id, 10) : undefined;
		return this.service.getSupplierOrders(Number(supplierId), locationId); 
	}
	@Post('orders') createOrder(@Body() dto: any) { return this.service.createOrder(dto); }
	@Patch('orders/:orderId/deliver') deliver(@Param('orderId') orderId: string) { return this.service.markOrderAsDelivered(Number(orderId)); }
	@Patch('orders/:orderId/status') updateStatus(@Param('orderId') orderId: string, @Body() body: any) { return this.service.updateOrderStatus(Number(orderId), body.status); }
	@Get(':supplierId/orders/:orderId/email-link') emailLink(@Param('supplierId') supplierId: string, @Param('orderId') orderId: string) { return { emailLink: this.service.generateEmailLink(Number(supplierId), Number(orderId)) }; }
	@Get(':supplierId/orders/:orderId/whatsapp-link') whatsappLink(@Param('supplierId') supplierId: string, @Param('orderId') orderId: string) { return { whatsappLink: this.service.generateWhatsAppLink(Number(supplierId), Number(orderId)) }; }

	// Documents
	@Post(':supplierId/documents') addDocument(@Param('supplierId') supplierId: string, @Body() body: any) { return this.service.addDocument(Number(supplierId), body); }
	@Delete('documents/:documentId') removeDocument(@Param('documentId') documentId: string) { return this.service.removeDocument(Number(documentId)); }

	// Serve supplier document (download or inline)
	@Get('file/:fileId')
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
	@ApiOperation({ summary: 'Listă locațiile unui furnizor' })
	@ApiParam({ name: 'supplierId', description: 'ID-ul furnizorului' })
	@ApiResponse({ status: 200, description: 'Lista locațiilor furnizorului' })
	findSupplierLocations(@Param('supplierId') supplierId: string) {
		return this.service.findSupplierLocations(Number(supplierId));
	}

	@Get('locations/:locationId/suppliers')
	@ApiOperation({ summary: 'Listă furnizorii unei locații' })
	@ApiParam({ name: 'locationId', description: 'ID-ul locației' })
	@ApiResponse({ status: 200, description: 'Lista furnizorilor locației' })
	findLocationSuppliers(@Param('locationId') locationId: string) {
		return this.service.findLocationSuppliers(Number(locationId));
	}

	@Delete(':supplierId/locations/:locationId')
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
}


