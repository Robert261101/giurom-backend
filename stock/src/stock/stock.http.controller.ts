import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';

@Controller('stock')
export class StockHttpController {
	constructor(private readonly service: StockService) {}

	// Products
	@Post('products') createProduct(@Body() dto: CreateProductDto) { return this.service.createProduct(dto); }
	@Get('products') getProducts() { return this.service.findAllProducts(); }
	@Get('products/:id') getProduct(@Param('id') id: string) { return this.service.findProduct(Number(id)); }
	@Patch('products/:id') updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.service.updateProduct(Number(id), dto); }
	@Delete('products/:id') deleteProduct(@Param('id') id: string) { return this.service.deleteProduct(Number(id)); }

	// Stock items
	@Post('items') createStock(@Body() dto: CreateStockDto) { return this.service.createStock(dto); }
	@Get('items') getStocks() { return this.service.findAllStocks(); }
	@Get('items/:id') getStock(@Param('id') id: string) { return this.service.findStock(Number(id)); }
	@Patch('items/:id') updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) { return this.service.updateStock(Number(id), dto); }
	@Delete('items/:id') deleteStock(@Param('id') id: string) { return this.service.deleteStock(Number(id)); }

	// Transactions
	@Post('transactions') createTx(@Body() dto: CreateStockTransactionDto) { return this.service.createTransaction(dto); }
	@Get('transactions') getTxs() { return this.service.findAllTransactions(); }

	// Consume product (FIFO by expiration)
	@Post('consume')
	consume(@Body() dto: { product_id: number; quantity: number; target?: string }) {
		return this.service.consumeProduct(Number(dto.product_id), Number(dto.quantity), dto.target);
	}

	// === WASTE RECORDS ===
	@Post('waste-records')
	createWasteRecord(@Body() dto: CreateWasteRecordDto) { return this.service.createWasteRecord(dto); }

	@Get('waste-records')
	getWasteRecords() { return this.service.findAllWasteRecords(); }

	@Get('waste-records/:id')
	getWasteRecord(@Param('id') id: string) { return this.service.findWasteRecord(Number(id)); }

	@Patch('waste-records/:id')
	updateWasteRecord(@Param('id') id: string, @Body() dto: UpdateWasteRecordDto) { return this.service.updateWasteRecord(Number(id), dto); }

	@Delete('waste-records/:id')
	deleteWasteRecord(@Param('id') id: string) { return this.service.deleteWasteRecord(Number(id)); }
}


