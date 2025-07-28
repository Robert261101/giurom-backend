import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { Supplier } from './entities/supplier.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder } from './entities/supplier-order.entity';

@ApiTags('suppliers')
@Controller('suppliers')
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // CRUD Furnizori
  @Post()
  @ApiOperation({ summary: 'Creează un furnizor nou cu structură de foldere' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Furnizorul a fost creat cu succes',
    type: Supplier,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide sau furnizor duplicat',
  })
  create(@Body() createSupplierDto: CreateSupplierDto): Promise<Supplier> {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obține lista tuturor furnizorilor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista furnizorilor',
    type: [Supplier],
  })
  findAll(): Promise<Supplier[]> {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obține detaliile unui furnizor' })
  @ApiParam({ name: 'id', description: 'ID-ul furnizorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detaliile furnizorului',
    type: Supplier,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Furnizorul nu a fost găsit',
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Supplier> {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizează un furnizor' })
  @ApiParam({ name: 'id', description: 'ID-ul furnizorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Furnizorul a fost actualizat',
    type: Supplier,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Furnizorul nu a fost găsit',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge un furnizor' })
  @ApiParam({ name: 'id', description: 'ID-ul furnizorului' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Furnizorul a fost șters',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Furnizorul nu a fost găsit',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.suppliersService.remove(id);
  }

  // Gestionare Produse Furnizor
  @Post('products')
  @ApiOperation({ summary: 'Adaugă un produs la un furnizor' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Produsul a fost adăugat la furnizor',
    type: SupplierProduct,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Produsul este deja asociat cu furnizorul',
  })
  addProduct(@Body() createSupplierProductDto: CreateSupplierProductDto): Promise<SupplierProduct> {
    return this.suppliersService.addProduct(createSupplierProductDto);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Obține produsele unui furnizor' })
  @ApiParam({ name: 'id', description: 'ID-ul furnizorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista produselor furnizorului',
    type: [SupplierProduct],
  })
  getSupplierProducts(@Param('id', ParseIntPipe) id: number): Promise<SupplierProduct[]> {
    return this.suppliersService.getSupplierProducts(id);
  }

  // Gestionare Comenzi
  @Post('orders')
  @ApiOperation({ summary: 'Creează o comandă către un furnizor' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Comanda a fost creată cu succes',
    type: SupplierOrder,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Furnizorul sau produsul nu a fost găsit',
  })
  createOrder(@Body() createSupplierOrderDto: CreateSupplierOrderDto): Promise<SupplierOrder> {
    return this.suppliersService.createOrder(createSupplierOrderDto);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Obține comenzile unui furnizor' })
  @ApiParam({ name: 'id', description: 'ID-ul furnizorului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista comenzilor furnizorului',
    type: [SupplierOrder],
  })
  getSupplierOrders(@Param('id', ParseIntPipe) id: number): Promise<SupplierOrder[]> {
    return this.suppliersService.getSupplierOrders(id);
  }

  @Patch('orders/:orderId/deliver')
  @ApiOperation({ summary: 'Marchează o comandă ca livrată și actualizează stocul' })
  @ApiParam({ name: 'orderId', description: 'ID-ul comenzii' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comanda a fost marcată ca livrată și stocul a fost actualizat',
    type: SupplierOrder,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Comanda nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Comanda este deja marcată ca livrată',
  })
  markOrderAsDelivered(@Param('orderId', ParseIntPipe) orderId: number): Promise<SupplierOrder> {
    return this.suppliersService.markOrderAsDelivered(orderId);
  }

  // Linkuri pentru comunicare
  @Get(':supplierId/orders/:orderId/email-link')
  @ApiOperation({ summary: 'Generează link pentru email cu comanda' })
  @ApiParam({ name: 'supplierId', description: 'ID-ul furnizorului' })
  @ApiParam({ name: 'orderId', description: 'ID-ul comenzii' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Link-ul pentru email',
    schema: {
      type: 'object',
      properties: {
        emailLink: { type: 'string', example: 'mailto:contact@supplier.com?subject=...' },
      },
    },
  })
  async generateEmailLink(
    @Param('supplierId', ParseIntPipe) supplierId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<{ emailLink: string }> {
    const supplier = await this.suppliersService.findOne(supplierId);
    const orders = await this.suppliersService.getSupplierOrders(supplierId);
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      throw new Error('Comanda nu a fost găsită');
    }

    const emailLink = this.suppliersService.generateEmailLink(supplier, order);
    return { emailLink };
  }

  @Get(':supplierId/orders/:orderId/whatsapp-link')
  @ApiOperation({ summary: 'Generează link pentru WhatsApp cu comanda' })
  @ApiParam({ name: 'supplierId', description: 'ID-ul furnizorului' })
  @ApiParam({ name: 'orderId', description: 'ID-ul comenzii' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Link-ul pentru WhatsApp',
    schema: {
      type: 'object',
      properties: {
        whatsappLink: { type: 'string', example: 'https://wa.me/40123456789?text=...' },
      },
    },
  })
  async generateWhatsAppLink(
    @Param('supplierId', ParseIntPipe) supplierId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<{ whatsappLink: string }> {
    const supplier = await this.suppliersService.findOne(supplierId);
    const orders = await this.suppliersService.getSupplierOrders(supplierId);
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      throw new Error('Comanda nu a fost găsită');
    }

    // Simulează URL-ul PDF-ului
    const pdfUrl = `${process.env.FRONTEND_URL}/suppliers/${supplierId}/orders/${orderId}/pdf`;
    const whatsappLink = this.suppliersService.generateWhatsAppLink(supplier, order, pdfUrl);
    return { whatsappLink };
  }
}
