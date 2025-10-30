"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const supplier_entity_1 = require("./entities/supplier.entity");
const supplier_folder_entity_1 = require("./entities/supplier-folder.entity");
const supplier_product_entity_1 = require("./entities/supplier-product.entity");
const supplier_order_entity_1 = require("./entities/supplier-order.entity");
const supplier_order_item_entity_1 = require("./entities/supplier-order-item.entity");
const supplier_order_document_entity_1 = require("./entities/supplier-order-document.entity");
const supplier_document_entity_1 = require("./entities/supplier-document.entity");
const supplier_locations_entity_1 = require("./entities/supplier-locations.entity");
const stock_http_service_1 = require("./stock-http.service");
const fs = require("fs");
const path = require("path");
let SuppliersService = class SuppliersService {
    constructor(supplierRepo, folderRepo, supplierProductRepo, orderRepo, orderItemRepo, orderDocumentRepo, supplierDocumentRepo, supplierLocationsRepo, stockHttpService) {
        this.supplierRepo = supplierRepo;
        this.folderRepo = folderRepo;
        this.supplierProductRepo = supplierProductRepo;
        this.orderRepo = orderRepo;
        this.orderItemRepo = orderItemRepo;
        this.orderDocumentRepo = orderDocumentRepo;
        this.supplierDocumentRepo = supplierDocumentRepo;
        this.supplierLocationsRepo = supplierLocationsRepo;
        this.stockHttpService = stockHttpService;
    }
    async create(dto) {
        const existingSupplier = await this.supplierRepo.findOne({
            where: [
                { registration_number: dto.registration_number },
                { vat_number: dto.vat_number },
            ],
        });
        if (existingSupplier) {
            throw new common_1.BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
        }
        const { location_id, ...supplierData } = dto;
        const supplier = this.supplierRepo.create(supplierData);
        const savedSupplier = (await this.supplierRepo.save(supplier));
        await this.createSupplierFolders(savedSupplier);
        if (location_id) {
            try {
                await this.assignSupplierToLocation(savedSupplier.id, location_id);
            }
            catch (error) {
                console.warn(`Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`, error?.message || error);
            }
        }
        return savedSupplier;
    }
    async createWithDocuments(dto) {
        const existingSupplier = await this.supplierRepo.findOne({
            where: [
                { registration_number: dto.registration_number },
                { vat_number: dto.vat_number },
            ],
        });
        if (existingSupplier) {
            throw new common_1.BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
        }
        const supplierData = { ...dto };
        const { location_id } = dto;
        delete supplierData.folderName;
        delete supplierData.documents;
        delete supplierData.location_id;
        const supplier = this.supplierRepo.create(supplierData);
        const savedSupplier = (await this.supplierRepo.save(supplier));
        await this.createSupplierFoldersWithCustomName(savedSupplier, dto.folderName, dto.documents);
        if (location_id) {
            try {
                await this.assignSupplierToLocation(savedSupplier.id, location_id);
            }
            catch (error) {
                console.warn(`Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`, error?.message || error);
            }
        }
        return savedSupplier;
    }
    getRepoRoot() {
        let repoRoot = path.resolve(__dirname, '../../..');
        if (path.basename(repoRoot) === 'giurom-backend') {
            repoRoot = path.dirname(repoRoot);
        }
        return repoRoot;
    }
    async createSupplierFolders(supplier) {
        const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
        const repoRoot = this.getRepoRoot();
        const filesDir = path.join(repoRoot, 'files');
        const suppliersDir = path.join(filesDir, 'suppliers');
        const supplierDir = path.join(suppliersDir, supplier.id.toString(), supplierNameSimplified);
        const dataDir = path.join(supplierDir, 'data');
        const ordersDir = path.join(supplierDir, 'orders');
        if (!fs.existsSync(filesDir))
            fs.mkdirSync(filesDir, { recursive: true });
        if (!fs.existsSync(suppliersDir))
            fs.mkdirSync(suppliersDir, { recursive: true });
        if (!fs.existsSync(supplierDir))
            fs.mkdirSync(supplierDir, { recursive: true });
        if (!fs.existsSync(dataDir))
            fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(ordersDir))
            fs.mkdirSync(ordersDir, { recursive: true });
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
    async createSupplierFoldersWithCustomName(supplier, customFolderName, documents) {
        const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
        const repoRoot = this.getRepoRoot();
        const filesDir = path.join(repoRoot, 'files');
        const suppliersDir = path.join(filesDir, 'suppliers');
        const supplierDir = path.join(suppliersDir, supplier.id.toString(), supplierNameSimplified);
        const dataDir = path.join(supplierDir, 'data');
        const ordersDir = path.join(supplierDir, 'orders');
        if (!fs.existsSync(filesDir))
            fs.mkdirSync(filesDir, { recursive: true });
        if (!fs.existsSync(suppliersDir))
            fs.mkdirSync(suppliersDir, { recursive: true });
        if (!fs.existsSync(supplierDir))
            fs.mkdirSync(supplierDir, { recursive: true });
        if (!fs.existsSync(dataDir))
            fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(ordersDir))
            fs.mkdirSync(ordersDir, { recursive: true });
        const basePath = `/files/suppliers/${supplier.id}/${supplierNameSimplified}`;
        const documentFolderName = customFolderName || 'Folder pentru documente și contracte';
        const folders = [
            { supplier_id: supplier.id, description: documentFolderName, folder_path: `${basePath}/data/` },
            { supplier_id: supplier.id, description: 'Folder pentru comenzi și PDF-uri generate', folder_path: `${basePath}/orders/` },
        ];
        const savedFolders = [];
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
                    }
                    else {
                        const fileContent = `Document: ${fileName}\nNote: ${doc.note || doc.notes || ''}\nUpload: ${new Date().toISOString()}\nFurnizor: ${supplier.supplier_name}`;
                        fs.writeFileSync(filePath, fileContent, 'utf8');
                    }
                    const documentData = {
                        folder_id: documentFolder.id,
                        document_type: supplier_document_entity_1.DocumentType.OTHER,
                        file_name: fileName,
                        file_path: `${basePath}/data/${uniqueFileName}`,
                        notes: doc.note || doc.notes || '',
                    };
                    const document = this.supplierDocumentRepo.create(documentData);
                    await this.supplierDocumentRepo.save(document);
                }
                catch { }
            }
        }
    }
    simplifySupplierName(name) {
        return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
    }
    async serveDocument(fileId, forceDownload) {
        const document = await this.supplierDocumentRepo.findOne({ where: { id: fileId } });
        if (!document)
            throw new common_1.NotFoundException('Documentul nu a fost găsit');
        const repoRoot = this.getRepoRoot();
        const absolutePath = path.join(repoRoot, document.file_path.startsWith('/files') ? document.file_path : `/files${document.file_path}`);
        const buffer = fs.readFileSync(absolutePath);
        const fileExt = document.file_name.split('.').pop()?.toLowerCase() || '';
        const mimeMap = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
        const mimeType = mimeMap[fileExt] || 'application/octet-stream';
        const disposition = forceDownload ? 'attachment' : 'inline';
        return { data: buffer.toString('base64'), mimeType, fileName: document.file_name, disposition };
    }
    async findAll() {
        return this.supplierRepo.find({ relations: ['folders', 'products', 'orders'], order: { created_at: 'DESC' } });
    }
    async findOne(id) {
        const supplier = await this.supplierRepo.findOne({ where: { id }, relations: ['folders', 'folders.documents', 'products', 'orders', 'orders.items', 'orders.documents'] });
        if (!supplier)
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        return supplier;
    }
    async update(id, dto) {
        const supplier = await this.findOne(id);
        if (dto.registration_number || dto.vat_number) {
            const existingSupplier = await this.supplierRepo.findOne({
                where: [
                    { registration_number: dto.registration_number },
                    { vat_number: dto.vat_number },
                ],
            });
            if (existingSupplier && existingSupplier.id !== id) {
                throw new common_1.BadRequestException('Furnizor duplicat');
            }
        }
        Object.assign(supplier, dto);
        return this.supplierRepo.save(supplier);
    }
    async remove(id) {
        const supplier = await this.findOne(id);
        await this.supplierRepo.remove(supplier);
    }
    async addProduct(dto) {
        const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
        if (!supplier)
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        const existingProduct = await this.supplierProductRepo.findOne({ where: { supplier_id: dto.supplier_id, product_id: dto.product_id } });
        if (existingProduct)
            throw new common_1.BadRequestException('Produsul este deja asociat');
        const supplierProduct = this.supplierProductRepo.create(dto);
        return this.supplierProductRepo.save(supplierProduct);
    }
    async getSupplierProducts(supplierId) {
        return this.supplierProductRepo.find({ where: { supplier_id: supplierId }, order: { created_at: 'DESC' } });
    }
    async createOrder(dto) {
        const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
        if (!supplier)
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        const orderData = {
            supplier_id: dto.supplier_id,
            order_date: new Date(dto.order_date),
            delivery_date: new Date(dto.delivery_date),
            status: dto.status || supplier_order_entity_1.OrderStatus.DRAFT,
            notes: dto.notes,
            created_by_user_id: dto.created_by_user_id,
            total_amount: 0,
        };
        const order = this.orderRepo.create(orderData);
        const savedOrder = await this.orderRepo.save(order);
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
        return (await this.orderRepo.findOne({ where: { id: savedOrder.id }, relations: ['items', 'documents'] }));
    }
    async generateOrderPDF(order, supplier) {
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
    async markOrderAsDelivered(orderId) {
        const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
        if (!order)
            throw new common_1.NotFoundException('Comanda nu a fost găsită');
        if (order.status === supplier_order_entity_1.OrderStatus.DELIVERED)
            throw new common_1.BadRequestException('Comanda este deja livrată');
        const stockItems = order.items?.map(item => ({
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
        order.status = supplier_order_entity_1.OrderStatus.DELIVERED;
        await this.orderRepo.save(order);
        return order;
    }
    async updateOrderStatus(orderId, status) {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Comanda nu a fost găsită');
        order.status = status;
        await this.orderRepo.save(order);
        return order;
    }
    async getSupplierOrders(supplierId) {
        return this.orderRepo.find({ where: { supplier_id: supplierId }, relations: ['items', 'documents'], order: { created_at: 'DESC' } });
    }
    async updateSupplierProduct(productId, updateData) {
        const supplierProduct = await this.supplierProductRepo.findOne({ where: { id: productId } });
        if (!supplierProduct)
            throw new common_1.NotFoundException('Produsul furnizor nu a fost găsit');
        Object.assign(supplierProduct, updateData);
        return this.supplierProductRepo.save(supplierProduct);
    }
    async removeSupplierProduct(productId) {
        const supplierProduct = await this.supplierProductRepo.findOne({ where: { id: productId } });
        if (!supplierProduct)
            throw new common_1.NotFoundException('Produsul furnizor nu a fost găsit');
        await this.supplierProductRepo.remove(supplierProduct);
    }
    async addDocument(supplierId, documentData) {
        await this.findOne(supplierId);
        const folder = await this.folderRepo.findOne({ where: { id: documentData.folderId, supplier_id: supplierId } });
        if (!folder)
            throw new common_1.NotFoundException('Folderul nu a fost găsit');
        const base64 = documentData.content || documentData.file_content;
        if (base64) {
            const repoRoot = this.getRepoRoot();
            const absoluteDir = path.join(repoRoot, folder.folder_path);
            const absolutePath = path.join(absoluteDir, documentData.fileName);
            if (!fs.existsSync(absoluteDir))
                fs.mkdirSync(absoluteDir, { recursive: true });
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(absolutePath, buffer);
        }
        const document = this.supplierDocumentRepo.create({
            folder_id: documentData.folderId,
            document_type: supplier_document_entity_1.DocumentType.OTHER,
            file_name: documentData.fileName,
            file_path: `${folder.folder_path}${documentData.fileName}`,
            notes: documentData.notes,
        });
        return this.supplierDocumentRepo.save(document);
    }
    async removeDocument(documentId) {
        const document = await this.supplierDocumentRepo.findOne({ where: { id: documentId } });
        if (!document)
            throw new common_1.NotFoundException('Documentul nu a fost găsit');
        await this.supplierDocumentRepo.remove(document);
    }
    generateEmailLink(supplierId, orderId) {
        const subject = encodeURIComponent(`Comandă #${orderId}`);
        const body = encodeURIComponent(`Bună ziua,\n\nVă transmitem comanda #${orderId} pentru furnizor ${supplierId}.`);
        return `mailto:?subject=${subject}&body=${body}`;
    }
    generateWhatsAppLink(supplierId, orderId, pdfUrl) {
        const text = `Comandă #${orderId} pentru furnizor ${supplierId}${pdfUrl ? ` PDF: ${pdfUrl}` : ''}`;
        return `https://wa.me/?text=${encodeURIComponent(text)}`;
    }
    async assignSupplierToLocation(supplierId, locationId) {
        await this.findOne(supplierId);
        const existingAssignment = await this.supplierLocationsRepo.findOne({
            where: { supplier_id: supplierId, id_location: locationId }
        });
        if (existingAssignment) {
            throw new common_1.BadRequestException('Furnizorul este deja atribuit la această locație');
        }
        const assignment = this.supplierLocationsRepo.create({
            supplier_id: supplierId,
            id_location: locationId,
        });
        return await this.supplierLocationsRepo.save(assignment);
    }
    async findSupplierLocations(supplierId) {
        await this.findOne(supplierId);
        return await this.supplierLocationsRepo.find({
            where: { supplier_id: supplierId },
            relations: ['supplier', 'workLocation'],
        });
    }
    async findLocationSuppliers(locationId) {
        return await this.supplierLocationsRepo.find({
            where: { id_location: locationId },
            relations: ['supplier', 'workLocation'],
        });
    }
    async removeSupplierFromLocation(supplierId, locationId) {
        const assignment = await this.supplierLocationsRepo.findOne({
            where: { supplier_id: supplierId, id_location: locationId }
        });
        if (!assignment) {
            throw new common_1.NotFoundException('Asocierea nu a fost găsită');
        }
        await this.supplierLocationsRepo.remove(assignment);
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(supplier_entity_1.Supplier)),
    __param(1, (0, typeorm_1.InjectRepository)(supplier_folder_entity_1.SupplierFolder)),
    __param(2, (0, typeorm_1.InjectRepository)(supplier_product_entity_1.SupplierProduct)),
    __param(3, (0, typeorm_1.InjectRepository)(supplier_order_entity_1.SupplierOrder)),
    __param(4, (0, typeorm_1.InjectRepository)(supplier_order_item_entity_1.SupplierOrderItem)),
    __param(5, (0, typeorm_1.InjectRepository)(supplier_order_document_entity_1.SupplierOrderDocument)),
    __param(6, (0, typeorm_1.InjectRepository)(supplier_document_entity_1.SupplierDocument)),
    __param(7, (0, typeorm_1.InjectRepository)(supplier_locations_entity_1.SupplierLocations)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        stock_http_service_1.StockHttpService])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map