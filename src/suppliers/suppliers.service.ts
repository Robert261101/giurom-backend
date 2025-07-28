import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder, OrderStatus } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './entities/supplier-order-document.entity';
import { Product } from '../stock/entities/product.entity';
import { Stock } from '../stock/entities/stock.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierFolder)
    private readonly folderRepo: Repository<SupplierFolder>,
    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepo: Repository<SupplierProduct>,
    @InjectRepository(SupplierOrder)
    private readonly orderRepo: Repository<SupplierOrder>,
    @InjectRepository(SupplierOrderItem)
    private readonly orderItemRepo: Repository<SupplierOrderItem>,
    @InjectRepository(SupplierOrderDocument)
    private readonly orderDocumentRepo: Repository<SupplierOrderDocument>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
  ) {}

  // 1. Creare Furnizor cu structură de foldere
  async create(dto: CreateSupplierDto): Promise<Supplier> {
    // Verifică unicitatea registration_number și vat_number
    const existingSupplier = await this.supplierRepo.findOne({
      where: [
        { registration_number: dto.registration_number },
        { vat_number: dto.vat_number },
      ],
    });

    if (existingSupplier) {
      throw new BadRequestException('Furnizorul cu acest număr de înregistrare sau cod fiscal există deja');
    }

    // Creează furnizorul
    const supplier = this.supplierRepo.create(dto);
    const savedSupplier = await this.supplierRepo.save(supplier);

    // Creează structura de foldere
    await this.createSupplierFolders(savedSupplier);

    return savedSupplier;
  }

  private async createSupplierFolders(supplier: Supplier): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const basePath = `/suppliers/${supplier.id}/${supplierNameSimplified}`;

    // Creează folderele fizice
    const suppliersDir = path.join(process.cwd(), 'suppliers');
    const supplierDir = path.join(suppliersDir, supplier.id.toString(), supplierNameSimplified);
    const dataDir = path.join(supplierDir, 'data');
    const ordersDir = path.join(supplierDir, 'orders');

    if (!fs.existsSync(suppliersDir)) fs.mkdirSync(suppliersDir, { recursive: true });
    if (!fs.existsSync(supplierDir)) fs.mkdirSync(supplierDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });

    // Salvează în baza de date
    const folders = [
      {
        supplier_id: supplier.id,
        description: 'Folder pentru documente și contracte',
        folder_path: `${basePath}/data/`,
      },
      {
        supplier_id: supplier.id,
        description: 'Folder pentru comenzi și PDF-uri generate',
        folder_path: `${basePath}/orders/`,
      },
    ];

    for (const folderData of folders) {
      const folder = this.folderRepo.create(folderData);
      await this.folderRepo.save(folder);
    }
  }

  private simplifySupplierName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  // CRUD basic pentru furnizori
  async findAll(): Promise<Supplier[]> {
    return this.supplierRepo.find({
      relations: ['folders', 'products', 'orders'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({
      where: { id },
      relations: ['folders', 'products', 'orders', 'orders.items', 'orders.documents'],
    });

    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    return supplier;
  }

  async update(id: number, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);
    
    // Verifică unicitatea dacă se schimbă registration_number sau vat_number
    if (dto.registration_number || dto.vat_number) {
      const existingSupplier = await this.supplierRepo.findOne({
        where: [
          { registration_number: dto.registration_number },
          { vat_number: dto.vat_number },
        ],
      });

      if (existingSupplier && existingSupplier.id !== id) {
        throw new BadRequestException('Un alt furnizor cu acest număr de înregistrare sau cod fiscal există deja');
      }
    }

    Object.assign(supplier, dto);
    return this.supplierRepo.save(supplier);
  }

  async remove(id: number): Promise<void> {
    const supplier = await this.findOne(id);
    await this.supplierRepo.remove(supplier);
  }

  // 3. Gestionare Produse Furnizor
  async addProduct(dto: CreateSupplierProductDto): Promise<SupplierProduct> {
    // Verifică dacă furnizorul există
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    // Verifică dacă produsul există în nomenclator
    const product = await this.productRepo.findOne({ where: { id: dto.product_id } });
    if (!product) {
      throw new NotFoundException('Produsul nu a fost găsit în nomenclator');
    }

    // Verifică dacă asocierea există deja
    const existingProduct = await this.supplierProductRepo.findOne({
      where: { supplier_id: dto.supplier_id, product_id: dto.product_id },
    });

    if (existingProduct) {
      throw new BadRequestException('Produsul este deja asociat cu acest furnizor');
    }

    const supplierProduct = this.supplierProductRepo.create(dto);
    return this.supplierProductRepo.save(supplierProduct);
  }

  async getSupplierProducts(supplierId: number): Promise<SupplierProduct[]> {
    return this.supplierProductRepo.find({
      where: { supplier_id: supplierId },
      relations: ['product'],
      order: { created_at: 'DESC' },
    });
  }

  // 4. Plasare Comenzi Furnizori
  async createOrder(dto: CreateSupplierOrderDto): Promise<SupplierOrder> {
    // Verifică dacă furnizorul există
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    // Verifică dacă toate produsele există
    for (const item of dto.items) {
      const product = await this.productRepo.findOne({ where: { id: item.product_id } });
      if (!product) {
        throw new NotFoundException(`Produsul cu ID ${item.product_id} nu a fost găsit`);
      }
    }

    // Creează comanda
    const orderData = {
      supplier_id: dto.supplier_id,
      order_date: new Date(dto.order_date),
      delivery_date: new Date(dto.delivery_date),
      status: dto.status || OrderStatus.DRAFT,
      notes: dto.notes,
      created_by_user_id: dto.created_by_user_id,
      total_amount: 0,
    };

    const order = this.orderRepo.create(orderData);
    const savedOrder = await this.orderRepo.save(order);

    // Creează items și calculează totalul
    let totalAmount = 0;
    const orderItems = [];

    for (const itemDto of dto.items) {
      const subtotal = itemDto.quantity * itemDto.price_per_unit;
      totalAmount += subtotal;

      const orderItem = this.orderItemRepo.create({
        order_id: savedOrder.id,
        product_id: itemDto.product_id,
        quantity: itemDto.quantity,
        price_per_unit: itemDto.price_per_unit,
        subtotal,
      });

      const savedItem = await this.orderItemRepo.save(orderItem);
      orderItems.push(savedItem);
    }

    // Actualizează totalul comenzii
    savedOrder.total_amount = totalAmount;
    await this.orderRepo.save(savedOrder);

    // Generează PDF-ul comenzii
    await this.generateOrderPDF(savedOrder, orderItems, supplier);

    return this.orderRepo.findOne({
      where: { id: savedOrder.id },
      relations: ['items', 'items.product', 'documents'],
    });
  }

  private async generateOrderPDF(order: SupplierOrder, items: SupplierOrderItem[], supplier: Supplier): Promise<void> {
    // Implementare simplificată - în realitate ar folosi o bibliotecă PDF
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const fileName = `comanda_${order.id}_${supplierNameSimplified}.pdf`;
    const filePath = `/suppliers/${supplier.id}/${supplierNameSimplified}/orders/${fileName}`;
    
    // Salvează documentul în baza de date
    const document = this.orderDocumentRepo.create({
      order_id: order.id,
      document_type: 'order_pdf',
      file_name: fileName,
      file_path: filePath,
    });

    await this.orderDocumentRepo.save(document);
  }

  // 5. Actualizare Stoc Automat la Livrare
  async markOrderAsDelivered(orderId: number): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Comanda este deja marcată ca livrată');
    }

    // Marchează comanda ca livrată
    order.status = OrderStatus.DELIVERED;
    await this.orderRepo.save(order);

    // Adaugă produsele în stoc
    for (const item of order.items) {
      const stockEntry = this.stockRepo.create({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price_per_unit,
        entry_date: order.delivery_date,
        status: 'valid' as any,
        supplier_order_item_id: item.id,
      });

      await this.stockRepo.save(stockEntry);
    }

    return order;
  }

  // 6. Istoric Comenzi și Linkuri
  async getSupplierOrders(supplierId: number): Promise<SupplierOrder[]> {
    return this.orderRepo.find({
      where: { supplier_id: supplierId },
      relations: ['items', 'items.product', 'documents'],
      order: { created_at: 'DESC' },
    });
  }

  generateEmailLink(supplier: Supplier, order: SupplierOrder): string {
    const subject = encodeURIComponent(`Comandă #${order.id} - ${supplier.supplier_name}`);
    const body = encodeURIComponent(`Bună ziua,\n\nVă transmitem comanda #${order.id} în valoare de ${order.total_amount} RON.\n\nCu stimă,\nEchipa Giurom`);
    return `mailto:${supplier.email}?subject=${subject}&body=${body}`;
  }

  generateWhatsAppLink(supplier: Supplier, order: SupplierOrder, pdfUrl: string): string {
    const message = encodeURIComponent(`Bună ziua! Vă transmitem comanda #${order.id} în valoare de ${order.total_amount} RON. PDF: ${pdfUrl}`);
    const phone = supplier.phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${phone}?text=${message}`;
  }
}
