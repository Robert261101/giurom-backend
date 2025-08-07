import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder, OrderStatus } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './entities/supplier-order-document.entity';
import { SupplierDocument } from './entities/supplier-document.entity';
import { Product } from '../stock/entities/product.entity';
import { Stock, StockStatus } from '../stock/entities/stock.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { DocumentType } from './entities/supplier-document.entity';
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
    @InjectRepository(SupplierDocument)
    private readonly supplierDocumentRepo: Repository<SupplierDocument>,
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

  // 1.1. Creare Furnizor cu documente din formular
  async createWithDocuments(dto: CreateSupplierWithDocumentsDto): Promise<Supplier> {
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

    // Extrage datele pentru furnizor (fără folderName și documents)
    const supplierData = { ...dto };
    delete supplierData.folderName;
    delete supplierData.documents;
    
    // Creează furnizorul
    const supplier = this.supplierRepo.create(supplierData);
    const savedSupplier = await this.supplierRepo.save(supplier);

    // Creează folderele cu numele din formular și documentele
    await this.createSupplierFoldersWithCustomName(savedSupplier, dto.folderName, dto.documents);

    return savedSupplier;
  }

  private async createSupplierFolders(supplier: Supplier): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    
    // Creează folderele fizice în directorul "files" din root-ul proiectului (un nivel mai sus)
    const projectRoot = path.join(process.cwd(), '..');
    const filesDir = path.join(projectRoot, 'files');
    const suppliersDir = path.join(filesDir, 'suppliers');
    const supplierDir = path.join(suppliersDir, supplier.id.toString(), supplierNameSimplified);
    const dataDir = path.join(supplierDir, 'data');
    const ordersDir = path.join(supplierDir, 'orders');

    // Creează directoarele dacă nu există
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    if (!fs.existsSync(suppliersDir)) fs.mkdirSync(suppliersDir, { recursive: true });
    if (!fs.existsSync(supplierDir)) fs.mkdirSync(supplierDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });

    // Path-urile pentru baza de date (relative la files)
    const basePath = `/files/suppliers/${supplier.id}/${supplierNameSimplified}`;

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

  private async createSupplierFoldersWithCustomName(supplier: Supplier, customFolderName?: string, documents?: any[]): Promise<void> {
    const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
    
    // Creează folderele fizice în directorul "files" din root-ul proiectului (un nivel mai sus)
    const projectRoot = path.join(process.cwd(), '..');
    const filesDir = path.join(projectRoot, 'files');
    const suppliersDir = path.join(filesDir, 'suppliers');
    const supplierDir = path.join(suppliersDir, supplier.id.toString(), supplierNameSimplified);
    const dataDir = path.join(supplierDir, 'data');
    const ordersDir = path.join(supplierDir, 'orders');

    // Creează directoarele dacă nu există
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    if (!fs.existsSync(suppliersDir)) fs.mkdirSync(suppliersDir, { recursive: true });
    if (!fs.existsSync(supplierDir)) fs.mkdirSync(supplierDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });

    // Path-urile pentru baza de date (relative la files)
    const basePath = `/files/suppliers/${supplier.id}/${supplierNameSimplified}`;

    // Salvează în baza de date cu numele custom pentru folderul de documente
    const documentFolderName = customFolderName || 'Folder pentru documente și contracte';
    
    const folders = [
      {
        supplier_id: supplier.id,
        description: documentFolderName,
        folder_path: `${basePath}/data/`,
      },
      {
        supplier_id: supplier.id,
        description: 'Folder pentru comenzi și PDF-uri generate',
        folder_path: `${basePath}/orders/`,
      },
    ];

    const savedFolders = [];
    for (const folderData of folders) {
      const folder = this.folderRepo.create(folderData);
      const savedFolder = await this.folderRepo.save(folder);
      savedFolders.push(savedFolder);
    }

    // Dacă există documente, salvează-le fizic în folderul de documente
    if (documents && documents.length > 0 && savedFolders[0]) {
      const documentFolder = savedFolders[0]; // Primul folder este pentru documente
      
      for (const doc of documents) {
        try {
          // Generează un nume unic pentru fișier pentru a evita conflictele
          const fileName = doc.fileName || doc.name;
          const timestamp = Date.now();
          const uniqueFileName = `${timestamp}_${fileName}`;
          const filePath = path.join(dataDir, uniqueFileName);
          
          // Salvează fișierul real din conținutul base64
          if (doc.content && doc.content.startsWith('data:')) {
            // Extract base64 content (remove data:mime/type;base64, prefix)
            const base64Data = doc.content.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);
            console.log(`✅ Document salvat fizic (${buffer.length} bytes): ${filePath}`);
          } else {
            // Fallback: create a text file with document info if no content
            const fileContent = `Document: ${fileName}\nNote: ${doc.note || doc.notes || 'Fără note'}\nData upload: ${new Date().toISOString()}\nFurnizor: ${supplier.supplier_name}`;
            fs.writeFileSync(filePath, fileContent, 'utf8');
            console.log(`✅ Document info salvat fizic: ${filePath}`);
          }
          
          console.log(`✅ Document salvat fizic: ${filePath}`);

          // Salvează informațiile în baza de date
          const documentData = {
            folder_id: documentFolder.id,
            document_type: DocumentType.OTHER,
            file_name: fileName,
            file_path: `${basePath}/data/${uniqueFileName}`,
            notes: doc.note || doc.notes || '',
          };

          const document = this.supplierDocumentRepo.create(documentData);
          await this.supplierDocumentRepo.save(document);
          
          console.log(`✅ Document salvat în DB: ${fileName}`);
        } catch (error) {
          console.error('Error saving document:', error);
          // Continue cu următorul document chiar dacă unul eșuează
        }
      }
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
      relations: ['folders', 'folders.documents', 'products', 'orders', 'orders.items', 'orders.documents'],
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
      // Calculate default expiration date (30 days from delivery)
      const defaultExpirationDate = new Date(order.delivery_date);
      defaultExpirationDate.setDate(defaultExpirationDate.getDate() + 30);

      const stockEntry = this.stockRepo.create({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price_per_unit,
        entry_date: order.delivery_date,
        expiration_date: defaultExpirationDate,
        status: StockStatus.VALID,
        supplier_order_item_id: item.id,
      });

      await this.stockRepo.save(stockEntry);
    }

    return order;
  }

  // Update order status
  async updateOrderStatus(orderId: number, status: string): Promise<SupplierOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Comanda nu a fost găsită');
    }

    order.status = status as OrderStatus;
    await this.orderRepo.save(order);

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

  // Update supplier product
  async updateSupplierProduct(productId: number, updateData: Partial<SupplierProduct>): Promise<SupplierProduct> {
    console.log('🔄 Backend: Updating supplier product', productId, 'with data:', updateData);
    
    const supplierProduct = await this.supplierProductRepo.findOne({ 
      where: { id: productId }
      // Removed relations to avoid conflicts
    });
    
    if (!supplierProduct) {
      throw new NotFoundException('Produsul furnizor nu a fost găsit');
    }

    console.log('📦 Backend: Current product before update:', {
      id: supplierProduct.id,
      product_id: supplierProduct.product_id,
      product_name: supplierProduct.product_name
    });

    // Update the supplier product
    Object.assign(supplierProduct, updateData);
    
    console.log('📦 Backend: Product after Object.assign:', {
      id: supplierProduct.id,
      product_id: supplierProduct.product_id,
      product_name: supplierProduct.product_name
    });
    
    const savedProduct = await this.supplierProductRepo.save(supplierProduct);
    
    console.log('✅ Backend: Product saved to database:', {
      id: savedProduct.id,
      product_id: savedProduct.product_id,
      product_name: savedProduct.product_name
    });
    
    return savedProduct;
  }

  // Delete supplier product
  async removeSupplierProduct(productId: number): Promise<void> {
    const supplierProduct = await this.supplierProductRepo.findOne({ where: { id: productId } });
    
    if (!supplierProduct) {
      throw new NotFoundException('Produsul furnizor nu a fost găsit');
    }

    await this.supplierProductRepo.remove(supplierProduct);
  }

  // Add document to supplier
  async addDocument(supplierId: number, documentData: { fileName: string; folderId: number; notes?: string; content?: string }) {
    const supplier = await this.findOne(supplierId);
    
    // Verify folder belongs to supplier
    const folder = await this.folderRepo.findOne({ 
      where: { id: documentData.folderId, supplier_id: supplierId } 
    });
    
    if (!folder) {
      throw new NotFoundException('Folderul nu a fost găsit');
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${documentData.fileName}`;
    
    // Construct physical file path
    const projectRoot = path.join(process.cwd(), '..');
    const physicalFolderPath = path.join(projectRoot, folder.folder_path);
    const physicalFilePath = path.join(physicalFolderPath, uniqueFileName);
    
    console.log(`📁 Saving document to: ${physicalFilePath}`);
    
    // Ensure directory exists
    if (!fs.existsSync(physicalFolderPath)) {
      fs.mkdirSync(physicalFolderPath, { recursive: true });
      console.log(`📂 Created directory: ${physicalFolderPath}`);
    }
    
    // Save physical file if content is provided
    if (documentData.content) {
      try {
        const base64Data = documentData.content.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(physicalFilePath, buffer);
        console.log(`✅ Document saved physically (${buffer.length} bytes): ${physicalFilePath}`);
      } catch (error) {
        console.error('❌ Error saving physical file:', error);
        throw new BadRequestException('Eroare la salvarea fișierului fizic');
      }
    } else {
      // Create placeholder file if no content
      const fileContent = `Document: ${documentData.fileName}\nNote: ${documentData.notes || 'Fără note'}\nData upload: ${new Date().toISOString()}\nFurnizor ID: ${supplierId}`;
      fs.writeFileSync(physicalFilePath, fileContent, 'utf8');
      console.log(`✅ Placeholder document created: ${physicalFilePath}`);
    }

    // Save to database with unique filename in path
    const document = this.supplierDocumentRepo.create({
      folder_id: documentData.folderId,
      document_type: DocumentType.OTHER,
      file_name: documentData.fileName,
      file_path: `${folder.folder_path}${uniqueFileName}`,
      notes: documentData.notes,
    });

    return this.supplierDocumentRepo.save(document);
  }

  // Remove document
  async removeDocument(documentId: number): Promise<void> {
    const document = await this.supplierDocumentRepo.findOne({ where: { id: documentId } });
    
    if (!document) {
      throw new NotFoundException('Documentul nu a fost găsit');
    }

    await this.supplierDocumentRepo.remove(document);
  }

  // File serving methods
  async getFileInfo(fileId: number) {
    console.log(`🔍 Service: Getting supplier file info for ID: ${fileId}`);
    
    const file = await this.supplierDocumentRepo.findOne({
      where: { id: fileId },
      relations: ['folder'],
    });

    if (!file) {
      console.log(`❌ File not found with ID: ${fileId}`);
      throw new NotFoundException(`Fișierul cu ID ${fileId} nu a fost găsit`);
    }

    console.log(`✅ File found:`, {
      id: file.id,
      fileName: file.file_name,
      filePath: file.file_path,
      folderId: file.folder_id,
    });

    // Construiește calea absolută către fișier
    const projectRoot = path.join(process.cwd(), '..');
    const absoluteFilePath = path.join(projectRoot, file.file_path);

    return {
      id: file.id,
      fileName: file.file_name,
      filePath: file.file_path,
      absoluteFilePath: absoluteFilePath,
      folderId: file.folder_id,
      folder: file.folder,
      exists: fs.existsSync(absoluteFilePath),
    };
  }

  async serveSupplierFile(fileId: number, forceDownload: boolean = false, res: any) {
    console.log(`🔍 Service: Serving supplier file with ID: ${fileId}, forceDownload: ${forceDownload}`);
    
    try {
      const file = await this.supplierDocumentRepo.findOne({
        where: { id: fileId },
        relations: ['folder'],
      });

      if (!file) {
        console.log(`❌ File not found with ID: ${fileId}`);
        throw new NotFoundException(`Fișierul cu ID ${fileId} nu a fost găsit`);
      }

      console.log(`📁 File found: ${file.file_name} at ${file.file_path}`);

      // Construiește calea absolută către fișier
      const projectRoot = path.join(process.cwd(), '..');
      const absoluteFilePath = path.join(projectRoot, file.file_path);
      
      console.log(`🔍 Absolute file path: ${absoluteFilePath}`);

      // Verifică dacă fișierul există pe disk
      if (!fs.existsSync(absoluteFilePath)) {
        console.log(`❌ File does not exist on disk: ${absoluteFilePath}`);
        throw new NotFoundException(`Fișierul ${file.file_name} nu a fost găsit pe disk`);
      }

      // Obține informații despre fișier
      const stats = fs.statSync(absoluteFilePath);
      const fileSize = stats.size;
      const ext = path.extname(file.file_name).toLowerCase();

      console.log(`📊 File stats: size=${fileSize}, ext=${ext}`);

      // Determină tipul de conținut
      let contentType = 'application/octet-stream';
      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.txt':
          contentType = 'text/plain';
          break;
        case '.doc':
          contentType = 'application/msword';
          break;
        case '.docx':
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
      }

      console.log(`📄 Content type determined: ${contentType}`);

      // Setează header-ele de răspuns
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileSize);

      if (forceDownload || (ext !== '.pdf' && !ext.match(/\.(jpg|jpeg|png|gif)$/))) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);
        console.log(`⬇️ Setting as download: ${file.file_name}`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.file_name)}"`);
        console.log(`👁️ Setting as inline view: ${file.file_name}`);
      }

      // Citește și trimite fișierul
      const fileStream = fs.createReadStream(absoluteFilePath);
      
      fileStream.on('error', (error) => {
        console.error(`❌ Error reading file stream:`, error);
        if (!res.headersSent) {
          res.status(500).json({ 
            message: 'Eroare la citirea fișierului',
            error: error.message 
          });
        }
      });

      fileStream.on('end', () => {
        console.log(`✅ File stream ended successfully for: ${file.file_name}`);
      });

      console.log(`📤 Starting file stream for: ${file.file_name}`);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error(`❌ Error in serveSupplierFile:`, error);
      
      if (!res.headersSent) {
        if (error instanceof NotFoundException) {
          res.status(404).json({ 
            message: error.message,
            fileId: fileId 
          });
        } else {
          res.status(500).json({ 
            message: 'Eroare internă la servirea fișierului',
            error: error.message,
            fileId: fileId 
          });
        }
      }
    }
  }
}
