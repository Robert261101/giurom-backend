import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder, OrderStatus } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './entities/supplier-order-document.entity';
import { SupplierDocument, DocumentType } from './entities/supplier-document.entity';
import { SupplierLocations } from './entities/supplier-locations.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { StockHttpService, CreateStockItemDto } from './stock-http.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);
  private readonly locationsServiceUrl: string;
  constructor(
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierFolder) private readonly folderRepo: Repository<SupplierFolder>,
    @InjectRepository(SupplierProduct) private readonly supplierProductRepo: Repository<SupplierProduct>,
    @InjectRepository(SupplierOrder) private readonly orderRepo: Repository<SupplierOrder>,
    @InjectRepository(SupplierOrderItem) private readonly orderItemRepo: Repository<SupplierOrderItem>,
    @InjectRepository(SupplierOrderDocument) private readonly orderDocumentRepo: Repository<SupplierOrderDocument>,
    @InjectRepository(SupplierDocument) private readonly supplierDocumentRepo: Repository<SupplierDocument>,
    @InjectRepository(SupplierLocations) private readonly supplierLocationsRepo: Repository<SupplierLocations>,
    private readonly stockHttpService: StockHttpService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.locationsServiceUrl = this.configService.get<string>('LOCATIONS_HTTP_URL') || 'http://localhost:3005';
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const existingSupplier = await this.supplierRepo.findOne({
      where: [
        { registration_number: dto.registration_number },
        { vat_number: dto.vat_number },
      ],
    });
    if (existingSupplier) {
      throw new BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
    }
    
    // Separate location_id from supplier data
    const { location_id, ...supplierData } = dto;
    
    const supplier = this.supplierRepo.create(supplierData);
    const savedSupplier = (await this.supplierRepo.save(supplier as any)) as Supplier;
    await this.createSupplierFolders(savedSupplier);
    
    // Automatically assign supplier to location if location_id is provided
    if (location_id) {
      try {
        await this.assignSupplierToLocation(savedSupplier.id, location_id);
      } catch (error: any) {
        // Log the error but don't fail the supplier creation
        console.warn(`Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`, error?.message || error);
      }
    }
    
    return savedSupplier;
  }

  async createWithDocuments(dto: CreateSupplierWithDocumentsDto): Promise<Supplier> {
    const existingSupplier = await this.supplierRepo.findOne({
      where: [
        { registration_number: dto.registration_number },
        { vat_number: dto.vat_number },
      ],
    });
    if (existingSupplier) {
      throw new BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
    }
    
    // Separate special fields from supplier data
    const supplierData = { ...dto } as any;
    const { location_id } = dto;
    delete supplierData.folderName;
    delete supplierData.documents;
    delete supplierData.location_id;
    
    const supplier = this.supplierRepo.create(supplierData);
    const savedSupplier = (await this.supplierRepo.save(supplier as any)) as Supplier;
    await this.createSupplierFoldersWithCustomName(savedSupplier, dto.folderName, dto.documents);
    
    // Automatically assign supplier to location if location_id is provided
    if (location_id) {
      try {
        await this.assignSupplierToLocation(savedSupplier.id, location_id);
      } catch (error: any) {
        // Log the error but don't fail the supplier creation
        console.warn(`Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`, error?.message || error);
      }
    }
    
    return savedSupplier;
  }

  private getRepoRoot(): string {
    // Try computing from __dirname first
    let repoRoot = path.resolve(__dirname, '../../..'); // src -> suppliers-ms -> giurom-backend -> giurom
    if (path.basename(repoRoot) === 'giurom-backend') {
      // In case resolution ended at giurom-backend due to different runtime path depth
      repoRoot = path.dirname(repoRoot);
    }
    return repoRoot;
  }

  private async createSupplierFolders(supplier: Supplier): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const repoRoot = this.getRepoRoot();
    const filesDir = path.join(repoRoot, 'files');
    const suppliersDir = path.join(filesDir, 'suppliers');
    const supplierDir = path.join(suppliersDir, supplier.id.toString(), supplierNameSimplified);
    const dataDir = path.join(supplierDir, 'data');
    const ordersDir = path.join(supplierDir, 'orders');

    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    if (!fs.existsSync(suppliersDir)) fs.mkdirSync(suppliersDir, { recursive: true });
    if (!fs.existsSync(supplierDir)) fs.mkdirSync(supplierDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });

    const basePath = `/files/suppliers/${supplier.id}/${supplierNameSimplified}`;
    const folders = [
      { supplier_id: supplier.id, description: 'Folder pentru documente și contracte', folder_path: `${basePath}/data/` },
      { supplier_id: supplier.id, description: 'Folder pentru comenzi și PDF-uri generate', folder_path: `${basePath}/orders/` },
    ];
    for (const folderData of folders) {
      const folder = this.folderRepo.create(folderData);
      await this.folderRepo.save(folder);
    }
  }

  private async createSupplierFoldersWithCustomName(supplier: Supplier, customFolderName?: string, documents?: any[]): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const repoRoot = this.getRepoRoot();
    const filesDir = path.join(repoRoot, 'files');
    const suppliersDir = path.join(filesDir, 'suppliers');
    const supplierDir = path.join(suppliersDir, supplier.id.toString(), supplierNameSimplified);
    const dataDir = path.join(supplierDir, 'data');
    const ordersDir = path.join(supplierDir, 'orders');

    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    if (!fs.existsSync(suppliersDir)) fs.mkdirSync(suppliersDir, { recursive: true });
    if (!fs.existsSync(supplierDir)) fs.mkdirSync(supplierDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });

    const basePath = `/files/suppliers/${supplier.id}/${supplierNameSimplified}`;
    const documentFolderName = customFolderName || 'Folder pentru documente și contracte';
    const folders = [
      { supplier_id: supplier.id, description: documentFolderName, folder_path: `${basePath}/data/` },
      { supplier_id: supplier.id, description: 'Folder pentru comenzi și PDF-uri generate', folder_path: `${basePath}/orders/` },
    ];

    const savedFolders: SupplierFolder[] = [];
    for (const folderData of folders) {
      const folder = this.folderRepo.create(folderData);
      const savedFolder = await this.folderRepo.save(folder);
      savedFolders.push(savedFolder);
    }

    if (documents && documents.length > 0 && savedFolders[0]) {
      const documentFolder = savedFolders[0];
      for (const doc of documents) {
        try {
          const fileName = doc.fileName || doc.name;
          const timestamp = Date.now();
          const uniqueFileName = `${timestamp}_${fileName}`;
          const filePath = path.join(dataDir, uniqueFileName);
          if (doc.content && doc.content.startsWith('data:')) {
            const base64Data = doc.content.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);
          } else {
            const fileContent = `Document: ${fileName}\nNote: ${doc.note || doc.notes || ''}\nUpload: ${new Date().toISOString()}\nFurnizor: ${supplier.supplier_name}`;
            fs.writeFileSync(filePath, fileContent, 'utf8');
          }
          const documentData = {
            folder_id: documentFolder.id,
            document_type: DocumentType.OTHER,
            file_name: fileName,
            file_path: `${basePath}/data/${uniqueFileName}`,
            notes: doc.note || doc.notes || '',
          };
          const document = this.supplierDocumentRepo.create(documentData);
          await this.supplierDocumentRepo.save(document);
        } catch {}
      }
    }
  }

  private simplifySupplierName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
  }

  async serveDocument(fileId: number, forceDownload: boolean): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
    const document = await this.supplierDocumentRepo.findOne({ where: { id: fileId } });
    if (!document) throw new NotFoundException('Documentul nu a fost găsit');
    const repoRoot = this.getRepoRoot();
    const absolutePath = path.join(repoRoot, document.file_path.startsWith('/files') ? document.file_path : `/files${document.file_path}`);
    const buffer = fs.readFileSync(absolutePath);
    const fileExt = document.file_name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
    const mimeType = mimeMap[fileExt] || 'application/octet-stream';
    const disposition: 'inline' | 'attachment' = forceDownload ? 'attachment' : 'inline';
    return { data: buffer.toString('base64'), mimeType, fileName: document.file_name, disposition };
  }

  async findAll(locationId?: number): Promise<Supplier[]> {
    if (locationId !== undefined) {
      console.log('🔍 [SuppliersService] Filtrăm suppliers după location_id:', locationId);
      const queryBuilder = this.supplierRepo.createQueryBuilder('supplier')
        .leftJoinAndSelect('supplier.folders', 'folders')
        .leftJoinAndSelect('supplier.products', 'products')
        .leftJoinAndSelect('supplier.orders', 'orders')
        .innerJoin('supplier_locations', 'sl', 'sl.supplier_id = supplier.id')
        .where('sl.id_location = :locationId', { locationId })
        .orderBy('supplier.created_at', 'DESC');
      
      return await queryBuilder.getMany();
    }
    
    // Fără filter, returnează toți supplierii (dar vezi comentariul de mai jos)
    // NOTĂ: În producție, ai putea vrea să fie obligatoriu locationId pentru securitate
    return this.supplierRepo.find({ relations: ['folders', 'products', 'orders'], order: { created_at: 'DESC' } });
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({ where: { id }, relations: ['folders', 'folders.documents', 'products', 'orders', 'orders.items', 'orders.documents'] });
    if (!supplier) throw new NotFoundException('Furnizorul nu a fost găsit');
    return supplier;
  }

  async update(id: number, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);
    if (dto.registration_number || dto.vat_number) {
      const existingSupplier = await this.supplierRepo.findOne({
        where: [
          { registration_number: dto.registration_number },
          { vat_number: dto.vat_number },
        ],
      });
      if (existingSupplier && existingSupplier.id !== id) {
        throw new BadRequestException('Furnizor duplicat');
      }
    }
    Object.assign(supplier, dto);
    return this.supplierRepo.save(supplier);
  }

  async remove(id: number): Promise<void> {
    const supplier = await this.findOne(id);
    await this.supplierRepo.remove(supplier);
  }

  async addProduct(dto: CreateSupplierProductDto): Promise<SupplierProduct> {
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) throw new NotFoundException('Furnizorul nu a fost găsit');
    const existingProduct = await this.supplierProductRepo.findOne({ where: { supplier_id: dto.supplier_id, product_id: dto.product_id } });
    if (existingProduct) throw new BadRequestException('Produsul este deja asociat');
    const supplierProduct = this.supplierProductRepo.create(dto);
    return this.supplierProductRepo.save(supplierProduct);
  }

  async getSupplierProducts(supplierId: number): Promise<SupplierProduct[]> {
    return this.supplierProductRepo.find({ where: { supplier_id: supplierId }, order: { created_at: 'DESC' } });
  }

  async createOrder(dto: CreateSupplierOrderDto): Promise<SupplierOrder> {
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) throw new NotFoundException('Furnizorul nu a fost găsit');
    // Creează comanda
    const orderData = {
      supplier_id: dto.supplier_id,
      order_date: new Date(dto.order_date),
      delivery_date: new Date(dto.delivery_date),
      status: dto.status || OrderStatus.DRAFT,
      notes: dto.notes,
      created_by_user_id: dto.created_by_user_id,
      supplier_location_id: dto.supplier_location_id,
      total_amount: 0,
    };
    const order = this.orderRepo.create(orderData);
    const savedOrder = await this.orderRepo.save(order);
    
    console.log('📦 [SuppliersService] Comandă creată cu supplier_location_id:', dto.supplier_location_id);
    let totalAmount = 0;
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
      await this.orderItemRepo.save(orderItem);
    }
    savedOrder.total_amount = totalAmount;
    await this.orderRepo.save(savedOrder);
    await this.generateOrderPDF(savedOrder, supplier);
    return (await this.orderRepo.findOne({ where: { id: savedOrder.id }, relations: ['items', 'documents'] })) as SupplierOrder;
  }

  private async generateOrderPDF(order: SupplierOrder, supplier: Supplier): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const fileName = `comanda_${order.id}_${supplierNameSimplified}.pdf`;
    const filePath = `/files/suppliers/${supplier.id}/${supplierNameSimplified}/orders/${fileName}`;
    const document = this.orderDocumentRepo.create({
      order_id: order.id,
      document_type: 'order_pdf',
      file_name: fileName,
      file_path: filePath,
    });
    await this.orderDocumentRepo.save(document);
  }

  async markOrderAsDelivered(orderId: number): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Comanda nu a fost găsită');
    if (order.status === OrderStatus.DELIVERED) throw new BadRequestException('Comanda este deja livrată');

    // Create stock items for each order item using the HTTP service
    const stockItems: CreateStockItemDto[] = order.items?.map(item => ({
      product_id: item.product_id,
      supplier_order_item_id: item.id,
      quantity: item.quantity,
      price: item.price_per_unit,
      entry_date: new Date().toISOString(),
      status: 'valid',
    })) || [];

    if (stockItems.length > 0) {
      const createdStockItems = await this.stockHttpService.createStockItems(stockItems);
      
      if (createdStockItems.length !== stockItems.length) {
        console.warn(`Only ${createdStockItems.length} out of ${stockItems.length} stock items were created successfully`);
      }
    }

    order.status = OrderStatus.DELIVERED;
    await this.orderRepo.save(order);
    return order;
  }

  async updateOrderStatus(orderId: number, status: string): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Comanda nu a fost găsită');
    order.status = status as OrderStatus;
    await this.orderRepo.save(order);
    return order;
  }

  async getSupplierOrders(supplierId: number, locationId?: number): Promise<SupplierOrder[]> {
    const whereClause: any = { supplier_id: supplierId };
    
    // Filtrare obligatorie după location_id
    if (locationId !== undefined) {
      whereClause.supplier_location_id = locationId;
      console.log('🔍 [SuppliersService] Filtrăm orders după supplier_location_id:', locationId);
    }
    
    return this.orderRepo.find({ where: whereClause, relations: ['items', 'documents'], order: { created_at: 'DESC' } });
  }

  async updateSupplierProduct(productId: number, updateData: Partial<SupplierProduct>): Promise<SupplierProduct> {
    const supplierProduct = await this.supplierProductRepo.findOne({ where: { id: productId } });
    if (!supplierProduct) throw new NotFoundException('Produsul furnizor nu a fost găsit');
    Object.assign(supplierProduct, updateData);
    return this.supplierProductRepo.save(supplierProduct);
  }

  async removeSupplierProduct(productId: number): Promise<void> {
    const supplierProduct = await this.supplierProductRepo.findOne({ where: { id: productId } });
    if (!supplierProduct) throw new NotFoundException('Produsul furnizor nu a fost găsit');
    await this.supplierProductRepo.remove(supplierProduct);
  }

  async addDocument(
    supplierId: number,
    documentData: { fileName: string; folderId: number; notes?: string; content?: string; file_content?: string },
  ) {
    await this.findOne(supplierId);
    const folder = await this.folderRepo.findOne({ where: { id: documentData.folderId, supplier_id: supplierId } });
    if (!folder) throw new NotFoundException('Folderul nu a fost găsit');
    // Save physical file if content provided
    const base64 = documentData.content || documentData.file_content;
    if (base64) {
      const repoRoot = this.getRepoRoot();
      const absoluteDir = path.join(repoRoot, folder.folder_path);
      const absolutePath = path.join(absoluteDir, documentData.fileName);
      if (!fs.existsSync(absoluteDir)) fs.mkdirSync(absoluteDir, { recursive: true });
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(absolutePath, buffer);
    }
    const document = this.supplierDocumentRepo.create({
      folder_id: documentData.folderId,
      document_type: DocumentType.OTHER,
      file_name: documentData.fileName,
      file_path: `${folder.folder_path}${documentData.fileName}`,
      notes: documentData.notes,
    });
    return this.supplierDocumentRepo.save(document);
  }

  async removeDocument(documentId: number): Promise<void> {
    const document = await this.supplierDocumentRepo.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Documentul nu a fost găsit');
    await this.supplierDocumentRepo.remove(document);
  }

  // Utility link generators used by micro controller
  generateEmailLink(supplierId: number, orderId: number): string {
    const subject = encodeURIComponent(`Comandă #${orderId}`);
    const body = encodeURIComponent(
      `Bună ziua,\n\nVă transmitem comanda #${orderId} pentru furnizor ${supplierId}.`,
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  generateWhatsAppLink(supplierId: number, orderId: number, pdfUrl?: string): string {
    const text = `Comandă #${orderId} pentru furnizor ${supplierId}${pdfUrl ? ` PDF: ${pdfUrl}` : ''}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  // === SUPPLIER LOCATIONS METHODS ===
  async assignSupplierToLocation(supplierId: number, locationId: number): Promise<SupplierLocations> {
    // Verify supplier exists
    await this.findOne(supplierId);
    
    // Check if assignment already exists
    const existingAssignment = await this.supplierLocationsRepo.findOne({
      where: { supplier_id: supplierId, id_location: locationId }
    });
    
    if (existingAssignment) {
      throw new BadRequestException('Furnizorul este deja atribuit la această locație');
    }
    
    const assignment = this.supplierLocationsRepo.create({
      supplier_id: supplierId,
      id_location: locationId,
    });
    
    return await this.supplierLocationsRepo.save(assignment);
  }

  async findSupplierLocations(supplierId: number): Promise<any[]> {
    await this.findOne(supplierId);
    const rows = await this.supplierLocationsRepo.find({
      where: { supplier_id: supplierId },
      relations: ['supplier'],
    });
    return await this.enrichWithLocations(rows);
  }

  async findLocationSuppliers(locationId: number): Promise<any[]> {
    const rows = await this.supplierLocationsRepo.find({
      where: { id_location: locationId },
      relations: ['supplier'],
    });
    return await this.enrichWithLocations(rows);
  }

  private async fetchLocation(locationId: number): Promise<any | null> {
    try {
      const resp = await firstValueFrom(this.httpService.get(`${this.locationsServiceUrl}/work-locations/${locationId}`));
      return resp.data;
    } catch (error: any) {
      this.logger.warn(`Nu am putut încărca locația ${locationId}: ${error?.message || error}`);
      return null;
    }
  }

  private async enrichWithLocations(rows: SupplierLocations[]): Promise<any[]> {
    const results = await Promise.all(rows.map(async (row) => {
      const location = await this.fetchLocation(row.id_location);
      return { ...row, workLocation: location };
    }));
    return results;
  }

  async removeSupplierFromLocation(supplierId: number, locationId: number): Promise<void> {
    const assignment = await this.supplierLocationsRepo.findOne({
      where: { supplier_id: supplierId, id_location: locationId }
    });
    
    if (!assignment) {
      throw new NotFoundException('Asocierea nu a fost găsită');
    }
    
    await this.supplierLocationsRepo.remove(assignment);
  }
}


