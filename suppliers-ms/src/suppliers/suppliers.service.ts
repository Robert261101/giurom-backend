import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { InjectRepository, InjectConnection } from '@nestjs/typeorm';
import { Repository, Connection, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder, OrderStatus } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './entities/supplier-order-document.entity';
import { SupplierOrderItemReception, ReceptionStatus } from './entities/supplier-order-item-reception.entity';
import { SupplierOrderCancelledItem } from './entities/supplier-order-cancelled-item.entity';
import { SupplierDocument, DocumentType } from './entities/supplier-document.entity';
import { SupplierLocations } from './entities/supplier-locations.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { PartialReceptionDto } from './dto/partial-reception.dto';
import { CancelOrderItemsDto } from './dto/cancel-order-items.dto';
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
    @InjectRepository(SupplierOrderItemReception) private readonly orderItemReceptionRepo: Repository<SupplierOrderItemReception>,
    @InjectRepository(SupplierOrderCancelledItem) private readonly cancelledItemRepo: Repository<SupplierOrderCancelledItem>,
    @InjectRepository(SupplierDocument) private readonly supplierDocumentRepo: Repository<SupplierDocument>,
    @InjectRepository(SupplierLocations) private readonly supplierLocationsRepo: Repository<SupplierLocations>,
    @InjectConnection() private readonly connection: Connection,
    private readonly stockHttpService: StockHttpService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {
    this.locationsServiceUrl = this.configService.get<string>('LOCATIONS_HTTP_URL') || 'http://localhost:3005';
  }

  private async sendSupplierNotification(
    type: string,
    title: string,
    description: string,
    supplierId: number,
    metadata?: any,
    target_url?: string  // Add target_url parameter
  ): Promise<void> {
    try {
      this.logger.log(`🔍 [SUPPLIERS SERVICE] Attempting to send notification - Type: ${type}, Supplier ID: ${supplierId}`);
      this.logger.log(`📝 Notification details - Title: ${title}, Description: ${description}`);
      
      const notificationData = {
        type,
        title,
        description,
        entity_id: supplierId,
        entity_type: 'supplier',
        metadata,
        priority: 'medium',
        target_url,  // Add target_url to notification data
      };
      
      this.logger.log(`📤 Sending notification data: ${JSON.stringify(notificationData, null, 2)}`);
      
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'suppliers.notification' }, notificationData)
      );
      
      this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully sent notification for supplier ${supplierId}`);
    } catch (error: any) {
      this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to send supplier notification: ${error?.message || error}`, error?.stack);
    }
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
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating supplier with documents: ${JSON.stringify(dto, null, 2)}`);
    
    const existingSupplier = await this.supplierRepo.findOne({
      where: [
        { registration_number: dto.registration_number },
        { vat_number: dto.vat_number },
      ],
    });
    if (existingSupplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Duplicate supplier detected: ${dto.registration_number} or ${dto.vat_number}`);
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
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier saved with ID: ${savedSupplier.id}`);
    
    await this.createSupplierFoldersWithCustomName(savedSupplier, dto.folderName, dto.documents);
    
    // Automatically assign supplier to location if location_id is provided
    if (location_id) {
      try {
        this.logger.log(`📍 [SUPPLIERS SERVICE] Assigning supplier ${savedSupplier.id} to location ${location_id}`);
        await this.assignSupplierToLocation(savedSupplier.id, location_id);
      } catch (error: any) {
        // Log the error but don't fail the supplier creation
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`, error?.message || error);
      }
    }

    // Send notification for new supplier
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new supplier ${savedSupplier.id}`);
    await this.sendSupplierNotification(
      'supplier_created',
      'Furnizor nou creat',
      `A fost creat un nou furnizor: ${savedSupplier.supplier_name}`,
      savedSupplier.id,
      { supplierName: savedSupplier.supplier_name },
      `/furnizori/${savedSupplier.id}`  // Add target_url
    );
    
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
    const supplierDir = path.join(suppliersDir, supplierNameSimplified);
    const dataDir = path.join(supplierDir, 'data');
    const ordersDir = path.join(supplierDir, 'orders');

    this.logger.log(`📁 Creating supplier folders for: ${supplier.supplier_name} (${supplierNameSimplified})`);
    this.logger.log(`📁 Files directory: ${filesDir}`);
    this.logger.log(`📁 Suppliers directory: ${suppliersDir}`);
    this.logger.log(`📁 Supplier directory: ${supplierDir}`);

    if (!fs.existsSync(filesDir)) {
      this.logger.log(`📁 Creating files directory: ${filesDir}`);
      fs.mkdirSync(filesDir, { recursive: true });
    }
    if (!fs.existsSync(suppliersDir)) {
      this.logger.log(`📁 Creating suppliers directory: ${suppliersDir}`);
      fs.mkdirSync(suppliersDir, { recursive: true });
    }
    if (!fs.existsSync(supplierDir)) {
      this.logger.log(`📁 Creating supplier directory: ${supplierDir}`);
      fs.mkdirSync(supplierDir, { recursive: true });
    }
    if (!fs.existsSync(dataDir)) {
      this.logger.log(`📁 Creating data directory: ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(ordersDir)) {
      this.logger.log(`📁 Creating orders directory: ${ordersDir}`);
      fs.mkdirSync(ordersDir, { recursive: true });
    }

    const basePath = `/files/suppliers/${supplierNameSimplified}`;
    this.logger.log(`📁 Base path for database records: ${basePath}`);
    
    const folders = [
      { supplier_id: supplier.id, description: 'Folder pentru documente și contracte', folder_path: `${basePath}/data/` },
      { supplier_id: supplier.id, description: 'Folder pentru comenzi și PDF-uri generate', folder_path: `${basePath}/orders/` },
    ];
    
    for (const folderData of folders) {
      this.logger.log(`📁 Creating folder record: ${JSON.stringify(folderData)}`);
      const folder = this.folderRepo.create(folderData);
      await this.folderRepo.save(folder);
    }
  }

  private async createSupplierFoldersWithCustomName(supplier: Supplier, customFolderName?: string, documents?: any[]): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const repoRoot = this.getRepoRoot();
    const filesDir = path.join(repoRoot, 'files');
    const suppliersDir = path.join(filesDir, 'suppliers');
    const supplierDir = path.join(suppliersDir, supplierNameSimplified);
    const dataDir = path.join(supplierDir, 'data');
    const ordersDir = path.join(supplierDir, 'orders');

    this.logger.log(`📁 Creating supplier folders with custom name for: ${supplier.supplier_name} (${supplierNameSimplified})`);
    this.logger.log(`📁 Files directory: ${filesDir}`);
    this.logger.log(`📁 Suppliers directory: ${suppliersDir}`);
    this.logger.log(`📁 Supplier directory: ${supplierDir}`);

    if (!fs.existsSync(filesDir)) {
      this.logger.log(`📁 Creating files directory: ${filesDir}`);
      fs.mkdirSync(filesDir, { recursive: true });
    }
    if (!fs.existsSync(suppliersDir)) {
      this.logger.log(`📁 Creating suppliers directory: ${suppliersDir}`);
      fs.mkdirSync(suppliersDir, { recursive: true });
    }
    if (!fs.existsSync(supplierDir)) {
      this.logger.log(`📁 Creating supplier directory: ${supplierDir}`);
      fs.mkdirSync(supplierDir, { recursive: true });
    }
    if (!fs.existsSync(dataDir)) {
      this.logger.log(`📁 Creating data directory: ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(ordersDir)) {
      this.logger.log(`📁 Creating orders directory: ${ordersDir}`);
      fs.mkdirSync(ordersDir, { recursive: true });
    }

    const basePath = `/files/suppliers/${supplierNameSimplified}`;
    this.logger.log(`📁 Base path for database records: ${basePath}`);
    
    const documentFolderName = customFolderName || 'Folder pentru documente și contracte';
    const folders = [
      { supplier_id: supplier.id, description: documentFolderName, folder_path: `${basePath}/data/` },
      { supplier_id: supplier.id, description: 'Folder pentru comenzi și PDF-uri generate', folder_path: `${basePath}/orders/` },
    ];

    const savedFolders: SupplierFolder[] = [];
    for (const folderData of folders) {
      this.logger.log(`📁 Creating folder record: ${JSON.stringify(folderData)}`);
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
        } catch (error) {
          this.logger.error(`❌ Error creating document: ${error}`);
        }
      }
    }
  }

  private simplifySupplierName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
  }

  async serveDocument(fileId: number, forceDownload: boolean): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
    const document = await this.supplierDocumentRepo.findOne({ where: { id: fileId } });
    if (!document) {
      this.logger.warn(`Document with ID ${fileId} not found in database`);
      throw new NotFoundException('Documentul nu a fost găsit');
    }
    
    this.logger.log(`📄 Serving document ID: ${fileId}, Name: ${document.file_name}, Path: ${document.file_path}`);
    
    // Handle both old and new path structures
    let filePathToUse = document.file_path;
    this.logger.log(`📄 Original file path: ${document.file_path}`);
    
    if (document.file_path.includes('/suppliers/')) {
      // Extract supplier ID and name from the path
      const pathParts = document.file_path.split('/');
      const suppliersIndex = pathParts.indexOf('suppliers');
      if (suppliersIndex !== -1 && pathParts.length > suppliersIndex + 2) {
        // Check if the path follows the old structure (with ID)
        const possibleId = pathParts[suppliersIndex + 1];
        if (!isNaN(Number(possibleId))) {
          // This is the old structure with ID, we need to remove the ID part
          const supplierName = pathParts[suppliersIndex + 2];
          filePathToUse = `/files/suppliers/${supplierName}/${pathParts.slice(suppliersIndex + 3).join('/')}`;
          this.logger.log(`📄 Converting old path structure to new: ${filePathToUse}`);
        }
      }
    }
    
    const repoRoot = this.getRepoRoot();
    const absolutePath = path.join(repoRoot, filePathToUse.startsWith('/files') ? filePathToUse : `/files${filePathToUse}`);
    this.logger.log(`📄 Absolute file path: ${absolutePath}`);
    
    if (!fs.existsSync(absolutePath)) {
      this.logger.error(`❌ File not found on disk: ${absolutePath}`);
      this.logger.error(`📄 Database path was: ${document.file_path}`);
      this.logger.error(`📄 Computed path was: ${filePathToUse}`);
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
    }
    
    const buffer = fs.readFileSync(absolutePath);
    const fileExt = document.file_name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
    const mimeType = mimeMap[fileExt] || 'application/octet-stream';
    const disposition: 'inline' | 'attachment' = forceDownload ? 'attachment' : 'inline';
    
    this.logger.log(`✅ Successfully read file: ${document.file_name} (${buffer.length} bytes)`);
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

  async findForOrders(locationId?: number): Promise<{ id: number; supplier_name: string }[]> {
    if (locationId !== undefined) {
      const suppliers = await this.supplierRepo
        .createQueryBuilder('supplier')
        .select(['supplier.id', 'supplier.supplier_name'])
        .innerJoin('supplier_locations', 'sl', 'sl.supplier_id = supplier.id')
        .where('sl.id_location = :locationId', { locationId })
        .orderBy('supplier.supplier_name', 'ASC')
        .getMany();
      
      return suppliers.map(s => ({ id: s.id, supplier_name: s.supplier_name }));
    }
    
    const suppliers = await this.supplierRepo.find({
      select: ['id', 'supplier_name'],
      order: { supplier_name: 'ASC' }
    });
    
    return suppliers.map(s => ({ id: s.id, supplier_name: s.supplier_name }));
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({ where: { id }, relations: ['folders', 'folders.documents', 'products', 'orders', 'orders.items', 'orders.documents'] });
    if (!supplier) throw new NotFoundException('Furnizorul nu a fost găsit');
    return supplier;
  }

  async update(id: number, dto: UpdateSupplierDto): Promise<Supplier> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating supplier ${id} with data: ${JSON.stringify(dto, null, 2)}`);
    
    const supplier = await this.findOne(id);
    if (dto.registration_number || dto.vat_number) {
      const existingSupplier = await this.supplierRepo.findOne({
        where: [
          { registration_number: dto.registration_number },
          { vat_number: dto.vat_number },
        ],
      });
      if (existingSupplier && existingSupplier.id !== id) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Duplicate supplier detected during update: ${dto.registration_number} or ${dto.vat_number}`);
        throw new BadRequestException('Furnizor duplicat');
      }
    }
    const oldName = supplier.supplier_name;
    Object.assign(supplier, dto);
    const updatedSupplier = await this.supplierRepo.save(supplier);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier ${id} updated successfully`);

    // Send notification for updated supplier
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for updated supplier ${updatedSupplier.id}`);
    await this.sendSupplierNotification(
      'supplier_updated',
      'Furnizor modificat',
      `Furnizorul ${oldName} a fost modificat`,
      updatedSupplier.id,
      { 
        oldName,
        newName: updatedSupplier.supplier_name,
        updatedFields: Object.keys(dto)
      },
      `/furnizori/${updatedSupplier.id}`  // Add target_url
    );

    return updatedSupplier;
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Removing supplier ${id}`);
    
    const supplier = await this.findOne(id);
    const supplierName = supplier.supplier_name;
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    
    // Remove physical files from file system (both old and new structures)
    const repoRoot = this.getRepoRoot();
    const filesDir = path.join(repoRoot, 'files');
    const suppliersDir = path.join(filesDir, 'suppliers');
    
    // Try to remove the new structure (name-based)
    const supplierDirNew = path.join(suppliersDir, supplierNameSimplified);
    if (fs.existsSync(supplierDirNew)) {
      try {
        fs.rmSync(supplierDirNew, { recursive: true, force: true });
        this.logger.log(`✅ Deleted supplier files directory (new structure): ${supplierDirNew}`);
      } catch (error) {
        this.logger.error(`Failed to delete supplier files directory (new structure): ${supplierDirNew}`, error);
      }
    }
    
    // Try to remove the old structure (ID-based)
    const supplierDirOld = path.join(suppliersDir, id.toString(), supplierNameSimplified);
    if (fs.existsSync(supplierDirOld)) {
      try {
        fs.rmSync(supplierDirOld, { recursive: true, force: true });
        this.logger.log(`✅ Deleted supplier files directory (old structure): ${supplierDirOld}`);
      } catch (error) {
        this.logger.error(`Failed to delete supplier files directory (old structure): ${supplierDirOld}`, error);
      }
    }
    
    await this.supplierRepo.remove(supplier);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier ${id} removed successfully`);

    // Send notification for deleted supplier
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for deleted supplier ${id}`);
    await this.sendSupplierNotification(
      'supplier_deleted',
      'Furnizor sters',
      `Furnizorul ${supplierName} a fost sters`,
      id,
      { supplierName }
    );
  }

  async addProduct(dto: CreateSupplierProductDto): Promise<SupplierProduct> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Adding product to supplier with data: ${JSON.stringify(dto, null, 2)}`);
    
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for product addition: ${dto.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }
    
    const existingProduct = await this.supplierProductRepo.findOne({ where: { supplier_id: dto.supplier_id, product_id: dto.product_id } });
    if (existingProduct) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Product already associated with supplier: ${dto.product_id}`);
      throw new BadRequestException('Produsul este deja asociat');
    }
    
    const supplierProduct = this.supplierProductRepo.create(dto);
    const savedProduct = await this.supplierProductRepo.save(supplierProduct);
    this.logger.log(`✅ [SUPPLIERS SERVICE] Product added to supplier successfully with ID: ${savedProduct.id}`);
    
    // Send notification for new product
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new product ${savedProduct.id}`);
    await this.sendSupplierNotification(
      'supplier_product_added',
      'Produs adaugat furnizor',
      `A fost adaugat un produs la furnizorul ${supplier.supplier_name}`,
      supplier.id,
      { 
        productId: savedProduct.id,
        supplierName: supplier.supplier_name,
        productData: dto
      },
      `/furnizori/${supplier.id}`  // Add target_url
    );
    
    return savedProduct;
  }

  async getSupplierProducts(supplierId: number): Promise<SupplierProduct[]> {
    return this.supplierProductRepo.find({ where: { supplier_id: supplierId }, order: { created_at: 'DESC' } });
  }

  async createOrder(dto: CreateSupplierOrderDto): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating order with data: ${JSON.stringify(dto, null, 2)}`);
    
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order creation: ${dto.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }
    
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
    
    this.logger.log(`📦 [SUPPLIERS SERVICE] Order created with supplier_location_id: ${dto.supplier_location_id}`);

    // Send notification for new order
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new order ${savedOrder.id}`);
    await this.sendSupplierNotification(
      'supplier_order_created',
      'Comanda furnizor noua',
      `A fost creata o comanda noua pentru furnizorul ${supplier.supplier_name}`,
      supplier.id,
      { 
        orderId: savedOrder.id,
        supplierName: supplier.supplier_name,
        orderDate: savedOrder.order_date.toISOString()
      },
      `/furnizori/${supplier.id}`  // Add target_url
    );
    
    let totalAmountWithoutVat = 0;
    let totalAmountWithVat = 0;
    for (const itemDto of dto.items) {
      const subtotal = itemDto.quantity * itemDto.price_per_unit;
      totalAmountWithoutVat += subtotal;
      
      // Obține TVA-ul din produsul furnizorului
      let vat = 0;
      try {
        const supplierProduct = await this.supplierProductRepo.findOne({ 
          where: { 
            supplier_id: dto.supplier_id, 
            product_id: itemDto.product_id 
          } 
        });
        if (supplierProduct && supplierProduct.vat) {
          vat = Number(supplierProduct.vat) || 0;
        }
      } catch (err) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch VAT for product ${itemDto.product_id}:`, err);
      }
      
      // Calculează total cu TVA
      const vatAmount = (subtotal * vat) / 100;
      const total = subtotal + vatAmount;
      totalAmountWithVat += total;
      
      const orderItem = this.orderItemRepo.create({
        order_id: savedOrder.id,
        product_id: itemDto.product_id,
        quantity: itemDto.quantity,
        price_per_unit: itemDto.price_per_unit,
        subtotal,
        total,
      });
      await this.orderItemRepo.save(orderItem);
    }
    savedOrder.total_amount = totalAmountWithoutVat;
    savedOrder.total_amount_with_vat = totalAmountWithVat;
    await this.orderRepo.save(savedOrder);
    await this.generateOrderPDF(savedOrder, supplier);
    return (await this.orderRepo.findOne({ where: { id: savedOrder.id }, relations: ['items', 'documents'] })) as SupplierOrder;
  }

  private async generateOrderPDF(order: SupplierOrder, supplier: Supplier): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    const fileName = `comanda_${order.id}_${supplierNameSimplified}.pdf`;
    const filePath = `/files/suppliers/${supplierNameSimplified}/orders/${fileName}`;
    const document = this.orderDocumentRepo.create({
      order_id: order.id,
      document_type: 'order_pdf',
      file_name: fileName,
      file_path: filePath,
    });
    await this.orderDocumentRepo.save(document);
  }

  async markOrderAsDelivered(orderId: number): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Marking order ${orderId} as delivered`);
    
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items', 'supplier'] });
    if (!order) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order not found: ${orderId}`);
      throw new NotFoundException('Comanda nu a fost găsită');
    }
    if (order.status === OrderStatus.DELIVERED) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order already delivered: ${orderId}`);
      throw new BadRequestException('Comanda este deja livrată');
    }

    // Get supplier for notification
    const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order delivery: ${order.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    // Create stock items for each order item using the HTTP service
    const stockItems: CreateStockItemDto[] = order.items?.map(item => ({
      product_id: item.product_id,
      supplier_order_item_id: item.id,
      quantity: item.quantity,
      price: item.price_per_unit,
      entry_date: new Date().toISOString(),
      status: 'valid',
      location_id: order.supplier_location_id || undefined, // Adaugă location_id din comandă
    })) || [];

    if (stockItems.length > 0) {
      const createdStockItems = await this.stockHttpService.createStockItems(stockItems);
      
      if (createdStockItems.length !== stockItems.length) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${createdStockItems.length} out of ${stockItems.length} stock items were created successfully`);
      }
    }

    order.status = OrderStatus.DELIVERED;
    // Actualizează doar câmpurile comenzii, fără a atinge relația 'items' (evităm cascade overwrite)
    await this.orderRepo.update(order.id, {
      status: order.status,
      total_amount: order.total_amount,
      total_amount_with_vat: order.total_amount_with_vat,
      notes: order.notes,
      delivery_date: order.delivery_date,
    });
    const updatedOrder = await this.orderRepo.findOne({ where: { id: order.id } });
    if (!updatedOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    }

    // Send notification for order delivered
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for delivered order ${updatedOrder.id}`);
    await this.sendSupplierNotification(
      'supplier_order_delivered',
      'Comanda furnizor livrata',
      `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost livrata`,
      supplier.id,
      { 
        orderId: updatedOrder.id,
        supplierName: supplier.supplier_name,
        orderDate: updatedOrder.order_date.toISOString()
      },
      `/furnizori/${supplier.id}`  // Add target_url
    );

    return updatedOrder;
  }

  async markOrderAsPartiallyReceived(dto: PartialReceptionDto): Promise<SupplierOrder> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Processing partial reception for order ${dto.orderId}`);
    
    const order = await this.orderRepo.findOne({ 
      where: { id: dto.orderId }, 
      relations: ['items', 'supplier'] 
    });
    
    if (!order) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order not found: ${dto.orderId}`);
      throw new NotFoundException('Comanda nu a fost găsită');
    }
    
    if (order.status === OrderStatus.DELIVERED) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order already delivered: ${dto.orderId}`);
      throw new BadRequestException('Comanda este deja livrată complet');
    }

    // Get supplier for notification
    const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
    if (!supplier) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order delivery: ${order.supplier_id}`);
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }

    const stockItems: CreateStockItemDto[] = [];
    let hasReturnedItems = false;

    // Process each item in the reception DTO
    for (const receptionItem of dto.items) {
      const orderItem = order.items?.find(item => item.id === receptionItem.itemId);
      
      if (!orderItem) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order item not found: ${receptionItem.itemId}`);
        continue;
      }

      const receivedQty = Number(receptionItem.receivedQuantity) || 0;
      const originalQty = Number(orderItem.quantity);
      
      // Calculează automat returned_quantity dacă nu este explicit trimis
      // Dacă este trimis explicit, folosește valoarea trimisă
      const isReturnedQuantityExplicit = receptionItem.returnedQuantity !== undefined && receptionItem.returnedQuantity !== null;
      let returnedQty: number;
      if (isReturnedQuantityExplicit) {
        returnedQty = Number(receptionItem.returnedQuantity) || 0;
      } else {
        // Calculează automat: diferența dintre comandat și recepționat
        returnedQty = Math.max(0, originalQty - receivedQty);
      }

      // Validare: received + returned <= original
      // EXCEPȚIE: Dacă există returnReason și este pentru anularea părții rămase,
      // permitem received + returned > original (pentru că returnăm partea rămasă de recepționat)
      const isCancellingRemaining = receptionItem.returnReason?.includes('Anulat - partea rămasă') || 
                                     receptionItem.returnReason?.includes('anulat') ||
                                     receptionItem.returnReason?.includes('Anulat');
      
      if (receivedQty + returnedQty > originalQty && !isCancellingRemaining) {
        throw new BadRequestException(
          `Pentru item-ul ${orderItem.id}: cantitatea recepționată (${receivedQty}) + returnată (${returnedQty}) depășește cantitatea comandată (${originalQty})`
        );
      }
      
      // Pentru anularea părții rămase, validăm doar că returned nu depășește ordered
      // (nu verificăm received + returned <= ordered, pentru că returnăm partea rămasă)
      if (isCancellingRemaining && returnedQty > originalQty) {
        throw new BadRequestException(
          `Pentru item-ul ${orderItem.id}: cantitatea returnată (${returnedQty}) depășește cantitatea comandată (${originalQty})`
        );
      }

      // Validare: dacă există returnare EXPLICITĂ, trebuie motiv
      // Dacă returned_quantity este calculat automat, nu cerem motiv
      if (isReturnedQuantityExplicit && returnedQty > 0 && !receptionItem.returnReason?.trim()) {
        throw new BadRequestException(
          `Pentru item-ul ${orderItem.id}: motivul returnării este obligatoriu când există cantitate returnată`
        );
      }

      // Calculează diferența: ce s-a recepționat NOU în această recepție
      // receivedQty este cantitatea TOTALĂ (cumulativă) trimisă în request
      const itemToUpdate = await this.orderItemRepo.findOne({ where: { id: orderItem.id } });
      if (!itemToUpdate) {
        throw new BadRequestException(`Item-ul ${orderItem.id} nu a fost găsit în baza de date.`);
      }
      
      const existingReceivedQty = Number(itemToUpdate.received_quantity) || 0;
      const existingReturnedQty = Number(itemToUpdate.returned_quantity) || 0;
      let newlyReceivedQty = receivedQty - existingReceivedQty; // Diferența = cât se recepționează acum
      let newlyReturnedQty = returnedQty - existingReturnedQty;
      
      // Asigură-te că newlyReceivedQty nu este negativ (protecție împotriva erorilor)
      if (newlyReceivedQty < 0) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Calculated negative newlyReceivedQty for item ${orderItem.id}: ${newlyReceivedQty}. Setting to 0.`);
        newlyReceivedQty = 0;
      }
      
      this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${orderItem.id}: existing=${existingReceivedQty}, new total=${receivedQty}, newly received=${newlyReceivedQty}`);
      
      // NU actualizăm received_quantity în supplier_order_items imediat
      // Vom actualiza doar când recepția este aprobată
      // Creăm recepțiile cu status PENDING pentru aprobare ulterioară

      // Înregistrează evenimentele de recepție/returnare ca delta-uri cu status PENDING
      const occurredAt = new Date();
      const userId = order.created_by_user_id;
      const locationId = order.supplier_location_id || null;

      if (newlyReceivedQty > 0) {
        await this.orderItemReceptionRepo.save({
          supplier_order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          received_delta: newlyReceivedQty,
          returned_delta: 0,
          reason: undefined,
          user_id: userId,
          location_id: locationId || undefined,
          occurred_at: occurredAt,
          stock_item_id: undefined,
          status: ReceptionStatus.PENDING, // Status pending pentru aprobare
        });
        this.logger.log(`📝 [SUPPLIERS SERVICE] Created PENDING reception for item ${orderItem.id} with quantity ${newlyReceivedQty}`);
      }
      if (newlyReturnedQty > 0) {
        await this.orderItemReceptionRepo.save({
          supplier_order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          received_delta: 0,
          returned_delta: newlyReturnedQty,
          reason: receptionItem.returnReason || undefined,
          user_id: userId,
          location_id: locationId || undefined,
          occurred_at: occurredAt,
          stock_item_id: undefined,
          status: ReceptionStatus.PENDING, // Status pending pentru aprobare
        });
        hasReturnedItems = true;
        this.logger.log(`📝 [SUPPLIERS SERVICE] Created PENDING return for item ${orderItem.id} with quantity ${newlyReturnedQty}`);
      }

      // NU creăm stock items imediat - vor fi creați doar când recepția este aprobată
      // Eliminăm logica de creare stock aici

      if (returnedQty > 0) {
        hasReturnedItems = true;
      }
    }

    // NU mai creăm stock items aici - vor fi creați doar când recepțiile sunt aprobate
    this.logger.log(`📝 [SUPPLIERS SERVICE] Recepțiile au fost create cu status PENDING. Stock items vor fi creați după aprobare.`);

    // NU actualizăm statusul comenzii imediat - va fi actualizat doar când recepțiile sunt aprobate
    // Statusul comenzii rămâne neschimbat până la aprobare

    // Actualizează doar comanda fără a persista relația 'items' (evităm rescrierea recepțiilor)
    await this.orderRepo.update(order.id, {
      status: order.status,
      total_amount: order.total_amount,
      total_amount_with_vat: order.total_amount_with_vat,
      notes: order.notes,
      delivery_date: order.delivery_date,
    });
    const updatedOrder = await this.orderRepo.findOne({ where: { id: order.id } });
    if (!updatedOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    }

    // Send notification
    this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for partially received order ${updatedOrder.id}`);
    await this.sendSupplierNotification(
      'supplier_order_partially_received',
      'Comanda furnizor recepționată parțial',
      `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost recepționată parțial${hasReturnedItems ? ' cu returnări' : ''}`,
      supplier.id,
      { 
        orderId: updatedOrder.id,
        supplierName: supplier.supplier_name,
        orderDate: updatedOrder.order_date.toISOString(),
        hasReturns: hasReturnedItems
      }
    );

    return updatedOrder;
  }

  async updateOrderStatus(orderId: number, status: string): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Comanda nu a fost găsită');
    
    const updateData: any = { status: status as OrderStatus };
    
    // Dacă statusul este 'cancelled', setează cancelled_at la momentul curent
    if (status === OrderStatus.CANCELLED && !order.cancelled_at) {
      updateData.cancelled_at = new Date();
    }
    
    await this.orderRepo.update(order.id, updateData);
    const updated = await this.orderRepo.findOne({ where: { id: order.id } });
    if (!updated) throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    return updated;
  }

  /**
   * Anulează item-uri dintr-o comandă
   * Creează înregistrări în supplier_order_cancelled_items pentru item-urile anulate
   */
  async cancelOrderItems(dto: { orderId: number; items: Array<{ itemId: number; returnedQuantity: number; returnReason?: string }> }): Promise<SupplierOrder> {
    this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling items for order ${dto.orderId}`);
    
    const order = await this.orderRepo.findOne({ 
      where: { id: dto.orderId }, 
      relations: ['items'] 
    });
    
    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Comanda este deja anulată');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Nu se pot anula item-uri pentru o comandă complet livrată');
    }
    
    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('Comanda nu are item-uri');
    }

    // Obține recepțiile PENDING pentru această comandă
    const pendingReceptions = await this.orderItemReceptionRepo.find({
      where: {
        supplier_order_id: dto.orderId,
        status: ReceptionStatus.PENDING,
      },
    });

    // Creează un map pentru recepțiile PENDING pe order_item_id
    const pendingByItemId = new Map<number, { received: number; returned: number }>();
    pendingReceptions.forEach(reception => {
      const existing = pendingByItemId.get(reception.supplier_order_item_id) || { received: 0, returned: 0 };
      pendingByItemId.set(reception.supplier_order_item_id, {
        received: existing.received + Number(reception.received_delta || 0),
        returned: existing.returned + Number(reception.returned_delta || 0),
      });
    });

    const cancelledItems: SupplierOrderCancelledItem[] = [];

    // Procesează fiecare item de anulat
    for (const cancelItem of dto.items) {
      const orderItem = order.items?.find(item => item.id === cancelItem.itemId);
      
      if (!orderItem) {
        throw new BadRequestException(`Item-ul ${cancelItem.itemId} nu a fost găsit în comandă`);
      }

      const orderedQty = Number(orderItem.quantity) || 0;
      const existingReceivedQty = Number(orderItem.received_quantity) || 0;
      const existingReturnedQty = Number(orderItem.returned_quantity) || 0;
      
      const pending = pendingByItemId.get(orderItem.id) || { received: 0, returned: 0 };
      const totalReceivedQty = existingReceivedQty + pending.received;
      const totalReturnedQty = existingReturnedQty + pending.returned;
      
      // Calculează cantitatea rămasă de recepționat (fără să scadă returned)
      const remainingToReceiveQty = orderedQty - totalReceivedQty;
      
      // Validare: cantitatea de anulat nu poate depăși cât mai rămâne de recepționat
      if (cancelItem.returnedQuantity > remainingToReceiveQty + 0.01) {
        throw new BadRequestException(
          `Pentru item-ul ${orderItem.id}: cantitatea de anulat (${cancelItem.returnedQuantity}) depășește cantitatea rămasă de recepționat (${remainingToReceiveQty})`
        );
      }

      // Verifică dacă nu există deja un item anulat pentru acest order_item_id
      const existingCancelled = await this.cancelledItemRepo.findOne({
        where: { supplier_order_item_id: orderItem.id }
      });

      if (existingCancelled) {
        // Dacă există deja, actualizează cantitatea (dar nu poate depăși limita)
        const maxAllowed = remainingToReceiveQty + existingCancelled.returned_quantity;
        if (cancelItem.returnedQuantity > maxAllowed + 0.01) {
          throw new BadRequestException(
            `Pentru item-ul ${orderItem.id}: cantitatea totală anulată (${existingCancelled.returned_quantity + cancelItem.returnedQuantity}) depășește cantitatea rămasă de recepționat (${remainingToReceiveQty})`
          );
        }
        existingCancelled.returned_quantity = Number(existingCancelled.returned_quantity) + cancelItem.returnedQuantity;
        if (cancelItem.returnReason) {
          existingCancelled.return_reason = cancelItem.returnReason;
        }
        existingCancelled.updated_at = new Date();
        await this.cancelledItemRepo.save(existingCancelled);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Updated cancelled item ${existingCancelled.id} for order item ${orderItem.id}`);
      } else {
        // Creează un nou item anulat
        const cancelledItem = this.cancelledItemRepo.create({
          order_id: order.id,
          supplier_order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          quantity: orderedQty,
          price_per_unit: Number(orderItem.price_per_unit) || 0,
          subtotal: Number(orderItem.subtotal) || 0,
          total: Number(orderItem.total) || 0,
          received_quantity: existingReceivedQty,
          returned_quantity: cancelItem.returnedQuantity,
          return_reason: cancelItem.returnReason || 'Anulat - partea rămasă de recepționat',
          reception_date: new Date(),
          reception_user_id: order.created_by_user_id,
        });
        
        await this.cancelledItemRepo.save(cancelledItem);
        cancelledItems.push(cancelledItem);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Created cancelled item for order item ${orderItem.id}`);
      }
    }

    // Reîncarcă comanda actualizată
    const updatedOrder = await this.orderRepo.findOne({ 
      where: { id: dto.orderId },
      relations: ['items', 'supplier'],
    });

    if (!updatedOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după anulare');
    }

    this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully cancelled items for order ${dto.orderId}`);
    return updatedOrder;
  }

  /**
   * Anulează partea rămasă de recepționat pentru o comandă
   * Marchează restul ca returnat cu motivul specificat
   * @deprecated Folosește cancelOrderItems în loc de această metodă
   */
  async cancelRemainingQuantity(orderId: number, reason?: string): Promise<SupplierOrder> {
    this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling remaining quantity for order ${orderId}`);
    
    const order = await this.orderRepo.findOne({ 
      where: { id: orderId }, 
      relations: ['items'] 
    });
    
    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    this.logger.log(`📦 [SUPPLIERS SERVICE] Order ${orderId} found with ${order.items?.length || 0} items`);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Comanda este deja anulată');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Nu se poate anula partea rămasă pentru o comandă complet livrată');
    }
    
    if (!order.items || order.items.length === 0) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order ${orderId} has no items`);
      throw new BadRequestException('Comanda nu are item-uri');
    }

    // Obține toate recepțiile PENDING pentru această comandă
    const pendingReceptions = await this.orderItemReceptionRepo.find({
      where: {
        supplier_order_id: orderId,
        status: ReceptionStatus.PENDING,
      },
    });

    // Creează un map pentru recepțiile PENDING pe order_item_id
    const pendingByItemId = new Map<number, { received: number; returned: number }>();
    pendingReceptions.forEach(reception => {
      const existing = pendingByItemId.get(reception.supplier_order_item_id) || { received: 0, returned: 0 };
      pendingByItemId.set(reception.supplier_order_item_id, {
        received: existing.received + Number(reception.received_delta || 0),
        returned: existing.returned + Number(reception.returned_delta || 0),
      });
    });

    const receptionItems: Array<{
      itemId: number;
      receivedQuantity: number;
      returnedQuantity: number;
      returnReason: string;
    }> = [];

    // Procesează fiecare item din comandă
    for (const item of order.items || []) {
      const orderedQty = Number(item.quantity) || 0;
      const existingReceivedQty = Number(item.received_quantity) || 0;
      const existingReturnedQty = Number(item.returned_quantity) || 0;
      
      const pending = pendingByItemId.get(item.id) || { received: 0, returned: 0 };
      const totalReceivedQty = existingReceivedQty + pending.received;
      const totalReturnedQty = existingReturnedQty + pending.returned;
      
      // Calculează cantitatea rămasă de recepționat (fără să scadă returned)
      // "Rămas de recepționat" = cât mai trebuie adus, indiferent de returnări
      const remainingToReceiveQty = orderedQty - totalReceivedQty;
      
      this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: ordered=${orderedQty}, existingReceived=${existingReceivedQty}, pendingReceived=${pending.received}, totalReceived=${totalReceivedQty}, existingReturned=${existingReturnedQty}, pendingReturned=${pending.returned}, totalReturned=${totalReturnedQty}, remainingToReceive=${remainingToReceiveQty}`);
      
      // Dacă mai rămâne ceva de recepționat, marchează-l ca returnat (anulat)
      if (remainingToReceiveQty > 0.01) {
        // IMPORTANT: Pentru anularea părții rămase, vrem să returnăm exact cât mai rămâne de recepționat
        // Astfel, partea rămasă nu va mai putea fi recepționată ulterior
        // Nu verificăm validarea strictă received + returned <= ordered pentru anulare,
        // pentru că returnăm partea rămasă care nu a fost recepționată
        
        // Cantitatea nouă de returnat = cât mai rămâne de recepționat
        const newlyReturnedQty = remainingToReceiveQty;
        
        // Total returned după această operațiune = returned existent + nou returnat
        const newTotalReturnedQty = totalReturnedQty + newlyReturnedQty;
        
        this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: remainingToReceive=${remainingToReceiveQty}, existingReturned=${totalReturnedQty}, newlyReturnedQty=${newlyReturnedQty}, newTotalReturnedQty=${newTotalReturnedQty}`);
        
        // Pentru anularea părții rămase, validăm doar că returned nu depășește ordered
        // (nu verificăm received + returned <= ordered, pentru că returnăm partea rămasă)
        if (newTotalReturnedQty > orderedQty + 0.01) {
          this.logger.error(`❌ [SUPPLIERS SERVICE] Item ${item.id}: Returned quantity would exceed ordered: returned(${newTotalReturnedQty}) > ordered(${orderedQty})`);
        } else {
          if (newlyReturnedQty > 0.01) {
            receptionItems.push({
              itemId: item.id,
              receivedQuantity: existingReceivedQty, // Doar ce s-a recepționat și aprobat (fără PENDING)
              returnedQuantity: newTotalReturnedQty, // Total returned (existent + PENDING + nou)
              returnReason: reason || 'Anulat - partea rămasă de recepționat',
            });
            this.logger.log(`✅ [SUPPLIERS SERVICE] Item ${item.id}: Added to receptionItems for cancellation`);
          } else {
            this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: Skipped - newlyReturnedQty too small (${newlyReturnedQty})`);
          }
        }
      } else {
        this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: Skipped - no remaining quantity to receive (remainingToReceiveQty=${remainingToReceiveQty})`);
      }
    }

    this.logger.log(`📦 [SUPPLIERS SERVICE] Total receptionItems: ${receptionItems.length}`);
    
    if (receptionItems.length === 0) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] No items to cancel for order ${orderId}`);
      throw new BadRequestException('Nu există cantitate rămasă de anulat pentru această comandă');
    }

    // Folosește mecanismul existent de recepție parțială
    const partialReceptionDto = {
      orderId: order.id,
      items: receptionItems,
    };

    const updatedOrder = await this.markOrderAsPartiallyReceived(partialReceptionDto);

    // Aprobă automat recepțiile de returnare create
    const allReceptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: orderId },
    });

    const newPendingReceptions = allReceptions.filter(r => 
      r.status === ReceptionStatus.PENDING && 
      r.returned_delta > 0 &&
      receptionItems.some(item => item.itemId === r.supplier_order_item_id)
    );

    if (newPendingReceptions.length > 0) {
      const receptionIds = newPendingReceptions.map(r => r.id);
      await this.approveReceptions(orderId, receptionIds);
      this.logger.log(`✅ [SUPPLIERS SERVICE] Approved ${receptionIds.length} return receptions automatically`);
    }

    // Reîncarcă comanda pentru a obține valorile actualizate
    const orderAfterReception = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    
    if (!orderAfterReception) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după anulare');
    }
    
    // Verifică dacă toate item-urile au fost complet procesate (received + returned >= ordered)
    // Dacă da, marchează comanda ca anulată
    let allItemsFullyProcessed = true;
    if (orderAfterReception.items && orderAfterReception.items.length > 0) {
      for (const item of orderAfterReception.items) {
        const orderedQty = Number(item.quantity) || 0;
        const receivedQty = Number(item.received_quantity) || 0;
        const returnedQty = Number(item.returned_quantity) || 0;
        
        // Verifică dacă item-ul este complet procesat
        if (receivedQty + returnedQty < orderedQty - 0.01) {
          allItemsFullyProcessed = false;
          break;
        }
      }
    }
    
    // Dacă toate item-urile sunt complet procesate, marchează comanda ca anulată
    if (allItemsFullyProcessed && orderAfterReception.status !== OrderStatus.CANCELLED) {
      this.logger.log(`🚫 [SUPPLIERS SERVICE] All items fully processed, marking order ${orderId} as cancelled`);
      orderAfterReception.status = OrderStatus.CANCELLED;
      orderAfterReception.cancelled_at = new Date();
      await this.orderRepo.save(orderAfterReception);
    }
    
    // Reîncarcă comanda finală cu toate relațiile
    const finalOrder = await this.orderRepo.findOne({ 
      where: { id: orderId },
      relations: ['items', 'supplier'],
    });

    if (!finalOrder) {
      throw new NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
    }

    this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully cancelled remaining quantity for order ${orderId}`);
    return finalOrder;
  }

  /**
   * Aprobă recepțiile pentru o comandă și creează stock items
   */
  async approveReceptions(orderId: number, receptionIds: number[]): Promise<{ approved: number; stockCreated: number }> {
    this.logger.log(`✅ [SUPPLIERS SERVICE] Approving ${receptionIds.length} receptions for order ${orderId}`);
    
    // Găsește recepțiile cu status PENDING
    const receptions = await this.orderItemReceptionRepo.find({
      where: {
        id: In(receptionIds),
        supplier_order_id: orderId,
        status: ReceptionStatus.PENDING,
      },
      relations: [],
    });

    if (receptions.length === 0) {
      throw new BadRequestException('Nu s-au găsit recepții PENDING pentru aprobare');
    }

    if (receptions.length !== receptionIds.length) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${receptions.length} out of ${receptionIds.length} receptions found with PENDING status`);
    }

    // Obține order items pentru a calcula received_quantity
    const orderItemIds = Array.from(new Set(receptions.map(r => r.supplier_order_item_id)));
    const orderItems = await this.orderItemRepo.find({
      where: { id: In(orderItemIds) },
    });
    const orderItemsMap = new Map(orderItems.map(item => [item.id, item]));

    // Obține comanda pentru a accesa informații
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) {
      throw new NotFoundException(`Comanda ${orderId} nu a fost găsită`);
    }

    const stockItems: CreateStockItemDto[] = [];
    const updatedItemQuantities = new Map<number, { received: number; returned: number }>();

    // Procesează fiecare recepție aprobată
    for (const reception of receptions) {
      const orderItem = orderItemsMap.get(reception.supplier_order_item_id);
      if (!orderItem) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order item ${reception.supplier_order_item_id} not found for reception ${reception.id}`);
        continue;
      }

      // Actualizează statusul recepției la APPROVED
      reception.status = ReceptionStatus.APPROVED;
      await this.orderItemReceptionRepo.save(reception);

      // Calculează cantitățile cumulate pentru order item
      if (!updatedItemQuantities.has(reception.supplier_order_item_id)) {
        const existingReceived = Number(orderItem.received_quantity) || 0;
        const existingReturned = Number(orderItem.returned_quantity) || 0;
        updatedItemQuantities.set(reception.supplier_order_item_id, {
          received: existingReceived,
          returned: existingReturned,
        });
      }

      const quantities = updatedItemQuantities.get(reception.supplier_order_item_id)!;
      
      // Adaugă delta-urile recepției aprobate
      if (reception.received_delta > 0) {
        quantities.received += Number(reception.received_delta);
        
        // Creează stock item pentru recepția aprobată
        const stockItemDto: CreateStockItemDto = {
          product_id: reception.product_id,
          supplier_order_item_id: reception.supplier_order_item_id,
          quantity: Number(reception.received_delta),
          price: Number(orderItem.price_per_unit),
          entry_date: reception.occurred_at.toISOString(),
          status: 'valid',
          location_id: reception.location_id || undefined,
        };
        stockItems.push(stockItemDto);
      }
      
      if (reception.returned_delta > 0) {
        quantities.returned += Number(reception.returned_delta);
      }
    }

    // Actualizează received_quantity și returned_quantity în order items
    for (const [itemId, quantities] of updatedItemQuantities.entries()) {
      const orderItem = orderItemsMap.get(itemId);
      if (orderItem) {
        orderItem.received_quantity = quantities.received;
        orderItem.returned_quantity = quantities.returned;
        
        // Setează data recepției dacă există recepții aprobate
        if (quantities.received > 0) {
          orderItem.reception_date = new Date();
          orderItem.reception_user_id = order.created_by_user_id;
        }
        
        await this.orderItemRepo.save(orderItem);
      }
    }

    // Creează stock items pentru recepțiile aprobate
    let stockCreated = 0;
    if (stockItems.length > 0) {
      this.logger.log(`📦 [SUPPLIERS SERVICE] Creating ${stockItems.length} stock items for approved receptions...`);
      const createdStockItems = await this.stockHttpService.createStockItems(stockItems);
      stockCreated = createdStockItems.length;
      
      // Actualizează stock_item_id în recepții
      for (let i = 0; i < stockItems.length; i++) {
        const stockItem = createdStockItems[i];
        if (stockItem) {
          const reception = receptions.find(r => 
            r.supplier_order_item_id === stockItem.supplier_order_item_id &&
            r.received_delta > 0
          );
          if (reception) {
            reception.stock_item_id = stockItem.id;
            await this.orderItemReceptionRepo.save(reception);
          }
        }
      }
      
      this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully created ${stockCreated} stock items`);
    }

    // Verifică dacă toate recepțiile comenzii sunt aprobate și actualizează statusul comenzii
    const allReceptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: orderId },
    });
    const hasPendingReceptions = allReceptions.some(r => r.status === ReceptionStatus.PENDING);
    
    if (!hasPendingReceptions && order.items) {
      // Verifică dacă toate itemele sunt complet recepționate
      const allItemsFullyReceived = order.items.every(item => {
        const received = Number(item.received_quantity) || 0;
        const original = Number(item.quantity);
        return received >= original;
      });
      
      if (allItemsFullyReceived) {
        order.status = OrderStatus.DELIVERED;
        await this.orderRepo.update(order.id, { status: order.status });
      }
    }

    return {
      approved: receptions.length,
      stockCreated,
    };
  }

  /**
   * Respinge recepțiile pentru o comandă
   */
  async rejectReceptions(orderId: number, receptionIds: number[], reason?: string): Promise<{ rejected: number }> {
    this.logger.log(`❌ [SUPPLIERS SERVICE] Rejecting ${receptionIds.length} receptions for order ${orderId}`);
    
    // Găsește recepțiile cu status PENDING
    const receptions = await this.orderItemReceptionRepo.find({
      where: {
        id: In(receptionIds),
        supplier_order_id: orderId,
        status: ReceptionStatus.PENDING,
      },
    });

    if (receptions.length === 0) {
      throw new BadRequestException('Nu s-au găsit recepții PENDING pentru respingere');
    }

    if (receptions.length !== receptionIds.length) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${receptions.length} out of ${receptionIds.length} receptions found with PENDING status`);
    }

    // Actualizează statusul recepțiilor la REJECTED
    for (const reception of receptions) {
      reception.status = ReceptionStatus.REJECTED;
      if (reason) {
        reception.reason = reason;
      }
      await this.orderItemReceptionRepo.save(reception);
    }

    this.logger.log(`✅ [SUPPLIERS SERVICE] Rejected ${receptions.length} receptions`);
    
    return {
      rejected: receptions.length,
    };
  }

  /**
   * Obține toate recepțiile pentru o comandă cu numele utilizatorilor
   */
  async getOrderCancelledItems(orderId: number): Promise<SupplierOrderCancelledItem[]> {
    return this.cancelledItemRepo.find({
      where: { order_id: orderId },
      relations: ['orderItem'],
    });
  }

  async getOrderReceptions(orderId: number): Promise<Array<SupplierOrderItemReception & { user_name?: string }>> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching receptions for order ${orderId}`);
    
    const receptions = await this.orderItemReceptionRepo.find({
      where: { supplier_order_id: orderId },
      order: { created_at: 'DESC' },
    });

    // Obține numele utilizatorilor pentru recepții
    const userIds = Array.from(new Set(
      receptions
        .map(r => r.user_id)
        .filter((id): id is number => id !== undefined && id !== null)
    ));

    const usersMap = new Map<number, string>();
    const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
    const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';

    for (const userId of userIds) {
      try {
        // Obține id_employee din users
        const userResult = await this.connection.query(
          `SELECT id_employee FROM ${authDbName}.users WHERE id = ?`,
          [userId]
        );

        if (userResult && userResult.length > 0 && userResult[0].id_employee) {
          const employeeId = Number(userResult[0].id_employee);

          // Obține first_name și last_name din employees
          const employeeResult = await this.connection.query(
            `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
            [employeeId]
          );

          if (employeeResult && employeeResult.length > 0) {
            const firstName = employeeResult[0].first_name || null;
            const lastName = employeeResult[0].last_name || null;
            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `User #${userId}`;
            usersMap.set(userId, fullName);
            this.logger.log(`✅ [SUPPLIERS SERVICE] Fetched employee name for user ${userId} (employee ${employeeId}): ${fullName}`);
          } else {
            usersMap.set(userId, `User #${userId}`);
          }
        } else {
          usersMap.set(userId, `User #${userId}`);
        }
      } catch (error: any) {
        this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
        usersMap.set(userId, `User #${userId}`);
      }
    }

    // Adaugă numele utilizatorilor la recepții
    return receptions.map(reception => ({
      ...reception,
      user_name: reception.user_id ? usersMap.get(reception.user_id) : undefined,
    })) as Array<SupplierOrderItemReception & { user_name?: string }>;
  }

  async getReceptionReport(startDate: string, endDate: string): Promise<any[]> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Generating reception report from ${startDate} to ${endDate}`);
    
    const stockServiceUrl = this.configService.get<string>('STOCK_HTTP_URL') || 'http://localhost:3006';
    const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
    const headers = {
      'x-internal-service': 'suppliers',
      'x-service-secret': serviceSecret
    };

    // Nou: dacă există evenimente în supplier_order_item_receptions pe interval, folosim direct acea sursă
    try {
      const eventRows = await this.orderItemReceptionRepo
        .createQueryBuilder('ev')
        .select([
          'ev.supplier_order_id AS supplier_order_id',
          'ev.supplier_order_item_id AS supplier_order_item_id',
          'ev.product_id AS product_id',
          'COALESCE(ev.user_id, 0) AS user_id',
          'ev.received_delta AS received_delta',
          'ev.returned_delta AS returned_delta',
          'ev.reason AS reason',
          'ev.occurred_at AS occurred_at',
        ])
        .where('DATE(ev.occurred_at) BETWEEN :startDate AND :endDate', { startDate, endDate })
        .getRawMany();
      
      if (eventRows.length > 0) {
        this.logger.log(`📦 [SUPPLIERS SERVICE] Using receptions events table with ${eventRows.length} rows`);
        const aggregated = new Map<string, {
          supplier_order_id: number;
          product_id: number;
          user_id: number;
          total_received: number;
          total_returned: number;
          return_count: number;
          return_reasons: string[];
          reception_date?: Date | string;
        }>();
        
        for (const row of eventRows) {
          const orderId = Number(row.supplier_order_id);
          const productId = Number(row.product_id);
          const userId = Number(row.user_id) || 0;
          const receivedDelta = parseFloat(row.received_delta || '0');
          const returnedDelta = parseFloat(row.returned_delta || '0');
          const reason = row.reason as string | null;
          const occurredAt = row.occurred_at as Date | string;
          const key = `${orderId}:${productId}:${userId}`;
          
          if (!aggregated.has(key)) {
            aggregated.set(key, {
              supplier_order_id: orderId,
              product_id: productId,
              user_id: userId,
              total_received: 0,
              total_returned: 0,
              return_count: 0,
              return_reasons: [],
              reception_date: undefined,
            });
          }
          
          const agg = aggregated.get(key)!;
          if (receivedDelta > 0) {
            agg.total_received += receivedDelta;
          }
          if (returnedDelta > 0) {
            agg.total_returned += returnedDelta;
            agg.return_count += 1;
            if (reason && reason.trim()) {
              agg.return_reasons.push(reason.trim());
            }
          }
          
          // Salvează prima dată de recepție (cea mai veche) din evenimente
          if (occurredAt) {
            const occDate = new Date(occurredAt);
            if (!agg.reception_date) {
              agg.reception_date = occurredAt;
            } else {
              const existing = new Date(agg.reception_date);
              if (occDate < existing) {
                agg.reception_date = occurredAt;
              }
            }
          }
        }

        // Enrich supplier_name
        const orderIds = Array.from(new Set(Array.from(aggregated.values()).map(v => v.supplier_order_id)));
        const orders = orderIds.length > 0
          ? await this.orderRepo.find({ where: { id: In(orderIds) as any }, relations: ['supplier'] })
          : [];
        const orderToSupplierName = new Map<number, string>();
        for (const o of orders) {
          orderToSupplierName.set(o.id, o.supplier?.supplier_name || `Order #${o.id}`);
        }

        // Obține numele angajaților pentru user_id-urile din aggregated
        const userIds = Array.from(new Set(Array.from(aggregated.values()).map(v => v.user_id).filter(id => id > 0)));
        const usersMap = new Map<number, { first_name?: string; last_name?: string; employee_id?: number }>();
        const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
        const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
        
        for (const userId of userIds) {
          try {
            // Obține id_employee din users
            const userResult = await this.connection.query(
              `SELECT id_employee FROM ${authDbName}.users WHERE id = ?`,
              [userId]
            );
            
            if (userResult && userResult.length > 0 && userResult[0].id_employee) {
              const employeeId = Number(userResult[0].id_employee);
              
              // Obține first_name și last_name din employees
              const employeeResult = await this.connection.query(
                `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
                [employeeId]
              );
              
              if (employeeResult && employeeResult.length > 0) {
                const firstName = employeeResult[0].first_name || null;
                const lastName = employeeResult[0].last_name || null;
                usersMap.set(userId, {
                  first_name: firstName,
                  last_name: lastName,
                  employee_id: employeeId
                });
              }
            }
          } catch (error: any) {
            this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
          }
        }

        // Normalizează listele de motive (unice) și atașează supplier_name și user_name
        const result = Array.from(aggregated.values()).map(item => {
          const user = usersMap.get(item.user_id);
          let userName: string;
          if (user && user.first_name && user.last_name) {
            userName = `${user.first_name} ${user.last_name}`.trim();
          } else if (user && user.employee_id) {
            userName = `ID: ${user.employee_id}`;
          } else {
            userName = item.user_id > 0 ? `User ID: ${item.user_id}` : 'Necunoscut';
          }
          
          return {
            ...item,
            supplier_name: orderToSupplierName.get(item.supplier_order_id) || 'Necunoscut',
            user_name: userName,
            return_reasons: Array.from(new Set(item.return_reasons)),
          };
        });
        return result;
      }
    } catch (e: any) {
      this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Failed to read receptions events table, falling back. Reason: ${e?.message || e}`);
    }

    // PASUL 1: Obține order items-urile cu recepții în perioada respectivă
    // Folosim reception_date (data efectivă a recepției) pentru filtrare precisă
    // IMPORTANT: Dacă reception_date este NULL, folosim entry_date din stock items (fallback)
    const receivedItems = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.order', 'order')
      .select([
        'item.id AS item_id',
        'item.product_id AS product_id',
        'item.received_quantity AS received_quantity',
        'item.reception_date AS reception_date',
        'item.reception_user_id AS reception_user_id',
        'order.created_by_user_id AS order_user_id'
      ])
      .where('item.received_quantity > 0')
      .andWhere('(item.reception_date IS NOT NULL AND DATE(item.reception_date) BETWEEN :startDate AND :endDate)', {
        startDate,
        endDate
      })
      .getRawMany();

    this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${receivedItems.length} items with receptions in period`);
    
    // Dacă nu există reception_date setat (pentru datele vechi), folosim stock items ca fallback
    let stockItems: any[] = [];
    if (receivedItems.length === 0) {
      try {
        // Obține toate stock items-urile care au supplier_order_item_id (provin din recepții)
        const stockResponse = await firstValueFrom(
          this.httpService.get(`${stockServiceUrl}/stock/items`, { headers })
        );
        stockItems = (stockResponse.data || []).filter((item: any) => {
          // Filtrează după supplier_order_item_id (provin din recepții)
          if (!item.supplier_order_item_id) return false;
          
          // Filtrează după entry_date (data recepției) în perioada specificată
          const entryDate = new Date(item.entry_date);
          const start = new Date(startDate);
          const end = new Date(`${endDate} 23:59:59`);
          return entryDate >= start && entryDate <= end;
        });
        
        this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${stockItems.length} stock items from receptions in period (fallback)`);
      } catch (error: any) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch stock items:`, error?.message);
      }
    }

    // PASUL 2: Obține order items-urile cu returnări în perioada respectivă
    // Folosim updated_at ca proxy pentru data returnării (când s-a actualizat cu returned_quantity > 0)
    // TODO: Dacă adăugăm return_date în viitor, folosiți acela
    const returnItems = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoin('item.order', 'order')
      .select([
        'item.id AS item_id',
        'item.product_id AS product_id',
        'item.returned_quantity AS returned_quantity',
        'item.return_reason AS return_reason',
        'item.updated_at AS updated_at'
      ])
      .where('item.returned_quantity > 0')
      .andWhere('DATE(item.updated_at) BETWEEN :startDate AND :endDate', {
        startDate,
        endDate
      })
      .getRawMany();

    this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${returnItems.length} items with returns in period`);

    // Agregăm datele pe product_id + user_id (pentru a identifica cine a făcut recepția)
    // Map key: "product_id:user_id" pentru a grupa pe produs și utilizator
    const aggregatedData = new Map<string, {
      product_id: number;
      user_id: number;
      total_received: number;
      total_returned: number;
      return_count: number;
      return_reasons: string[];
      reception_date?: Date | string; // Prima dată de recepție pentru acest grup
    }>();

    // Agregă recepțiile din order items (folosind reception_date - data exactă a recepției)
    for (const item of receivedItems) {
      const productId = item.product_id;
      const received = parseFloat(item.received_quantity || '0');
      
      // Obține user_id din reception_user_id (dacă există) sau din order.created_by_user_id
      const userId = item.reception_user_id || item.order_user_id || 0;
      
      const key = `${productId}:${userId}`;

      if (!aggregatedData.has(key)) {
        aggregatedData.set(key, {
          product_id: productId,
          user_id: userId,
          total_received: 0,
          total_returned: 0,
          return_count: 0,
          return_reasons: [],
          reception_date: item.reception_date || undefined
        });
      }

      const data = aggregatedData.get(key)!;
      data.total_received += received;
      
      // Salvează prima dată de recepție (cea mai veche) pentru acest grup
      if (item.reception_date) {
        const itemDate = new Date(item.reception_date);
        if (!data.reception_date) {
          data.reception_date = item.reception_date;
        } else {
          const existingDate = new Date(data.reception_date);
          if (itemDate < existingDate) {
            data.reception_date = item.reception_date;
          }
        }
      }
    }

    // Fallback: Dacă nu există reception_date (pentru datele vechi), folosim stock items
    // SAU dacă există receivedItems dar fără reception_date, le includem și pe acelea
    if (stockItems.length > 0) {
      const orderItemIds = stockItems.map((item: any) => item.supplier_order_item_id).filter(Boolean);
      let orderItemsMap = new Map<number, any>();
      if (orderItemIds.length > 0) {
        const orderItems = await this.orderItemRepo
          .createQueryBuilder('item')
          .leftJoinAndSelect('item.order', 'order')
          .where('item.id IN (:...ids)', { ids: orderItemIds })
          .getMany();
        
        orderItems.forEach(item => {
          orderItemsMap.set(item.id, item);
        });
      }

      // Agregă recepțiile din stock items (cu data corectă) - doar pentru date vechi
      for (const stockItem of stockItems) {
        const productId = stockItem.product_id;
        const received = parseFloat(stockItem.quantity || '0');
        const orderItemId = stockItem.supplier_order_item_id;
        
        // IMPORTANT: Folosește reception_user_id din order_item (dacă există) sau created_by_user_id din order
        let userId: number | null = null;
        if (orderItemId) {
          const orderItem = orderItemsMap.get(orderItemId);
          // Prioritate: reception_user_id > created_by_user_id
          if (orderItem?.reception_user_id) {
            userId = orderItem.reception_user_id;
          } else if (orderItem?.order?.created_by_user_id) {
            userId = orderItem.order.created_by_user_id;
          }
        }
        
        // Folosește userId sau 0 dacă nu există
        const key = `${productId}:${userId || 0}`;

        if (!aggregatedData.has(key)) {
          // Folosește entry_date din stock item ca reception_date pentru datele vechi
          const receptionDate = stockItem.entry_date || undefined;
          aggregatedData.set(key, {
            product_id: productId,
            user_id: userId || 0,
            total_received: 0,
            total_returned: 0,
            return_count: 0,
            return_reasons: [],
            reception_date: receptionDate
          });
        }

        const data = aggregatedData.get(key)!;
        data.total_received += received;
        
        // Salvează prima dată de recepție (cea mai veche) pentru acest grup
        if (stockItem.entry_date) {
          const entryDate = new Date(stockItem.entry_date);
          if (!data.reception_date) {
            data.reception_date = stockItem.entry_date;
          } else {
            const existingDate = new Date(data.reception_date);
            if (entryDate < existingDate) {
              data.reception_date = stockItem.entry_date;
            }
          }
        }
      }
    }
    
    // De asemenea, adaugă și receivedItems care au reception_date NULL sau lipsă
    // În acest caz, folosim entry_date din stock items (data efectivă a recepției) pentru filtrare
    // NU folosim updated_at direct pentru că nu reflectă data recepției
    const itemsWithoutReceptionDate = await this.orderItemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.order', 'order')
      .select([
        'item.id AS item_id',
        'item.product_id AS product_id',
        'item.received_quantity AS received_quantity',
        'item.reception_date AS reception_date',
        'item.reception_user_id AS reception_user_id',
        'order.created_by_user_id AS order_user_id'
      ])
      .where('item.received_quantity > 0')
      .andWhere('item.reception_date IS NULL')
      .getRawMany();
    
    // Pentru items fără reception_date, folosim entry_date din stock items pentru filtrare după dată
    // Obține stock items pentru aceste order items (dacă nu există deja)
    const orderItemIdsWithoutDate = itemsWithoutReceptionDate.map((item: any) => item.item_id).filter(Boolean);
    if (orderItemIdsWithoutDate.length > 0) {
      try {
        // Obține toate stock items-urile care au supplier_order_item_id în lista noastră
        const stockResponse = await firstValueFrom(
          this.httpService.get(`${stockServiceUrl}/stock/items`, { headers })
        );
        const allStockItems = stockResponse.data || [];
        const additionalStockItems = allStockItems.filter((item: any) => {
          return orderItemIdsWithoutDate.includes(item.supplier_order_item_id);
        });
        // Adaugă la lista existentă de stock items
        stockItems = [...stockItems, ...additionalStockItems];
        this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${additionalStockItems.length} additional stock items for items without reception_date`);
      } catch (error: any) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch stock items for filtering:`, error?.message);
      }
    }
    
    // Creează un map de order_item_id -> stock items pentru filtrare după entry_date
    const stockItemsByOrderItemId = new Map<number, any[]>();
    for (const stockItem of stockItems) {
      const orderItemId = stockItem.supplier_order_item_id;
      if (orderItemId) {
        if (!stockItemsByOrderItemId.has(orderItemId)) {
          stockItemsByOrderItemId.set(orderItemId, []);
        }
        stockItemsByOrderItemId.get(orderItemId)!.push(stockItem);
      }
    }
    
    // Agregă items fără reception_date, filtrând după entry_date din stock items
    for (const item of itemsWithoutReceptionDate) {
      const productId = item.product_id;
      const received = parseFloat(item.received_quantity || '0');
      const orderItemId = item.item_id;
      
      // Verifică dacă există stock items pentru acest order item
      const relatedStockItems = stockItemsByOrderItemId.get(orderItemId) || [];
      
      // Dacă există stock items, filtrează după entry_date
      if (relatedStockItems.length > 0) {
        let hasStockInPeriod = false;
        for (const stockItem of relatedStockItems) {
          const entryDate = new Date(stockItem.entry_date);
          const start = new Date(startDate);
          const end = new Date(`${endDate} 23:59:59`);
          if (entryDate >= start && entryDate <= end) {
            hasStockInPeriod = true;
            break;
          }
        }
        // Dacă nu există stock items în perioada specificată, skip
        if (!hasStockInPeriod) {
          continue;
        }
      } else {
        // Dacă nu există stock items, folosim updated_at ca fallback (nu ideal, dar mai bine decât nimic)
        // Dar să nu includem dacă updated_at este în viitor sau prea vechi comparativ cu perioada
        const itemUpdated = item.updated_at ? new Date(item.updated_at) : null;
        if (itemUpdated) {
          const start = new Date(startDate);
          const end = new Date(`${endDate} 23:59:59`);
          if (itemUpdated < start || itemUpdated > end) {
            continue;
          }
        }
      }
      
      // Prioritate: reception_user_id > order_user_id
      const userId = item.reception_user_id || item.order_user_id || 0;
      
      const key = `${productId}:${userId}`;

      // Găsește prima dată de recepție din stock items asociate
      let receptionDate: Date | string | undefined;
      if (relatedStockItems.length > 0) {
        const dates = relatedStockItems
          .map(si => new Date(si.entry_date))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 0) {
          receptionDate = relatedStockItems.find(si => 
            new Date(si.entry_date).getTime() === dates[0].getTime()
          )?.entry_date;
        }
      }

      if (!aggregatedData.has(key)) {
        aggregatedData.set(key, {
          product_id: productId,
          user_id: userId,
          total_received: 0,
          total_returned: 0,
          return_count: 0,
          return_reasons: [],
          reception_date: receptionDate
        });
      }

      const data = aggregatedData.get(key)!;
      data.total_received += received;
      
      // Salvează prima dată de recepție (cea mai veche) pentru acest grup
      if (receptionDate) {
        const itemDate = new Date(receptionDate);
        if (!data.reception_date) {
          data.reception_date = receptionDate;
        } else {
          const existingDate = new Date(data.reception_date);
          if (itemDate < existingDate) {
            data.reception_date = receptionDate;
          }
        }
      }
    }
    
    // Agregă returnările din order items (cu user_id din order)
    const returnItemIds = returnItems.map((item: any) => item.item_id).filter(Boolean);
    let returnOrderItemsMap = new Map<number, any>();
    if (returnItemIds.length > 0) {
      const returnOrderItems = await this.orderItemRepo
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.order', 'order')
        .where('item.id IN (:...ids)', { ids: returnItemIds })
        .getMany();
      
      returnOrderItems.forEach(item => {
        returnOrderItemsMap.set(item.id, item);
      });
    }

    for (const item of returnItems) {
      const productId = item.product_id;
      const returned = parseFloat(item.returned_quantity || '0');
      const orderItem = returnOrderItemsMap.get(item.item_id);
      const userId = orderItem?.order?.created_by_user_id || 0;
      
      const key = `${productId}:${userId}`;

      if (!aggregatedData.has(key)) {
        // Pentru return items, nu avem reception_date direct, dar ar trebui să existe deja un entry
        // Dacă nu există, creăm unul nou (nu ar trebui să se întâmple în mod normal)
        aggregatedData.set(key, {
          product_id: productId,
          user_id: userId,
          total_received: 0,
          total_returned: 0,
          return_count: 0,
          return_reasons: [],
          reception_date: undefined // Pentru return items, reception_date va fi null
        });
      }

      const data = aggregatedData.get(key)!;
      data.total_returned += returned;
      
      if (returned > 0) {
        data.return_count++;
        if (item.return_reason) {
          data.return_reasons.push(item.return_reason);
        }
      }
    }

    // PASUL 3: Obținem informații despre produse și useri
    const reportData: any[] = [];
    
    // Obține toate user_id-urile unice pentru a le încărca odată
    const userIds = [...new Set(Array.from(aggregatedData.values()).map(d => d.user_id).filter(id => id > 0))];
    const usersMap = new Map<number, { first_name?: string; last_name?: string; employee_id?: number }>();
    
    // Obține informații despre angajați din users -> id_employee -> employees
    // Similar cu ce am făcut pentru revenues în locations service
    const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
    const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
    
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching employee data for ${userIds.length} users via users -> employees`);
    
    for (const userId of userIds) {
      try {
        // Obține id_employee din users
        const userResult = await this.connection.query(
          `SELECT id_employee FROM ${authDbName}.users WHERE id = ?`,
          [userId]
        );
        
        if (userResult && userResult.length > 0 && userResult[0].id_employee) {
          const employeeId = Number(userResult[0].id_employee);
          
          // Obține first_name și last_name din employees
          const employeeResult = await this.connection.query(
            `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
            [employeeId]
          );
          
          if (employeeResult && employeeResult.length > 0) {
            const firstName = employeeResult[0].first_name || null;
            const lastName = employeeResult[0].last_name || null;
            usersMap.set(userId, {
              first_name: firstName,
              last_name: lastName,
              employee_id: employeeId
            });
            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `ID: ${employeeId}`;
            this.logger.log(`✅ [SUPPLIERS SERVICE] Fetched employee data for user ${userId} (employee ${employeeId}): ${fullName}`);
          } else {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Employee ${employeeId} not found in employees table for user ${userId}`);
          }
        } else {
          this.logger.warn(`⚠️ [SUPPLIERS SERVICE] User ${userId} not found in users table or has no id_employee`);
        }
      } catch (error: any) {
        this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
      }
    }
    
    this.logger.log(`📊 [SUPPLIERS SERVICE] Loaded ${usersMap.size} users out of ${userIds.length} requested`);

    for (const [key, data] of aggregatedData.entries()) {
      try {
        const productId = data.product_id;
        
        // Obține produsul
        const productResponse = await firstValueFrom(
          this.httpService.get(`${stockServiceUrl}/stock/products/${productId}`, { headers })
        );
        const product = productResponse.data;

        // Obține informații despre user
        const user = usersMap.get(data.user_id);
        let userName: string;
        if (user && user.first_name && user.last_name) {
          // Folosește numele din employees (users -> id_employee -> employees)
          userName = `${user.first_name} ${user.last_name}`.trim();
        } else if (user && user.employee_id) {
          userName = `ID: ${user.employee_id}`;
        } else {
          userName = data.user_id > 0 ? `User ID: ${data.user_id}` : 'Necunoscut';
          this.logger.warn(`⚠️ [SUPPLIERS SERVICE] User ${data.user_id} not found in usersMap for product ${productId}`);
        }

        reportData.push({
          product_id: productId,
          product_name: product.name || `Produs ID: ${productId}`,
          user_id: data.user_id,
          user_name: userName,
          total_received: data.total_received,
          total_returned: data.total_returned,
          return_count: data.return_count,
          return_reasons: [...new Set(data.return_reasons)], // Elimină duplicatele
          reception_date: data.reception_date || null
        });
      } catch (error: any) {
        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch product ${data.product_id}:`, error?.message);
        
        // Obține informații despre user
        const user = usersMap.get(data.user_id);
        let userName: string;
        if (user && user.first_name && user.last_name) {
          // Folosește numele din employees (users -> id_employee -> employees)
          userName = `${user.first_name} ${user.last_name}`.trim();
        } else if (user && user.employee_id) {
          userName = `ID: ${user.employee_id}`;
        } else {
          userName = data.user_id > 0 ? `User ID: ${data.user_id}` : 'Necunoscut';
        }
        
        // Adaugă datele fără numele produsului
        reportData.push({
          product_id: data.product_id,
          product_name: `Produs ID: ${data.product_id}`,
          user_id: data.user_id,
          user_name: userName,
          total_received: data.total_received,
          total_returned: data.total_returned,
          return_count: data.return_count,
          return_reasons: [...new Set(data.return_reasons)],
          reception_date: data.reception_date || null
        });
      }
    }

    // Sortare după nume produs și apoi după nume user
    reportData.sort((a, b) => {
      if (a.product_name !== b.product_name) {
        return a.product_name.localeCompare(b.product_name);
      }
      return a.user_name.localeCompare(b.user_name);
    });

    return reportData;
  }

  async getReceptionEvents(
    startDate: string,
    endDate: string,
    orderId?: number,
    orderItemId?: number,
    productId?: number,
    userId?: number,
  ): Promise<Array<{
    supplier_order_id: number;
    supplier_order_item_id: number;
    product_id: number;
    user_id: number | null;
    user_name?: string;
    supplier_name?: string;
    original_quantity?: number;
    running_received?: number;
    location_id: number | null;
    received_delta: number;
    returned_delta: number;
    reason: string | null;
    occurred_at: Date;
  }>> {
    this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching reception events from ${startDate} to ${endDate}`);
    const qb = this.orderItemReceptionRepo
      .createQueryBuilder('ev')
      .select([
        'ev.supplier_order_id AS supplier_order_id',
        'ev.supplier_order_item_id AS supplier_order_item_id',
        'ev.product_id AS product_id',
        'ev.user_id AS user_id',
        'ev.location_id AS location_id',
        'ev.received_delta AS received_delta',
        'ev.returned_delta AS returned_delta',
        'ev.reason AS reason',
        'ev.occurred_at AS occurred_at',
      ])
      .where('DATE(ev.occurred_at) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('ev.occurred_at', 'ASC')
      .addOrderBy('ev.id', 'ASC');

    if (orderId !== undefined) {
      qb.andWhere('ev.supplier_order_id = :orderId', { orderId });
    }
    if (orderItemId !== undefined) {
      qb.andWhere('ev.supplier_order_item_id = :orderItemId', { orderItemId });
    }
    if (productId !== undefined) {
      qb.andWhere('ev.product_id = :productId', { productId });
    }
    if (userId !== undefined) {
      qb.andWhere('ev.user_id = :userId', { userId });
    }

    const rows = await qb.getRawMany();
    
    // Enrich with user_name
    const userIds = Array.from(new Set(rows.map((r: any) => Number(r.user_id)).filter((id: number) => !!id && id > 0)));
    const usersMap = new Map<number, any>();
    const orderItemIds = Array.from(new Set(rows.map((r: any) => Number(r.supplier_order_item_id)).filter((id: number) => !!id && id > 0)));
    const orderIds = Array.from(new Set(rows.map((r: any) => Number(r.supplier_order_id)).filter((id: number) => !!id && id > 0)));
    const orderItemToOriginalQty = new Map<number, number>();
    const orderToSupplierName = new Map<number, string>();
    if (userIds.length > 0) {
      const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
      const headers = { 'x-internal-service': 'suppliers', 'x-service-secret': serviceSecret };
      let employeesServiceUrl = this.configService.get<string>('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
      if (employeesServiceUrl.includes('bitap.ro') || employeesServiceUrl.includes('89.46.6.45')) {
        const portMatch = employeesServiceUrl.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : '3012';
        employeesServiceUrl = `http://localhost:${port}`;
      }
      for (const uid of userIds) {
        try {
          const resp: any = await firstValueFrom(this.httpService.get(`${employeesServiceUrl}/employees/${uid}`, { headers }));
          const data = resp?.data?.data || resp?.data || resp;
          if (data) usersMap.set(uid, data);
        } catch {
          // ignore; fallback to ID
        }
      }
    }
    if (orderItemIds.length > 0) {
      const items = await this.orderItemRepo.find({ where: { id: In(orderItemIds) as any } });
      for (const it of items) {
        orderItemToOriginalQty.set(it.id, Number(it.quantity) || 0);
      }
    }
    if (orderIds.length > 0) {
      const orders = await this.orderRepo.find({ where: { id: In(orderIds) as any }, relations: ['supplier'] });
      for (const o of orders) {
        orderToSupplierName.set(o.id, o.supplier?.supplier_name || `Order #${o.id}`);
      }
    }
      
    // Compute running_received per order_item
    const runningMap = new Map<number, number>();
    return rows.map((r: any) => {
      const uid = r.user_id !== null ? Number(r.user_id) : null;
      let userName: string | undefined = undefined;
      if (uid && usersMap.has(uid)) {
        const user = usersMap.get(uid);
        const firstName = user.first_name || user.firstName || '';
        const lastName = user.last_name || user.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        userName = fullName || user.email || user.name || `User ID: ${uid}`;
      }
      const orderItemId = Number(r.supplier_order_item_id);
      const orderIdVal = Number(r.supplier_order_id);
      const prev = runningMap.get(orderItemId) || 0;
      const receivedDelta = parseFloat(r.received_delta || '0');
      const nextReceived = prev + (receivedDelta > 0 ? receivedDelta : 0);
      runningMap.set(orderItemId, nextReceived);
      const originalQty = orderItemToOriginalQty.get(orderItemId) || 0;
      return {
        supplier_order_id: Number(r.supplier_order_id),
        supplier_order_item_id: Number(r.supplier_order_item_id),
        product_id: Number(r.product_id),
        user_id: uid,
        user_name: userName,
        supplier_name: orderToSupplierName.get(orderIdVal),
        original_quantity: originalQty,
        running_received: nextReceived,
        location_id: r.location_id !== null ? Number(r.location_id) : null,
        received_delta: receivedDelta,
        returned_delta: parseFloat(r.returned_delta || '0'),
        reason: r.reason ?? null,
        occurred_at: new Date(r.occurred_at),
      };
    });
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
    documentData: { fileName: string; folderId: number; notes?: string; content?: string; file_content?: string; expire_date?: string },
  ) {
    const supplier = await this.findOne(supplierId);
    const folder = await this.folderRepo.findOne({ where: { id: documentData.folderId, supplier_id: supplierId } });
    if (!folder) throw new NotFoundException('Folderul nu a fost găsit');
    
    // Get the supplier name simplified
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    
    // Save physical file if content provided
    const base64 = documentData.content || documentData.file_content;
    if (base64) {
      const repoRoot = this.getRepoRoot();
      
      // Handle both old and new folder path structures
      let folderPathToUse = folder.folder_path;
      
      // Check if the folder path follows the old structure (with ID)
      if (folder.folder_path.includes(`/suppliers/${supplierId}/`)) {
        // This is the old structure with ID, we need to convert it to the new structure
        folderPathToUse = `/files/suppliers/${supplierNameSimplified}/${folder.folder_path.split('/').slice(4).join('/')}`;
      } else if (folder.folder_path.startsWith(`/files/suppliers/`) && !folder.folder_path.includes(`/${supplierId}/`)) {
        // This is already the new structure, use it as is
        folderPathToUse = folder.folder_path;
      }
      
      const absoluteDir = path.join(repoRoot, folderPathToUse);
      const absolutePath = path.join(absoluteDir, documentData.fileName);
      
      // Ensure directory exists
      if (!fs.existsSync(absoluteDir)) {
        fs.mkdirSync(absoluteDir, { recursive: true });
      }
      
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(absolutePath, buffer);
    }
    
    // Handle both old and new file path structures for the document record
    let filePathToUse = folder.folder_path;
    
    // Check if the folder path follows the old structure (with ID)
    if (folder.folder_path.includes(`/suppliers/${supplierId}/`)) {
      // This is the old structure with ID, we need to convert it to the new structure
      filePathToUse = `/files/suppliers/${supplierNameSimplified}/${folder.folder_path.split('/').slice(4).join('/')}`;
    } else if (folder.folder_path.startsWith(`/files/suppliers/`) && !folder.folder_path.includes(`/${supplierId}/`)) {
      // This is already the new structure, use it as is
      filePathToUse = folder.folder_path;
    }
    
    const document = this.supplierDocumentRepo.create({
      folder_id: documentData.folderId,
      document_type: DocumentType.OTHER,
      file_name: documentData.fileName,
      file_path: `${filePathToUse}${documentData.fileName}`,
      expire_date: documentData.expire_date ? new Date(documentData.expire_date) : null,
      notes: documentData.notes,
    });
    return this.supplierDocumentRepo.save(document);
  }

  async removeDocument(documentId: number): Promise<void> {
    const document = await this.supplierDocumentRepo.findOne({ where: { id: documentId } });
    if (!document) {
      this.logger.warn(`Document with ID ${documentId} not found in database`);
      throw new NotFoundException('Documentul nu a fost găsit');
    }
    
    // Remove physical file if it exists
    try {
      const repoRoot = this.getRepoRoot();
      
      // Handle both old and new path structures
      let filePathToUse = document.file_path;
      this.logger.log(`📄 Removing document ID: ${documentId}, Name: ${document.file_name}, Path: ${document.file_path}`);
      
      if (document.file_path.includes('/suppliers/')) {
        // Extract supplier ID and name from the path
        const pathParts = document.file_path.split('/');
        const suppliersIndex = pathParts.indexOf('suppliers');
        if (suppliersIndex !== -1 && pathParts.length > suppliersIndex + 2) {
          // Check if the path follows the old structure (with ID)
          const possibleId = pathParts[suppliersIndex + 1];
          if (!isNaN(Number(possibleId))) {
            // This is the old structure with ID, we need to remove the ID part
            const supplierName = pathParts[suppliersIndex + 2];
            filePathToUse = `/files/suppliers/${supplierName}/${pathParts.slice(suppliersIndex + 3).join('/')}`;
            this.logger.log(`📄 Converting old path structure to new for removal: ${filePathToUse}`);
          }
        }
      }
      
      const absolutePath = path.join(repoRoot, filePathToUse.startsWith('/files') ? filePathToUse : `/files${filePathToUse}`);
      this.logger.log(`📄 Absolute file path for removal: ${absolutePath}`);
      
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        this.logger.log(`✅ Deleted physical file: ${absolutePath}`);
      } else {
        this.logger.warn(`⚠️ Physical file not found for removal: ${absolutePath}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Failed to delete physical file for document ${documentId}:`, error);
    }
    
    await this.supplierDocumentRepo.remove(document);
    this.logger.log(`✅ Removed document record from database: ${documentId}`);
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

  // Find documents expiring on a specific date
  async findExpiringDocuments(targetDate: string): Promise<SupplierDocument[]> {
    this.logger.log(`[SUPPLIERS SERVICE] Finding documents expiring on ${targetDate}`);
    // Format the date to match the database format (YYYY-MM-DD)
    const formattedDate = new Date(targetDate);
    formattedDate.setHours(0, 0, 0, 0);
    
    const documents = await this.supplierDocumentRepo
      .createQueryBuilder('document')
      .where('DATE(document.expire_date) = :targetDate', { targetDate })
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('folder.supplier', 'supplier')
      .getMany();
    
    this.logger.log(`[SUPPLIERS SERVICE] Found ${documents.length} documents expiring on ${targetDate}`);
    return documents;
  }

  // Find documents that have already expired
  async findExpiredDocuments(): Promise<SupplierDocument[]> {
    this.logger.log(`[SUPPLIERS SERVICE] Finding expired documents`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const documents = await this.supplierDocumentRepo
      .createQueryBuilder('document')
      .where('document.expire_date < :today', { today })
      .andWhere('document.expire_date IS NOT NULL')
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('folder.supplier', 'supplier')
      .getMany();
    
    this.logger.log(`[SUPPLIERS SERVICE] Found ${documents.length} expired documents`);
    return documents;
  }
}


