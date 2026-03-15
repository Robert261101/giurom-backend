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
var SuppliersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const microservices_1 = require("@nestjs/microservices");
const rxjs_1 = require("rxjs");
const supplier_entity_1 = require("./entities/supplier.entity");
const supplier_folder_entity_1 = require("./entities/supplier-folder.entity");
const supplier_product_entity_1 = require("./entities/supplier-product.entity");
const supplier_order_entity_1 = require("./entities/supplier-order.entity");
const supplier_order_item_entity_1 = require("./entities/supplier-order-item.entity");
const supplier_order_document_entity_1 = require("./entities/supplier-order-document.entity");
const supplier_order_item_reception_entity_1 = require("./entities/supplier-order-item-reception.entity");
const supplier_order_cancelled_item_entity_1 = require("./entities/supplier-order-cancelled-item.entity");
const supplier_document_entity_1 = require("./entities/supplier-document.entity");
const supplier_locations_entity_1 = require("./entities/supplier-locations.entity");
const stock_http_service_1 = require("./stock-http.service");
const fs = require("fs");
const path = require("path");
let SuppliersService = SuppliersService_1 = class SuppliersService {
    constructor(supplierRepo, folderRepo, supplierProductRepo, orderRepo, orderItemRepo, orderDocumentRepo, orderItemReceptionRepo, cancelledItemRepo, supplierDocumentRepo, supplierLocationsRepo, connection, stockHttpService, httpService, configService, notificationsClient) {
        this.supplierRepo = supplierRepo;
        this.folderRepo = folderRepo;
        this.supplierProductRepo = supplierProductRepo;
        this.orderRepo = orderRepo;
        this.orderItemRepo = orderItemRepo;
        this.orderDocumentRepo = orderDocumentRepo;
        this.orderItemReceptionRepo = orderItemReceptionRepo;
        this.cancelledItemRepo = cancelledItemRepo;
        this.supplierDocumentRepo = supplierDocumentRepo;
        this.supplierLocationsRepo = supplierLocationsRepo;
        this.connection = connection;
        this.stockHttpService = stockHttpService;
        this.httpService = httpService;
        this.configService = configService;
        this.notificationsClient = notificationsClient;
        this.logger = new common_1.Logger(SuppliersService_1.name);
        this.locationsServiceUrl = this.configService.get('API_GATEWAY_URL') || 'http://localhost:3002';
    }
    async sendSupplierNotification(type, title, description, supplierId, metadata, target_url) {
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
                target_url,
            };
            this.logger.log(`📤 Sending notification data: ${JSON.stringify(notificationData, null, 2)}`);
            await (0, rxjs_1.firstValueFrom)(this.notificationsClient.emit({ cmd: 'suppliers.notification' }, notificationData));
            this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully sent notification for supplier ${supplierId}`);
        }
        catch (error) {
            this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to send supplier notification: ${error?.message || error}`, error?.stack);
        }
    }
    async create(dto, location_id) {
        const existingSupplier = await this.supplierRepo.findOne({
            where: [
                { registration_number: dto.registration_number },
                { vat_number: dto.vat_number },
            ],
        });
        if (existingSupplier) {
            throw new common_1.BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
        }
        const supplier = this.supplierRepo.create(dto);
        const savedSupplier = (await this.supplierRepo.save(supplier));
        await this.createSupplierFolders(savedSupplier);
        if (location_id) {
            try {
                await this.assignSupplierToLocation(savedSupplier.id, location_id);
            }
            catch (error) {
            }
        }
        return savedSupplier;
    }
    async createWithDocuments(dto, location_id) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating supplier with documents: ${JSON.stringify(dto, null, 2)}`);
        const existingSupplier = await this.supplierRepo.findOne({
            where: [
                { registration_number: dto.registration_number },
                { vat_number: dto.vat_number },
            ],
        });
        if (existingSupplier) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Duplicate supplier detected: ${dto.registration_number} or ${dto.vat_number}`);
            throw new common_1.BadRequestException('Furnizor duplicat (registration_number sau vat_number)');
        }
        const supplierData = { ...dto };
        delete supplierData.folderName;
        delete supplierData.documents;
        const supplier = this.supplierRepo.create(supplierData);
        const savedSupplier = (await this.supplierRepo.save(supplier));
        this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier saved with ID: ${savedSupplier.id}`);
        await this.createSupplierFoldersWithCustomName(savedSupplier, dto.folderName, dto.documents, location_id);
        if (location_id) {
            try {
                this.logger.log(`📍 [SUPPLIERS SERVICE] Assigning supplier ${savedSupplier.id} to location ${location_id}`);
                await this.assignSupplierToLocation(savedSupplier.id, location_id);
            }
            catch (error) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Failed to assign supplier ${savedSupplier.id} to location ${location_id}:`, error?.message || error);
            }
        }
        this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new supplier ${savedSupplier.id}`);
        await this.sendSupplierNotification('supplier_created', 'Furnizor nou creat', `A fost creat un nou furnizor: ${savedSupplier.supplier_name}`, savedSupplier.id, { supplierName: savedSupplier.supplier_name }, `/furnizori/${savedSupplier.id}`);
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
        try {
            const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
            const repoRoot = this.getRepoRoot();
            const filesDir = path.join(repoRoot, 'files');
            const suppliersDir = path.join(filesDir, 'suppliers');
            const supplierDir = path.join(suppliersDir, supplierNameSimplified);
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
            this.logger.log(`📁 Created main supplier directory: ${supplierDir}`);
            this.logger.log(`✅ Folder structure created successfully for supplier ${supplier.id}`);
        }
        catch (error) {
            this.logger.error(`❌ Error creating folder structure for supplier ${supplier.id}:`, error);
        }
    }
    async createSupplierFoldersWithCustomName(supplier, customFolderName, documents, locationId) {
        try {
            const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
            const repoRoot = this.getRepoRoot();
            let basePath;
            let supplierDir;
            if (locationId) {
                try {
                    const location = await this.fetchLocation(locationId);
                    if (location) {
                        let companyName = 'UnknownCompany';
                        try {
                            const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
                            const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
                            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                                headers: {
                                    'x-internal-service': 'locations',
                                    'x-service-secret': serviceSecret,
                                    'Content-Type': 'application/json',
                                },
                                timeout: 3000,
                            }));
                            if (response.data && response.data.company_name) {
                                companyName = response.data.company_name;
                            }
                        }
                        catch (error) {
                            this.logger.warn(`⚠️ Could not fetch company name for company ID ${location.company_id}:`, error?.message || error);
                        }
                        const locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
                        basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
                        const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
                        supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
                        this.logger.log(`📍 Using location-specific path for supplier folders: ${basePath}`);
                    }
                    else {
                        this.logger.warn(`⚠️ Location ${locationId} not found, using placeholder location-specific path`);
                        const locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
                        basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
                        const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
                        supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
                    }
                }
                catch (error) {
                    this.logger.warn(`⚠️ Error fetching location details, using placeholder location-specific path:`, error);
                    const locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
                    basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
                    const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
                    supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
                }
            }
            else {
                const filesDir = path.join(repoRoot, 'files');
                const suppliersDir = path.join(filesDir, 'suppliers');
                basePath = `/files/suppliers/${supplierNameSimplified}`;
                supplierDir = path.join(suppliersDir, supplierNameSimplified);
            }
            this.logger.log(`📁 Creating supplier folders with custom name for: ${supplier.supplier_name} (${supplierNameSimplified})`);
            this.logger.log(`📁 Base path: ${basePath}`);
            this.logger.log(`📁 Supplier directory: ${supplierDir}`);
            const dirToCreate = path.dirname(supplierDir);
            if (!fs.existsSync(dirToCreate)) {
                this.logger.log(`📁 Creating parent directory: ${dirToCreate}`);
                fs.mkdirSync(dirToCreate, { recursive: true });
            }
            if (!fs.existsSync(supplierDir)) {
                this.logger.log(`📁 Creating supplier directory: ${supplierDir}`);
                fs.mkdirSync(supplierDir, { recursive: true });
            }
            this.logger.log(`📁 Created main supplier directory: ${supplierDir}`);
            this.logger.log(`✅ Folder structure created successfully for supplier ${supplier.id}`);
            const documentFolderName = customFolderName || 'Folder pentru documente și contracte';
            const folders = [
                { supplier_id: supplier.id, description: documentFolderName, folder_path: `${basePath}/` },
            ];
            const savedFolders = [];
            for (const folderData of folders) {
                this.logger.log(`📁 Creating folder record: ${JSON.stringify(folderData)}`);
                const folder = this.folderRepo.create(folderData);
                const savedFolder = await this.folderRepo.save(folder);
                savedFolders.push(savedFolder);
            }
            if (documents && documents.length > 0 && savedFolders[0]) {
                const documentFolder = savedFolders[0];
                const supplierSubfolders = [
                    'Certificat de Înregistrare furnizor',
                    'Certificat Fiscal furnizor',
                    'Act Constitutiv furnizor',
                    'Contract furnizare / prestări servicii',
                    'Acte adiționale',
                    'Acord GDPR',
                    'Comenzi (PO)',
                    'Confirmări de comandă',
                    'Recepții totale',
                    'Recepții parțiale',
                    'Facturi',
                    'Dovezi de plată',
                    'Procese verbale neconformitate',
                    'Oferte comerciale',
                    'Corespondență',
                    'Alte documente'
                ];
                for (const doc of documents) {
                    try {
                        const fileName = doc.fileName || doc.name;
                        const timestamp = Date.now();
                        const uniqueFileName = `${timestamp}_${fileName}`;
                        const firstSubfolder = supplierSubfolders[0];
                        const filePath = path.join(supplierDir, firstSubfolder, uniqueFileName);
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
                            file_path: `${basePath}/${firstSubfolder}/${uniqueFileName}`,
                            notes: doc.note || doc.notes || '',
                        };
                        const document = this.supplierDocumentRepo.create(documentData);
                        await this.supplierDocumentRepo.save(document);
                    }
                    catch (error) {
                        this.logger.error(`❌ Error creating document: ${error}`);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error(`❌ Error creating folder structure for supplier ${supplier.id}:`, error);
        }
    }
    simplifySupplierName(name) {
        return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50);
    }
    async serveDocument(fileId, forceDownload) {
        const document = await this.supplierDocumentRepo.findOne({ where: { id: fileId } });
        if (!document) {
            this.logger.warn(`Document with ID ${fileId} not found in database`);
            throw new common_1.NotFoundException('Documentul nu a fost găsit');
        }
        this.logger.log(`📄 Serving document ID: ${fileId}, Name: ${document.file_name}, Path: ${document.file_path}`);
        let filePathToUse = document.file_path;
        this.logger.log(`📄 Original file path: ${document.file_path}`);
        if (document.file_path.includes('/suppliers/')) {
            const pathParts = document.file_path.split('/');
            const suppliersIndex = pathParts.indexOf('suppliers');
            if (suppliersIndex !== -1 && pathParts.length > suppliersIndex + 2) {
                const possibleId = pathParts[suppliersIndex + 1];
                if (!isNaN(Number(possibleId))) {
                    const supplierName = pathParts[suppliersIndex + 2];
                    filePathToUse = `/files/suppliers/${supplierName}/${pathParts.slice(suppliersIndex + 3).join('/')}`;
                    this.logger.log(`📄 Converting old path structure to new: ${filePathToUse}`);
                }
            }
        }
        const repoRoot = this.getRepoRoot();
        const filePathRel = (filePathToUse.startsWith('/files') ? filePathToUse : `/files${filePathToUse}`).replace(/^\//, '');
        const absolutePath = path.join(repoRoot, filePathRel);
        this.logger.log(`📄 Absolute file path: ${absolutePath}`);
        if (!fs.existsSync(absolutePath)) {
            this.logger.log(`📁 File not found at specified path, checking subfolders`);
            const dirPath = path.dirname(absolutePath);
            const fileName = path.basename(absolutePath);
            if (fs.existsSync(dirPath)) {
                const subfolders = fs.readdirSync(dirPath).filter(item => fs.statSync(path.join(dirPath, item)).isDirectory());
                for (const subfolder of subfolders) {
                    const possiblePath = path.join(dirPath, subfolder, fileName);
                    if (fs.existsSync(possiblePath)) {
                        const newAbsolutePath = possiblePath;
                        this.logger.log(`📁 File found in subfolder ${subfolder}: ${newAbsolutePath}`);
                        try {
                            const relativePath = newAbsolutePath.replace(repoRoot, '').replace(/\\/g, '/');
                            document.file_path = relativePath.startsWith('/files') ? relativePath : `/files${relativePath}`;
                            await this.supplierDocumentRepo.save(document);
                            this.logger.log(`✅ Updated document file path in database: ${document.file_path}`);
                        }
                        catch (saveError) {
                            this.logger.warn(`⚠️ Failed to update document file path in database:`, saveError);
                        }
                        const stats = fs.statSync(newAbsolutePath);
                        if (stats.isDirectory()) {
                            this.logger.error(`❌ Attempted to read directory as file: ${newAbsolutePath}`);
                            throw new common_1.BadRequestException('EISDIR: illegal operation on a directory, read');
                        }
                        const buffer = fs.readFileSync(newAbsolutePath);
                        const fileExt = document.file_name.split('.').pop()?.toLowerCase() || '';
                        const mimeMap = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
                        const mimeType = mimeMap[fileExt] || 'application/octet-stream';
                        const disposition = forceDownload ? 'attachment' : 'inline';
                        this.logger.log(`✅ Successfully read file: ${document.file_name} (${buffer.length} bytes)`);
                        return { data: buffer.toString('base64'), mimeType, fileName: document.file_name, disposition };
                    }
                }
            }
        }
        if (!fs.existsSync(absolutePath)) {
            this.logger.error(`❌ File not found on disk: ${absolutePath}`);
            this.logger.error(`📄 Database path was: ${document.file_path}`);
            this.logger.error(`📄 Computed path was: ${filePathToUse}`);
            throw new common_1.NotFoundException('Fișierul nu a fost găsit pe disk');
        }
        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) {
            this.logger.error(`❌ Attempted to read directory as file: ${absolutePath}`);
            throw new common_1.BadRequestException('EISDIR: illegal operation on a directory, read');
        }
        const buffer = fs.readFileSync(absolutePath);
        const fileExt = document.file_name.split('.').pop()?.toLowerCase() || '';
        const mimeMap = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
        const mimeType = mimeMap[fileExt] || 'application/octet-stream';
        const disposition = forceDownload ? 'attachment' : 'inline';
        this.logger.log(`✅ Successfully read file: ${document.file_name} (${buffer.length} bytes)`);
        return { data: buffer.toString('base64'), mimeType, fileName: document.file_name, disposition };
    }
    async findAll(locationId) {
        const queryBuilder = this.supplierRepo.createQueryBuilder('supplier')
            .leftJoinAndSelect('supplier.folders', 'folders')
            .leftJoinAndSelect('supplier.products', 'products')
            .leftJoinAndSelect('supplier.orders', 'orders')
            .innerJoin('supplier_locations', 'sl', 'sl.supplier_id = supplier.id')
            .where('sl.id_location = :locationId', { locationId })
            .orderBy('supplier.created_at', 'DESC');
        return await queryBuilder.getMany();
    }
    async findForOrders(locationId) {
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
    async findOne(id, location_id) {
        const qb = this.supplierRepo
            .createQueryBuilder('supplier')
            .leftJoinAndSelect('supplier.folders', 'folders')
            .leftJoinAndSelect('folders.documents', 'documents')
            .leftJoinAndSelect('supplier.products', 'products')
            .leftJoinAndSelect('supplier.orders', 'orders')
            .leftJoinAndSelect('orders.items', 'items')
            .leftJoinAndSelect('orders.documents', 'orders_documents')
            .leftJoinAndSelect('supplier.locations', 'locations')
            .where('supplier.id = :id', { id });
        const supplier = await qb.getOne();
        if (!supplier) {
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        }
        if (location_id !== undefined) {
            const isAssignedToLocation = supplier.locations?.some((loc) => loc.id_location === location_id);
            if (!isAssignedToLocation) {
                throw new common_1.NotFoundException(`Furnizorul cu ID ${id} nu este asignat la locația specificată`);
            }
        }
        const folders = supplier.folders || [];
        this.logger.log(`📂 [findOne] Furnizor ${id}: ${folders.length} foldere returnate`);
        folders.forEach((f, i) => {
            const docs = f.documents || [];
            this.logger.log(`📂 [findOne]   folder[${i}] id=${f.id} description="${f.description}" folder_path="${f.folder_path}" documents=${docs.length}`);
        });
        return supplier;
    }
    async update(id, dto) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Updating supplier ${id} with data: ${JSON.stringify(dto, null, 2)}`);
        const supplier = await this.findOne(id, undefined);
        if (dto.registration_number || dto.vat_number) {
            const existingSupplier = await this.supplierRepo.findOne({
                where: [
                    { registration_number: dto.registration_number },
                    { vat_number: dto.vat_number },
                ],
            });
            if (existingSupplier && existingSupplier.id !== id) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Duplicate supplier detected during update: ${dto.registration_number} or ${dto.vat_number}`);
                throw new common_1.BadRequestException('Furnizor duplicat');
            }
        }
        const oldName = supplier.supplier_name;
        Object.assign(supplier, dto);
        const updatedSupplier = await this.supplierRepo.save(supplier);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier ${id} updated successfully`);
        this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for updated supplier ${updatedSupplier.id}`);
        await this.sendSupplierNotification('supplier_updated', 'Furnizor modificat', `Furnizorul ${oldName} a fost modificat`, updatedSupplier.id, {
            oldName,
            newName: updatedSupplier.supplier_name,
            updatedFields: Object.keys(dto)
        }, `/furnizori/${updatedSupplier.id}`);
        return updatedSupplier;
    }
    async remove(id) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Removing supplier ${id}`);
        const supplier = await this.findOne(id);
        const supplierName = supplier.supplier_name;
        const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
        const repoRoot = this.getRepoRoot();
        const filesDir = path.join(repoRoot, 'files');
        const suppliersDir = path.join(filesDir, 'suppliers');
        const supplierDirNew = path.join(suppliersDir, supplierNameSimplified);
        if (fs.existsSync(supplierDirNew)) {
            try {
                fs.rmSync(supplierDirNew, { recursive: true, force: true });
                this.logger.log(`✅ Deleted supplier files directory (new structure): ${supplierDirNew}`);
            }
            catch (error) {
                this.logger.error(`Failed to delete supplier files directory (new structure): ${supplierDirNew}`, error);
            }
        }
        const supplierDirOld = path.join(suppliersDir, id.toString(), supplierNameSimplified);
        if (fs.existsSync(supplierDirOld)) {
            try {
                fs.rmSync(supplierDirOld, { recursive: true, force: true });
                this.logger.log(`✅ Deleted supplier files directory (old structure): ${supplierDirOld}`);
            }
            catch (error) {
                this.logger.error(`Failed to delete supplier files directory (old structure): ${supplierDirOld}`, error);
            }
        }
        await this.supplierRepo.remove(supplier);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Supplier ${id} removed successfully`);
        this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for deleted supplier ${id}`);
        await this.sendSupplierNotification('supplier_deleted', 'Furnizor sters', `Furnizorul ${supplierName} a fost sters`, id, { supplierName });
    }
    async addProduct(dto) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Adding product to supplier with data: ${JSON.stringify(dto, null, 2)}`);
        const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
        if (!supplier) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for product addition: ${dto.supplier_id}`);
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        }
        const existingProduct = await this.supplierProductRepo.findOne({ where: { supplier_id: dto.supplier_id, product_id: dto.product_id } });
        if (existingProduct) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Product already associated with supplier: ${dto.product_id}`);
            throw new common_1.BadRequestException('Produsul este deja asociat');
        }
        const supplierProduct = this.supplierProductRepo.create(dto);
        const savedProduct = await this.supplierProductRepo.save(supplierProduct);
        this.logger.log(`✅ [SUPPLIERS SERVICE] Product added to supplier successfully with ID: ${savedProduct.id}`);
        this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new product ${savedProduct.id}`);
        await this.sendSupplierNotification('supplier_product_added', 'Produs adaugat furnizor', `A fost adaugat un produs la furnizorul ${supplier.supplier_name}`, supplier.id, {
            productId: savedProduct.id,
            supplierName: supplier.supplier_name,
            productData: dto
        }, `/furnizori/${supplier.id}`);
        return savedProduct;
    }
    async getSupplierProducts(supplierId) {
        return this.supplierProductRepo.find({ where: { supplier_id: supplierId }, order: { created_at: 'DESC' } });
    }
    async createOrder(dto) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Creating order with data: ${JSON.stringify(dto, null, 2)}`);
        const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
        if (!supplier) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order creation: ${dto.supplier_id}`);
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        }
        const orderData = {
            supplier_id: dto.supplier_id,
            order_date: new Date(dto.order_date),
            delivery_date: new Date(dto.delivery_date),
            status: dto.status || supplier_order_entity_1.OrderStatus.DRAFT,
            notes: dto.notes,
            created_by_user_id: dto.created_by_user_id,
            supplier_location_id: dto.supplier_location_id,
            total_amount: 0,
        };
        const order = this.orderRepo.create(orderData);
        const savedOrder = await this.orderRepo.save(order);
        this.logger.log(`📦 [SUPPLIERS SERVICE] Order created with supplier_location_id: ${dto.supplier_location_id}`);
        this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for new order ${savedOrder.id}`);
        await this.sendSupplierNotification('supplier_order_created', 'Comanda furnizor noua', `A fost creata o comanda noua pentru furnizorul ${supplier.supplier_name}`, supplier.id, {
            orderId: savedOrder.id,
            supplierName: supplier.supplier_name,
            orderDate: savedOrder.order_date.toISOString()
        }, `/furnizori/${supplier.id}`);
        let totalAmountWithoutVat = 0;
        let totalAmountWithVat = 0;
        for (const itemDto of dto.items) {
            const subtotal = itemDto.quantity * itemDto.price_per_unit;
            totalAmountWithoutVat += subtotal;
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
            }
            catch (err) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch VAT for product ${itemDto.product_id}:`, err);
            }
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
        return (await this.orderRepo.findOne({ where: { id: savedOrder.id }, relations: ['items', 'documents'] }));
    }
    async generateOrderPDF(order, supplier) {
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
    async markOrderAsDelivered(orderId) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Marking order ${orderId} as delivered`);
        const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items', 'supplier'] });
        if (!order) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order not found: ${orderId}`);
            throw new common_1.NotFoundException('Comanda nu a fost găsită');
        }
        if (order.status === supplier_order_entity_1.OrderStatus.DELIVERED) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order already delivered: ${orderId}`);
            throw new common_1.BadRequestException('Comanda este deja livrată');
        }
        const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
        if (!supplier) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order delivery: ${order.supplier_id}`);
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        }
        const stockItems = order.items?.map(item => ({
            product_id: item.product_id,
            supplier_order_item_id: item.id,
            quantity: item.quantity,
            price: item.price_per_unit,
            entry_date: new Date().toISOString(),
            status: 'valid',
            location_id: order.supplier_location_id || undefined,
        })) || [];
        if (stockItems.length > 0) {
            const createdStockItems = await this.stockHttpService.createStockItems(stockItems);
            if (createdStockItems.length !== stockItems.length) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${createdStockItems.length} out of ${stockItems.length} stock items were created successfully`);
            }
        }
        order.status = supplier_order_entity_1.OrderStatus.DELIVERED;
        await this.orderRepo.update(order.id, {
            status: order.status,
            total_amount: order.total_amount,
            total_amount_with_vat: order.total_amount_with_vat,
            notes: order.notes,
            delivery_date: order.delivery_date,
        });
        const updatedOrder = await this.orderRepo.findOne({ where: { id: order.id } });
        if (!updatedOrder) {
            throw new common_1.NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
        }
        this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for delivered order ${updatedOrder.id}`);
        await this.sendSupplierNotification('supplier_order_delivered', 'Comanda furnizor livrata', `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost livrata`, supplier.id, {
            orderId: updatedOrder.id,
            supplierName: supplier.supplier_name,
            orderDate: updatedOrder.order_date.toISOString()
        }, `/furnizori/${supplier.id}`);
        return updatedOrder;
    }
    async markOrderAsPartiallyReceived(dto) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Processing partial reception for order ${dto.orderId}`);
        const order = await this.orderRepo.findOne({
            where: { id: dto.orderId },
            relations: ['items', 'supplier']
        });
        if (!order) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order not found: ${dto.orderId}`);
            throw new common_1.NotFoundException('Comanda nu a fost găsită');
        }
        if (order.status === supplier_order_entity_1.OrderStatus.DELIVERED) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order already delivered: ${dto.orderId}`);
            throw new common_1.BadRequestException('Comanda este deja livrată complet');
        }
        const supplier = await this.supplierRepo.findOne({ where: { id: order.supplier_id } });
        if (!supplier) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Supplier not found for order delivery: ${order.supplier_id}`);
            throw new common_1.NotFoundException('Furnizorul nu a fost găsit');
        }
        const stockItems = [];
        let hasReturnedItems = false;
        for (const receptionItem of dto.items) {
            const orderItem = order.items?.find(item => item.id === receptionItem.itemId);
            if (!orderItem) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order item not found: ${receptionItem.itemId}`);
                continue;
            }
            const receivedQty = Number(receptionItem.receivedQuantity) || 0;
            const originalQty = Number(orderItem.quantity);
            const isReturnedQuantityExplicit = receptionItem.returnedQuantity !== undefined && receptionItem.returnedQuantity !== null;
            let returnedQty;
            if (isReturnedQuantityExplicit) {
                returnedQty = Number(receptionItem.returnedQuantity) || 0;
            }
            else {
                returnedQty = Math.max(0, originalQty - receivedQty);
            }
            const isCancellingRemaining = receptionItem.returnReason?.includes('Anulat - partea rămasă') ||
                receptionItem.returnReason?.includes('anulat') ||
                receptionItem.returnReason?.includes('Anulat');
            if (!isCancellingRemaining && returnedQty > originalQty) {
                throw new common_1.BadRequestException(`Pentru item-ul ${orderItem.id}: cantitatea returnată (${returnedQty}) depășește cantitatea comandată (${originalQty})`);
            }
            if (isReturnedQuantityExplicit && returnedQty > 0 && !receptionItem.returnReason?.trim()) {
                throw new common_1.BadRequestException(`Pentru item-ul ${orderItem.id}: motivul returnării este obligatoriu când există cantitate returnată`);
            }
            const itemToUpdate = await this.orderItemRepo.findOne({ where: { id: orderItem.id } });
            if (!itemToUpdate) {
                throw new common_1.BadRequestException(`Item-ul ${orderItem.id} nu a fost găsit în baza de date.`);
            }
            const existingReceivedQty = Number(itemToUpdate.received_quantity) || 0;
            const existingReturnedQty = Number(itemToUpdate.returned_quantity) || 0;
            let newlyReceivedQty = receivedQty - existingReceivedQty;
            let newlyReturnedQty = returnedQty - existingReturnedQty;
            if (newlyReceivedQty < 0) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Calculated negative newlyReceivedQty for item ${orderItem.id}: ${newlyReceivedQty}. Setting to 0.`);
                newlyReceivedQty = 0;
            }
            this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${orderItem.id}: existing=${existingReceivedQty}, new total=${receivedQty}, newly received=${newlyReceivedQty}`);
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
                    status: supplier_order_item_reception_entity_1.ReceptionStatus.PENDING,
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
                    status: supplier_order_item_reception_entity_1.ReceptionStatus.PENDING,
                });
                hasReturnedItems = true;
                this.logger.log(`📝 [SUPPLIERS SERVICE] Created PENDING return for item ${orderItem.id} with quantity ${newlyReturnedQty}`);
            }
            if (returnedQty > 0) {
                hasReturnedItems = true;
            }
        }
        this.logger.log(`📝 [SUPPLIERS SERVICE] Recepțiile au fost create cu status PENDING. Stock items vor fi creați după aprobare.`);
        await this.orderRepo.update(order.id, {
            status: order.status,
            total_amount: order.total_amount,
            total_amount_with_vat: order.total_amount_with_vat,
            notes: order.notes,
            delivery_date: order.delivery_date,
        });
        const updatedOrder = await this.orderRepo.findOne({ where: { id: order.id } });
        if (!updatedOrder) {
            throw new common_1.NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
        }
        this.logger.log(`🔔 [SUPPLIERS SERVICE] Sending notification for partially received order ${updatedOrder.id}`);
        await this.sendSupplierNotification('supplier_order_partially_received', 'Comanda furnizor recepționată parțial', `Comanda ${updatedOrder.id} pentru furnizorul ${supplier.supplier_name} a fost recepționată parțial${hasReturnedItems ? ' cu returnări' : ''}`, supplier.id, {
            orderId: updatedOrder.id,
            supplierName: supplier.supplier_name,
            orderDate: updatedOrder.order_date.toISOString(),
            hasReturns: hasReturnedItems
        });
        return updatedOrder;
    }
    async updateOrderStatus(orderId, status) {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Comanda nu a fost găsită');
        const updateData = { status: status };
        if (status === supplier_order_entity_1.OrderStatus.CANCELLED && !order.cancelled_at) {
            updateData.cancelled_at = new Date();
        }
        await this.orderRepo.update(order.id, updateData);
        const updated = await this.orderRepo.findOne({ where: { id: order.id } });
        if (!updated)
            throw new common_1.NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
        return updated;
    }
    async cancelOrderItems(dto) {
        this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling items for order ${dto.orderId}`);
        const order = await this.orderRepo.findOne({
            where: { id: dto.orderId },
            relations: ['items']
        });
        if (!order) {
            throw new common_1.NotFoundException('Comanda nu a fost găsită');
        }
        if (order.status === supplier_order_entity_1.OrderStatus.CANCELLED) {
            throw new common_1.BadRequestException('Comanda este deja anulată');
        }
        if (order.status === supplier_order_entity_1.OrderStatus.DELIVERED) {
            throw new common_1.BadRequestException('Nu se pot anula item-uri pentru o comandă complet livrată');
        }
        if (!order.items || order.items.length === 0) {
            throw new common_1.BadRequestException('Comanda nu are item-uri');
        }
        const pendingReceptions = await this.orderItemReceptionRepo.find({
            where: {
                supplier_order_id: dto.orderId,
                status: supplier_order_item_reception_entity_1.ReceptionStatus.PENDING,
            },
        });
        const pendingByItemId = new Map();
        pendingReceptions.forEach(reception => {
            const existing = pendingByItemId.get(reception.supplier_order_item_id) || { received: 0, returned: 0 };
            pendingByItemId.set(reception.supplier_order_item_id, {
                received: existing.received + Number(reception.received_delta || 0),
                returned: existing.returned + Number(reception.returned_delta || 0),
            });
        });
        const cancelledItems = [];
        for (const cancelItem of dto.items) {
            const orderItem = order.items?.find(item => item.id === cancelItem.itemId);
            if (!orderItem) {
                throw new common_1.BadRequestException(`Item-ul ${cancelItem.itemId} nu a fost găsit în comandă`);
            }
            const orderedQty = Number(orderItem.quantity) || 0;
            const existingReceivedQty = Number(orderItem.received_quantity) || 0;
            const existingReturnedQty = Number(orderItem.returned_quantity) || 0;
            const pending = pendingByItemId.get(orderItem.id) || { received: 0, returned: 0 };
            const totalReceivedQty = existingReceivedQty + pending.received;
            const totalReturnedQty = existingReturnedQty + pending.returned;
            const remainingToReceiveQty = orderedQty - totalReceivedQty;
            if (cancelItem.returnedQuantity > remainingToReceiveQty + 0.01) {
                throw new common_1.BadRequestException(`Pentru item-ul ${orderItem.id}: cantitatea de anulat (${cancelItem.returnedQuantity}) depășește cantitatea rămasă de recepționat (${remainingToReceiveQty})`);
            }
            const existingCancelled = await this.cancelledItemRepo.findOne({
                where: { supplier_order_item_id: orderItem.id }
            });
            if (existingCancelled) {
                const maxAllowed = remainingToReceiveQty + existingCancelled.returned_quantity;
                if (cancelItem.returnedQuantity > maxAllowed + 0.01) {
                    throw new common_1.BadRequestException(`Pentru item-ul ${orderItem.id}: cantitatea totală anulată (${existingCancelled.returned_quantity + cancelItem.returnedQuantity}) depășește cantitatea rămasă de recepționat (${remainingToReceiveQty})`);
                }
                existingCancelled.returned_quantity = Number(existingCancelled.returned_quantity) + cancelItem.returnedQuantity;
                if (cancelItem.returnReason) {
                    existingCancelled.return_reason = cancelItem.returnReason;
                }
                existingCancelled.updated_at = new Date();
                await this.cancelledItemRepo.save(existingCancelled);
                this.logger.log(`✅ [SUPPLIERS SERVICE] Updated cancelled item ${existingCancelled.id} for order item ${orderItem.id}`);
            }
            else {
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
        const updatedOrder = await this.orderRepo.findOne({
            where: { id: dto.orderId },
            relations: ['items', 'supplier'],
        });
        if (!updatedOrder) {
            throw new common_1.NotFoundException('Comanda nu a putut fi reîncărcată după anulare');
        }
        this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully cancelled items for order ${dto.orderId}`);
        return updatedOrder;
    }
    async cancelRemainingQuantity(orderId, reason) {
        this.logger.log(`🚫 [SUPPLIERS SERVICE] Cancelling remaining quantity for order ${orderId}`);
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items']
        });
        if (!order) {
            throw new common_1.NotFoundException('Comanda nu a fost găsită');
        }
        this.logger.log(`📦 [SUPPLIERS SERVICE] Order ${orderId} found with ${order.items?.length || 0} items`);
        if (order.status === supplier_order_entity_1.OrderStatus.CANCELLED) {
            throw new common_1.BadRequestException('Comanda este deja anulată');
        }
        if (order.status === supplier_order_entity_1.OrderStatus.DELIVERED) {
            throw new common_1.BadRequestException('Nu se poate anula partea rămasă pentru o comandă complet livrată');
        }
        if (!order.items || order.items.length === 0) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order ${orderId} has no items`);
            throw new common_1.BadRequestException('Comanda nu are item-uri');
        }
        const pendingReceptions = await this.orderItemReceptionRepo.find({
            where: {
                supplier_order_id: orderId,
                status: supplier_order_item_reception_entity_1.ReceptionStatus.PENDING,
            },
        });
        const pendingByItemId = new Map();
        pendingReceptions.forEach(reception => {
            const existing = pendingByItemId.get(reception.supplier_order_item_id) || { received: 0, returned: 0 };
            pendingByItemId.set(reception.supplier_order_item_id, {
                received: existing.received + Number(reception.received_delta || 0),
                returned: existing.returned + Number(reception.returned_delta || 0),
            });
        });
        const receptionItems = [];
        const cancelItems = [];
        for (const item of order.items || []) {
            const orderedQty = Number(item.quantity) || 0;
            const existingReceivedQty = Number(item.received_quantity) || 0;
            const existingReturnedQty = Number(item.returned_quantity) || 0;
            const pending = pendingByItemId.get(item.id) || { received: 0, returned: 0 };
            const totalReceivedQty = existingReceivedQty + pending.received;
            const totalReturnedQty = existingReturnedQty + pending.returned;
            const remainingToReceiveQty = orderedQty - totalReceivedQty;
            this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: ordered=${orderedQty}, existingReceived=${existingReceivedQty}, pendingReceived=${pending.received}, totalReceived=${totalReceivedQty}, existingReturned=${existingReturnedQty}, pendingReturned=${pending.returned}, totalReturned=${totalReturnedQty}, remainingToReceive=${remainingToReceiveQty}`);
            if (remainingToReceiveQty > 0.01) {
                const newlyReturnedQty = remainingToReceiveQty;
                const newTotalReturnedQty = totalReturnedQty + newlyReturnedQty;
                this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: remainingToReceive=${remainingToReceiveQty}, existingReturned=${totalReturnedQty}, newlyReturnedQty=${newlyReturnedQty}, newTotalReturnedQty=${newTotalReturnedQty}`);
                if (newTotalReturnedQty > orderedQty + 0.01) {
                    this.logger.error(`❌ [SUPPLIERS SERVICE] Item ${item.id}: Returned quantity would exceed ordered: returned(${newTotalReturnedQty}) > ordered(${orderedQty})`);
                }
                else {
                    if (newlyReturnedQty > 0.01) {
                        receptionItems.push({
                            itemId: item.id,
                            receivedQuantity: existingReceivedQty,
                            returnedQuantity: newTotalReturnedQty,
                            returnReason: reason || 'Anulat - partea rămasă de recepționat',
                        });
                        cancelItems.push({
                            itemId: item.id,
                            returnedQuantity: newlyReturnedQty,
                            returnReason: reason || 'Anulat - partea rămasă de recepționat',
                        });
                        this.logger.log(`✅ [SUPPLIERS SERVICE] Item ${item.id}: Added to receptionItems and cancelItems for cancellation`);
                    }
                    else {
                        this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: Skipped - newlyReturnedQty too small (${newlyReturnedQty})`);
                    }
                }
            }
            else {
                this.logger.log(`📦 [SUPPLIERS SERVICE] Item ${item.id}: Skipped - no remaining quantity to receive (remainingToReceiveQty=${remainingToReceiveQty})`);
            }
        }
        this.logger.log(`📦 [SUPPLIERS SERVICE] Total receptionItems: ${receptionItems.length}`);
        if (receptionItems.length === 0) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] No items to cancel for order ${orderId}`);
            throw new common_1.BadRequestException('Nu există cantitate rămasă de anulat pentru această comandă');
        }
        const partialReceptionDto = {
            orderId: order.id,
            items: receptionItems,
        };
        const updatedOrder = await this.markOrderAsPartiallyReceived(partialReceptionDto);
        if (cancelItems.length > 0) {
            try {
                try {
                    const safeReception = JSON.stringify(receptionItems, (_k, v) => (typeof v === 'number' || typeof v === 'string' ? v : v), 2);
                    const safeCancel = JSON.stringify(cancelItems, (_k, v) => (typeof v === 'number' || typeof v === 'string' ? v : v), 2);
                    this.logger.log(`🧪 [DEBUG] receptionItems(${receptionItems.length}): ${safeReception}`);
                    this.logger.log(`🧪 [DEBUG] cancelItems(${cancelItems.length}): ${safeCancel}`);
                }
                catch (e) {
                    this.logger.log(`🧪 [DEBUG] Could not stringify debug payloads: ${e?.message || e}`);
                }
                this.logger.log(`🚫 [SUPPLIERS SERVICE] Creating cancelled items records for order ${orderId}`);
                await this.cancelOrderItems({ orderId: order.id, items: cancelItems });
                this.logger.log(`✅ [SUPPLIERS SERVICE] Cancelled items recorded for order ${orderId}`);
            }
            catch (e) {
                this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to create cancelled items for order ${orderId}: ${e?.message || e}`, e?.stack);
            }
        }
        const allReceptions = await this.orderItemReceptionRepo.find({
            where: { supplier_order_id: orderId },
        });
        const newPendingReceptions = allReceptions.filter(r => r.status === supplier_order_item_reception_entity_1.ReceptionStatus.PENDING &&
            r.returned_delta > 0 &&
            receptionItems.some(item => item.itemId === r.supplier_order_item_id));
        if (newPendingReceptions.length > 0) {
            const receptionIds = newPendingReceptions.map(r => r.id);
            await this.approveReceptions(orderId, receptionIds);
            this.logger.log(`✅ [SUPPLIERS SERVICE] Approved ${receptionIds.length} return receptions automatically`);
        }
        const orderAfterReception = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items'],
        });
        if (!orderAfterReception) {
            throw new common_1.NotFoundException('Comanda nu a putut fi reîncărcată după anulare');
        }
        let allItemsFullyProcessed = true;
        if (orderAfterReception.items && orderAfterReception.items.length > 0) {
            for (const item of orderAfterReception.items) {
                const orderedQty = Number(item.quantity) || 0;
                const receivedQty = Number(item.received_quantity) || 0;
                const returnedQty = Number(item.returned_quantity) || 0;
                if (receivedQty + returnedQty < orderedQty - 0.01) {
                    allItemsFullyProcessed = false;
                    break;
                }
            }
        }
        if (allItemsFullyProcessed && orderAfterReception.status !== supplier_order_entity_1.OrderStatus.CANCELLED) {
            this.logger.log(`🚫 [SUPPLIERS SERVICE] All items fully processed, marking order ${orderId} as cancelled`);
            orderAfterReception.status = supplier_order_entity_1.OrderStatus.CANCELLED;
            orderAfterReception.cancelled_at = new Date();
            await this.orderRepo.save(orderAfterReception);
        }
        const finalOrder = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items', 'supplier'],
        });
        if (!finalOrder) {
            throw new common_1.NotFoundException('Comanda nu a putut fi reîncărcată după actualizare');
        }
        this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully cancelled remaining quantity for order ${orderId}`);
        return finalOrder;
    }
    async approveReceptions(orderId, receptionIds) {
        this.logger.log(`✅ [SUPPLIERS SERVICE] Approving ${receptionIds.length} receptions for order ${orderId}`);
        const receptions = await this.orderItemReceptionRepo.find({
            where: {
                id: (0, typeorm_2.In)(receptionIds),
                supplier_order_id: orderId,
                status: supplier_order_item_reception_entity_1.ReceptionStatus.PENDING,
            },
            relations: [],
        });
        if (receptions.length === 0) {
            throw new common_1.BadRequestException('Nu s-au găsit recepții PENDING pentru aprobare');
        }
        if (receptions.length !== receptionIds.length) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${receptions.length} out of ${receptionIds.length} receptions found with PENDING status`);
        }
        const orderItemIds = Array.from(new Set(receptions.map(r => r.supplier_order_item_id)));
        const orderItems = await this.orderItemRepo.find({
            where: { id: (0, typeorm_2.In)(orderItemIds) },
        });
        const orderItemsMap = new Map(orderItems.map(item => [item.id, item]));
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ['items'],
        });
        if (!order) {
            throw new common_1.NotFoundException(`Comanda ${orderId} nu a fost găsită`);
        }
        const stockItems = [];
        const updatedItemQuantities = new Map();
        const cancelledPayload = [];
        for (const reception of receptions) {
            const orderItem = orderItemsMap.get(reception.supplier_order_item_id);
            if (!orderItem) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Order item ${reception.supplier_order_item_id} not found for reception ${reception.id}`);
                continue;
            }
            reception.status = supplier_order_item_reception_entity_1.ReceptionStatus.APPROVED;
            await this.orderItemReceptionRepo.save(reception);
            if (!updatedItemQuantities.has(reception.supplier_order_item_id)) {
                const existingReceived = Number(orderItem.received_quantity) || 0;
                const existingReturned = Number(orderItem.returned_quantity) || 0;
                updatedItemQuantities.set(reception.supplier_order_item_id, {
                    received: existingReceived,
                    returned: existingReturned,
                });
            }
            const quantities = updatedItemQuantities.get(reception.supplier_order_item_id);
            if (reception.received_delta > 0) {
                quantities.received += Number(reception.received_delta);
                const stockItemDto = {
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
                if (reception.reason && String(reception.reason).toLowerCase().includes('anulat')) {
                    cancelledPayload.push({
                        itemId: reception.supplier_order_item_id,
                        returnedQuantity: Number(reception.returned_delta),
                        returnReason: reception.reason,
                    });
                }
            }
        }
        for (const [itemId, quantities] of updatedItemQuantities.entries()) {
            const orderItem = orderItemsMap.get(itemId);
            if (orderItem) {
                orderItem.received_quantity = quantities.received;
                orderItem.returned_quantity = quantities.returned;
                if (quantities.received > 0) {
                    orderItem.reception_date = new Date();
                    orderItem.reception_user_id = order.created_by_user_id;
                }
                await this.orderItemRepo.save(orderItem);
            }
        }
        let stockCreated = 0;
        if (stockItems.length > 0) {
            this.logger.log(`📦 [SUPPLIERS SERVICE] Creating ${stockItems.length} stock items for approved receptions...`);
            const createdStockItems = await this.stockHttpService.createStockItems(stockItems);
            stockCreated = createdStockItems.length;
            for (let i = 0; i < stockItems.length; i++) {
                const stockItem = createdStockItems[i];
                if (stockItem) {
                    const reception = receptions.find(r => r.supplier_order_item_id === stockItem.supplier_order_item_id &&
                        r.received_delta > 0);
                    if (reception) {
                        reception.stock_item_id = stockItem.id;
                        await this.orderItemReceptionRepo.save(reception);
                    }
                }
            }
            this.logger.log(`✅ [SUPPLIERS SERVICE] Successfully created ${stockCreated} stock items`);
        }
        if (cancelledPayload.length > 0) {
            try {
                this.logger.log(`🚫 [SUPPLIERS SERVICE] Creating cancelled items from approved receptions for order ${orderId}`);
                await this.cancelOrderItems({ orderId, items: cancelledPayload });
                this.logger.log(`✅ [SUPPLIERS SERVICE] Cancelled items created from approved receptions for order ${orderId}`);
            }
            catch (e) {
                this.logger.error(`❌ [SUPPLIERS SERVICE] Failed to create cancelled items from approved receptions for order ${orderId}: ${e?.message || e}`, e?.stack);
            }
        }
        const allReceptions = await this.orderItemReceptionRepo.find({
            where: { supplier_order_id: orderId },
        });
        const hasPendingReceptions = allReceptions.some(r => r.status === supplier_order_item_reception_entity_1.ReceptionStatus.PENDING);
        if (!hasPendingReceptions && order.items) {
            const allItemsFullyReceived = order.items.every(item => {
                const received = Number(item.received_quantity) || 0;
                const original = Number(item.quantity);
                return received >= original;
            });
            if (allItemsFullyReceived) {
                order.status = supplier_order_entity_1.OrderStatus.DELIVERED;
                await this.orderRepo.update(order.id, { status: order.status });
            }
        }
        return {
            approved: receptions.length,
            stockCreated,
        };
    }
    async rejectReceptions(orderId, receptionIds, reason) {
        this.logger.log(`❌ [SUPPLIERS SERVICE] Rejecting ${receptionIds.length} receptions for order ${orderId}`);
        const receptions = await this.orderItemReceptionRepo.find({
            where: {
                id: (0, typeorm_2.In)(receptionIds),
                supplier_order_id: orderId,
                status: supplier_order_item_reception_entity_1.ReceptionStatus.PENDING,
            },
        });
        if (receptions.length === 0) {
            throw new common_1.BadRequestException('Nu s-au găsit recepții PENDING pentru respingere');
        }
        if (receptions.length !== receptionIds.length) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Only ${receptions.length} out of ${receptionIds.length} receptions found with PENDING status`);
        }
        for (const reception of receptions) {
            reception.status = supplier_order_item_reception_entity_1.ReceptionStatus.REJECTED;
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
    async getOrderCancelledItems(orderId) {
        return this.cancelledItemRepo.find({
            where: { order_id: orderId },
            relations: ['orderItem'],
        });
    }
    async getOrderCancelledItemsBatch(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return [];
        }
        return this.cancelledItemRepo.find({
            where: { order_id: (0, typeorm_2.In)(orderIds) },
            relations: ['orderItem'],
        });
    }
    async getOrderReceptions(orderId) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching receptions for order ${orderId}`);
        const receptions = await this.orderItemReceptionRepo.find({
            where: { supplier_order_id: orderId },
            order: { created_at: 'DESC' },
        });
        const userIds = Array.from(new Set(receptions
            .map(r => r.user_id)
            .filter((id) => id !== undefined && id !== null)));
        const usersMap = new Map();
        const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
        const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
        for (const userId of userIds) {
            try {
                const userResult = await this.connection.query(`SELECT id_employee FROM ${authDbName}.users WHERE id = ?`, [userId]);
                if (userResult && userResult.length > 0 && userResult[0].id_employee) {
                    const employeeId = Number(userResult[0].id_employee);
                    const employeeResult = await this.connection.query(`SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`, [employeeId]);
                    if (employeeResult && employeeResult.length > 0) {
                        const firstName = employeeResult[0].first_name || null;
                        const lastName = employeeResult[0].last_name || null;
                        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `User #${userId}`;
                        usersMap.set(userId, fullName);
                        this.logger.log(`✅ [SUPPLIERS SERVICE] Fetched employee name for user ${userId} (employee ${employeeId}): ${fullName}`);
                    }
                    else {
                        usersMap.set(userId, `User #${userId}`);
                    }
                }
                else {
                    usersMap.set(userId, `User #${userId}`);
                }
            }
            catch (error) {
                this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
                usersMap.set(userId, `User #${userId}`);
            }
        }
        return receptions.map(reception => ({
            ...reception,
            user_name: reception.user_id ? usersMap.get(reception.user_id) : undefined,
        }));
    }
    async getOrderReceptionsBatch(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return [];
        }
        const uniqueOrderIds = Array.from(new Set(orderIds));
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching receptions batch for ${uniqueOrderIds.length} orders`);
        const receptions = await this.orderItemReceptionRepo.find({
            where: { supplier_order_id: (0, typeorm_2.In)(uniqueOrderIds) },
            order: { created_at: 'DESC' },
        });
        this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${receptions.length} receptions for ${uniqueOrderIds.length} orders`);
        const userIds = Array.from(new Set(receptions
            .map(r => r.user_id)
            .filter((id) => id !== undefined && id !== null)));
        const usersMap = new Map();
        const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
        const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
        if (userIds.length > 0) {
            try {
                const userIdsPlaceholder = userIds.map(() => '?').join(',');
                const userResult = await this.connection.query(`SELECT id, id_employee FROM ${authDbName}.users WHERE id IN (${userIdsPlaceholder})`, userIds);
                const userToEmployeeMap = new Map();
                if (userResult && userResult.length > 0) {
                    for (const row of userResult) {
                        if (row.id && row.id_employee) {
                            userToEmployeeMap.set(Number(row.id), Number(row.id_employee));
                        }
                    }
                }
                const employeeIds = Array.from(userToEmployeeMap.values());
                if (employeeIds.length > 0) {
                    const employeeIdsPlaceholder = employeeIds.map(() => '?').join(',');
                    const employeeResult = await this.connection.query(`SELECT id, first_name, last_name FROM ${employeesDbName}.employees WHERE id IN (${employeeIdsPlaceholder})`, employeeIds);
                    const employeeToNameMap = new Map();
                    if (employeeResult && employeeResult.length > 0) {
                        for (const row of employeeResult) {
                            const firstName = row.first_name || null;
                            const lastName = row.last_name || null;
                            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || `Employee #${row.id}`;
                            employeeToNameMap.set(Number(row.id), fullName);
                        }
                    }
                    for (const [userId, employeeId] of userToEmployeeMap.entries()) {
                        const fullName = employeeToNameMap.get(employeeId);
                        if (fullName) {
                            usersMap.set(userId, fullName);
                        }
                        else {
                            usersMap.set(userId, `User #${userId}`);
                        }
                    }
                }
                for (const userId of userIds) {
                    if (!usersMap.has(userId)) {
                        usersMap.set(userId, `User #${userId}`);
                    }
                }
            }
            catch (error) {
                this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data batch:`, error.message);
                for (const userId of userIds) {
                    usersMap.set(userId, `User #${userId}`);
                }
            }
        }
        return receptions.map(reception => ({
            ...reception,
            user_name: reception.user_id ? usersMap.get(reception.user_id) : undefined,
        }));
    }
    async getReceptionReport(startDate, endDate) {
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Generating reception report from ${startDate} to ${endDate}`);
        const stockServiceUrl = this.configService.get('STOCK_HTTP_URL') || 'http://localhost:3006';
        const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
        const headers = {
            'x-internal-service': 'suppliers',
            'x-service-secret': serviceSecret
        };
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
                const aggregated = new Map();
                for (const row of eventRows) {
                    const orderId = Number(row.supplier_order_id);
                    const productId = Number(row.product_id);
                    const userId = Number(row.user_id) || 0;
                    const receivedDelta = parseFloat(row.received_delta || '0');
                    const returnedDelta = parseFloat(row.returned_delta || '0');
                    const reason = row.reason;
                    const occurredAt = row.occurred_at;
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
                    const agg = aggregated.get(key);
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
                    if (occurredAt) {
                        const occDate = new Date(occurredAt);
                        if (!agg.reception_date) {
                            agg.reception_date = occurredAt;
                        }
                        else {
                            const existing = new Date(agg.reception_date);
                            if (occDate < existing) {
                                agg.reception_date = occurredAt;
                            }
                        }
                    }
                }
                const orderIds = Array.from(new Set(Array.from(aggregated.values()).map(v => v.supplier_order_id)));
                const orders = orderIds.length > 0
                    ? await this.orderRepo.find({ where: { id: (0, typeorm_2.In)(orderIds) }, relations: ['supplier'] })
                    : [];
                const orderToSupplierName = new Map();
                for (const o of orders) {
                    orderToSupplierName.set(o.id, o.supplier?.supplier_name || `Order #${o.id}`);
                }
                const userIds = Array.from(new Set(Array.from(aggregated.values()).map(v => v.user_id).filter(id => id > 0)));
                const usersMap = new Map();
                const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
                const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
                for (const userId of userIds) {
                    try {
                        const userResult = await this.connection.query(`SELECT id_employee FROM ${authDbName}.users WHERE id = ?`, [userId]);
                        if (userResult && userResult.length > 0 && userResult[0].id_employee) {
                            const employeeId = Number(userResult[0].id_employee);
                            const employeeResult = await this.connection.query(`SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`, [employeeId]);
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
                    }
                    catch (error) {
                        this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
                    }
                }
                const result = Array.from(aggregated.values()).map(item => {
                    const user = usersMap.get(item.user_id);
                    let userName;
                    if (user && user.first_name && user.last_name) {
                        userName = `${user.first_name} ${user.last_name}`.trim();
                    }
                    else if (user && user.employee_id) {
                        userName = `ID: ${user.employee_id}`;
                    }
                    else {
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
        }
        catch (e) {
            this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Failed to read receptions events table, falling back. Reason: ${e?.message || e}`);
        }
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
        let stockItems = [];
        if (receivedItems.length === 0) {
            try {
                const stockResponse = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${stockServiceUrl}/stock/items`, { headers }));
                stockItems = (stockResponse.data || []).filter((item) => {
                    if (!item.supplier_order_item_id)
                        return false;
                    const entryDate = new Date(item.entry_date);
                    const start = new Date(startDate);
                    const end = new Date(`${endDate} 23:59:59`);
                    return entryDate >= start && entryDate <= end;
                });
                this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${stockItems.length} stock items from receptions in period (fallback)`);
            }
            catch (error) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch stock items:`, error?.message);
            }
        }
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
        const aggregatedData = new Map();
        for (const item of receivedItems) {
            const productId = item.product_id;
            const received = parseFloat(item.received_quantity || '0');
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
            const data = aggregatedData.get(key);
            data.total_received += received;
            if (item.reception_date) {
                const itemDate = new Date(item.reception_date);
                if (!data.reception_date) {
                    data.reception_date = item.reception_date;
                }
                else {
                    const existingDate = new Date(data.reception_date);
                    if (itemDate < existingDate) {
                        data.reception_date = item.reception_date;
                    }
                }
            }
        }
        if (stockItems.length > 0) {
            const orderItemIds = stockItems.map((item) => item.supplier_order_item_id).filter(Boolean);
            let orderItemsMap = new Map();
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
            for (const stockItem of stockItems) {
                const productId = stockItem.product_id;
                const received = parseFloat(stockItem.quantity || '0');
                const orderItemId = stockItem.supplier_order_item_id;
                let userId = null;
                if (orderItemId) {
                    const orderItem = orderItemsMap.get(orderItemId);
                    if (orderItem?.reception_user_id) {
                        userId = orderItem.reception_user_id;
                    }
                    else if (orderItem?.order?.created_by_user_id) {
                        userId = orderItem.order.created_by_user_id;
                    }
                }
                const key = `${productId}:${userId || 0}`;
                if (!aggregatedData.has(key)) {
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
                const data = aggregatedData.get(key);
                data.total_received += received;
                if (stockItem.entry_date) {
                    const entryDate = new Date(stockItem.entry_date);
                    if (!data.reception_date) {
                        data.reception_date = stockItem.entry_date;
                    }
                    else {
                        const existingDate = new Date(data.reception_date);
                        if (entryDate < existingDate) {
                            data.reception_date = stockItem.entry_date;
                        }
                    }
                }
            }
        }
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
        const orderItemIdsWithoutDate = itemsWithoutReceptionDate.map((item) => item.item_id).filter(Boolean);
        if (orderItemIdsWithoutDate.length > 0) {
            try {
                const stockResponse = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${stockServiceUrl}/stock/items`, { headers }));
                const allStockItems = stockResponse.data || [];
                const additionalStockItems = allStockItems.filter((item) => {
                    return orderItemIdsWithoutDate.includes(item.supplier_order_item_id);
                });
                stockItems = [...stockItems, ...additionalStockItems];
                this.logger.log(`📦 [SUPPLIERS SERVICE] Found ${additionalStockItems.length} additional stock items for items without reception_date`);
            }
            catch (error) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch stock items for filtering:`, error?.message);
            }
        }
        const stockItemsByOrderItemId = new Map();
        for (const stockItem of stockItems) {
            const orderItemId = stockItem.supplier_order_item_id;
            if (orderItemId) {
                if (!stockItemsByOrderItemId.has(orderItemId)) {
                    stockItemsByOrderItemId.set(orderItemId, []);
                }
                stockItemsByOrderItemId.get(orderItemId).push(stockItem);
            }
        }
        for (const item of itemsWithoutReceptionDate) {
            const productId = item.product_id;
            const received = parseFloat(item.received_quantity || '0');
            const orderItemId = item.item_id;
            const relatedStockItems = stockItemsByOrderItemId.get(orderItemId) || [];
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
                if (!hasStockInPeriod) {
                    continue;
                }
            }
            else {
                const itemUpdated = item.updated_at ? new Date(item.updated_at) : null;
                if (itemUpdated) {
                    const start = new Date(startDate);
                    const end = new Date(`${endDate} 23:59:59`);
                    if (itemUpdated < start || itemUpdated > end) {
                        continue;
                    }
                }
            }
            const userId = item.reception_user_id || item.order_user_id || 0;
            const key = `${productId}:${userId}`;
            let receptionDate;
            if (relatedStockItems.length > 0) {
                const dates = relatedStockItems
                    .map(si => new Date(si.entry_date))
                    .filter(d => !isNaN(d.getTime()))
                    .sort((a, b) => a.getTime() - b.getTime());
                if (dates.length > 0) {
                    receptionDate = relatedStockItems.find(si => new Date(si.entry_date).getTime() === dates[0].getTime())?.entry_date;
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
            const data = aggregatedData.get(key);
            data.total_received += received;
            if (receptionDate) {
                const itemDate = new Date(receptionDate);
                if (!data.reception_date) {
                    data.reception_date = receptionDate;
                }
                else {
                    const existingDate = new Date(data.reception_date);
                    if (itemDate < existingDate) {
                        data.reception_date = receptionDate;
                    }
                }
            }
        }
        const returnItemIds = returnItems.map((item) => item.item_id).filter(Boolean);
        let returnOrderItemsMap = new Map();
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
                aggregatedData.set(key, {
                    product_id: productId,
                    user_id: userId,
                    total_received: 0,
                    total_returned: 0,
                    return_count: 0,
                    return_reasons: [],
                    reception_date: undefined
                });
            }
            const data = aggregatedData.get(key);
            data.total_returned += returned;
            if (returned > 0) {
                data.return_count++;
                if (item.return_reason) {
                    data.return_reasons.push(item.return_reason);
                }
            }
        }
        const reportData = [];
        const userIds = [...new Set(Array.from(aggregatedData.values()).map(d => d.user_id).filter(id => id > 0))];
        const usersMap = new Map();
        const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
        const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
        this.logger.log(`🔍 [SUPPLIERS SERVICE] Fetching employee data for ${userIds.length} users via users -> employees`);
        for (const userId of userIds) {
            try {
                const userResult = await this.connection.query(`SELECT id_employee FROM ${authDbName}.users WHERE id = ?`, [userId]);
                if (userResult && userResult.length > 0 && userResult[0].id_employee) {
                    const employeeId = Number(userResult[0].id_employee);
                    const employeeResult = await this.connection.query(`SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`, [employeeId]);
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
                    }
                    else {
                        this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Employee ${employeeId} not found in employees table for user ${userId}`);
                    }
                }
                else {
                    this.logger.warn(`⚠️ [SUPPLIERS SERVICE] User ${userId} not found in users table or has no id_employee`);
                }
            }
            catch (error) {
                this.logger.error(`❌ [SUPPLIERS SERVICE] Error fetching employee data for user ${userId}:`, error.message);
            }
        }
        this.logger.log(`📊 [SUPPLIERS SERVICE] Loaded ${usersMap.size} users out of ${userIds.length} requested`);
        for (const [key, data] of aggregatedData.entries()) {
            try {
                const productId = data.product_id;
                const productResponse = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${stockServiceUrl}/stock/products/${productId}`, { headers }));
                const product = productResponse.data;
                const user = usersMap.get(data.user_id);
                let userName;
                if (user && user.first_name && user.last_name) {
                    userName = `${user.first_name} ${user.last_name}`.trim();
                }
                else if (user && user.employee_id) {
                    userName = `ID: ${user.employee_id}`;
                }
                else {
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
                    return_reasons: [...new Set(data.return_reasons)],
                    reception_date: data.reception_date || null
                });
            }
            catch (error) {
                this.logger.warn(`⚠️ [SUPPLIERS SERVICE] Could not fetch product ${data.product_id}:`, error?.message);
                const user = usersMap.get(data.user_id);
                let userName;
                if (user && user.first_name && user.last_name) {
                    userName = `${user.first_name} ${user.last_name}`.trim();
                }
                else if (user && user.employee_id) {
                    userName = `ID: ${user.employee_id}`;
                }
                else {
                    userName = data.user_id > 0 ? `User ID: ${data.user_id}` : 'Necunoscut';
                }
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
        reportData.sort((a, b) => {
            if (a.product_name !== b.product_name) {
                return a.product_name.localeCompare(b.product_name);
            }
            return a.user_name.localeCompare(b.user_name);
        });
        return reportData;
    }
    async getReceptionEvents(startDate, endDate, orderId, orderItemId, productId, userId) {
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
        const userIds = Array.from(new Set(rows.map((r) => Number(r.user_id)).filter((id) => !!id && id > 0)));
        const usersMap = new Map();
        const orderItemIds = Array.from(new Set(rows.map((r) => Number(r.supplier_order_item_id)).filter((id) => !!id && id > 0)));
        const orderIds = Array.from(new Set(rows.map((r) => Number(r.supplier_order_id)).filter((id) => !!id && id > 0)));
        const orderItemToOriginalQty = new Map();
        const orderToSupplierName = new Map();
        if (userIds.length > 0) {
            const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
            const headers = { 'x-internal-service': 'suppliers', 'x-service-secret': serviceSecret };
            let employeesServiceUrl = this.configService.get('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
            if (employeesServiceUrl.includes('bitap.ro') || employeesServiceUrl.includes('89.46.6.45')) {
                const portMatch = employeesServiceUrl.match(/:(\d+)/);
                const port = portMatch ? portMatch[1] : '3012';
                employeesServiceUrl = `http://localhost:${port}`;
            }
            for (const uid of userIds) {
                try {
                    const resp = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${employeesServiceUrl}/employees/${uid}`, { headers }));
                    const data = resp?.data?.data || resp?.data || resp;
                    if (data)
                        usersMap.set(uid, data);
                }
                catch {
                }
            }
        }
        if (orderItemIds.length > 0) {
            const items = await this.orderItemRepo.find({ where: { id: (0, typeorm_2.In)(orderItemIds) } });
            for (const it of items) {
                orderItemToOriginalQty.set(it.id, Number(it.quantity) || 0);
            }
        }
        if (orderIds.length > 0) {
            const orders = await this.orderRepo.find({ where: { id: (0, typeorm_2.In)(orderIds) }, relations: ['supplier'] });
            for (const o of orders) {
                orderToSupplierName.set(o.id, o.supplier?.supplier_name || `Order #${o.id}`);
            }
        }
        const runningMap = new Map();
        return rows.map((r) => {
            const uid = r.user_id !== null ? Number(r.user_id) : null;
            let userName = undefined;
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
    async getSupplierOrders(supplierId, locationId) {
        const whereClause = { supplier_id: supplierId };
        if (locationId !== undefined) {
            whereClause.supplier_location_id = locationId;
            console.log('🔍 [SuppliersService] Filtrăm orders după supplier_location_id:', locationId);
        }
        return this.orderRepo.find({ where: whereClause, relations: ['items', 'documents'], order: { created_at: 'DESC' } });
    }
    async getSupplierOrdersBatch(supplierIds, options) {
        if (!supplierIds || supplierIds.length === 0) {
            return [];
        }
        const qb = this.orderRepo
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.items', 'items')
            .leftJoinAndSelect('order.documents', 'documents')
            .where('order.supplier_id IN (:...supplierIds)', { supplierIds })
            .orderBy('order.created_at', 'DESC');
        if (options?.locationId !== undefined) {
            qb.andWhere('order.supplier_location_id = :locationId', {
                locationId: options.locationId,
            });
        }
        if (options?.dateFrom && options?.dateTo) {
            qb.andWhere('order.order_date BETWEEN :dateFrom AND :dateTo', {
                dateFrom: options.dateFrom,
                dateTo: options.dateTo,
            });
        }
        return qb.getMany();
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
        try {
            console.log(`📥 [addDocument] Starting document upload for supplier ${supplierId}`);
            console.log(`📄 [addDocument] Document data:`, {
                fileName: documentData.fileName,
                folderId: documentData.folderId,
                folderName: documentData.folderName,
                hasContent: !!(documentData.content || documentData.file_content),
                notes: documentData.notes,
                expire_date: documentData.expire_date
            });
            const supplier = await this.findOne(supplierId);
            console.log(`✅ [addDocument] Found supplier: ${supplier.supplier_name} (ID: ${supplier.id})`);
            const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
            console.log(`📝 [addDocument] Simplified supplier name: ${supplierNameSimplified}`);
            let locationPath = null;
            let isBoundToLocation = false;
            try {
                console.log(`🔍 [addDocument] Checking if supplier ${supplierId} is bound to any locations`);
                const supplierLocations = await this.supplierLocationsRepo.find({
                    where: { supplier_id: supplierId }
                });
                console.log(`📍 [addDocument] Found supplier locations:`, supplierLocations);
                if (supplierLocations && supplierLocations.length > 0) {
                    console.log(`📍 [addDocument] Supplier is bound to ${supplierLocations.length} locations`);
                    const locationId = supplierLocations[0].id_location;
                    console.log(`📍 [addDocument] Checking details for location ID: ${locationId}`);
                    try {
                        const location = await this.fetchLocation(locationId);
                        console.log(`📍 [addDocument] Location details:`, location);
                        if (location) {
                            console.log(`📍 [addDocument] Location data is valid`);
                            let companyName = 'UnknownCompany';
                            try {
                                const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
                                const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
                                console.log(`🏢 [addDocument] Fetching company details from: ${companiesUrl}/companies/${location.company_id}`);
                                const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                                    headers: {
                                        'x-internal-service': 'locations',
                                        'x-service-secret': serviceSecret,
                                        'Content-Type': 'application/json',
                                    },
                                    timeout: 3000,
                                }));
                                if (response.data && response.data.company_name) {
                                    companyName = response.data.company_name;
                                    console.log(`🏢 [addDocument] Company name: ${companyName}`);
                                }
                                else {
                                    console.log(`🏢 [addDocument] Company response data:`, response.data);
                                }
                            }
                            catch (error) {
                                console.warn(`⚠️ [addDocument] Could not fetch company name for company ID ${location.company_id}:`, error?.message || error);
                            }
                            locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
                            isBoundToLocation = true;
                            console.log(`📍 [addDocument] Location-specific path constructed: ${locationPath}`);
                        }
                        else {
                            console.log(`⚠️ [addDocument] Location details not found for location ID: ${locationId}`);
                            locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
                            isBoundToLocation = true;
                            console.log(`📍 [addDocument] Using placeholder location-specific path: ${locationPath}`);
                        }
                    }
                    catch (locationError) {
                        console.error(`❌ [addDocument] Error fetching location details for location ID ${locationId}:`, locationError);
                        locationPath = `/files/companies/UnknownCompany/Locații/UnknownLocation`;
                        isBoundToLocation = true;
                        console.log(`📍 [addDocument] Using placeholder location-specific path due to error: ${locationPath}`);
                    }
                }
                else {
                    console.log(`ℹ️ [addDocument] Supplier ${supplierId} is not bound to any locations`);
                }
            }
            catch (error) {
                console.warn(`⚠️ [addDocument] Error checking supplier location binding:`, error);
            }
            console.log(`📍 [addDocument] Final location binding status - isBoundToLocation: ${isBoundToLocation}, locationPath: ${locationPath}`);
            let folder = null;
            if (documentData.folderId) {
                folder = await this.folderRepo.findOne({ where: { id: documentData.folderId, supplier_id: supplierId } });
                if (folder)
                    console.log(`✅ [addDocument] Found folder by ID: ${folder.description} (ID: ${folder.id})`);
            }
            if (!folder) {
                const folderName = documentData.folderName
                    || (documentData.notes?.match(/\|folder:([^|]+)\|/)?.[1]?.trim())
                    || 'Alte documente';
                folder = await this.folderRepo.findOne({ where: { supplier_id: supplierId, description: folderName } });
                if (folder) {
                    console.log(`✅ [addDocument] Found folder by name: ${folder.description} (ID: ${folder.id})`);
                }
                else {
                    const basePath = isBoundToLocation && locationPath
                        ? `${locationPath}/Furnizori/${supplierNameSimplified}`
                        : `/files/suppliers/${supplierNameSimplified}`;
                    const folderPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
                    const newFolder = this.folderRepo.create({
                        supplier_id: supplierId,
                        description: folderName,
                        folder_path: folderPath,
                    });
                    folder = await this.folderRepo.save(newFolder);
                    console.log(`✅ [addDocument] Created folder on server: ${folder.description} (ID: ${folder.id}), path: ${folderPath}`);
                    const repoRoot = this.getRepoRoot();
                    const basePathRel = basePath.startsWith('/') ? basePath.slice(1) : basePath;
                    const absoluteDir = path.join(repoRoot, basePathRel, folderName);
                    if (!fs.existsSync(absoluteDir)) {
                        fs.mkdirSync(absoluteDir, { recursive: true });
                        console.log(`📁 [addDocument] Created directory on disk: ${absoluteDir}`);
                    }
                }
            }
            if (!folder) {
                console.error(`❌ [addDocument] Could not resolve or create folder for supplier ${supplierId}`);
                throw new common_1.NotFoundException('Folderul nu a putut fi găsit sau creat.');
            }
            console.log(`✅ [addDocument] Using folder: ${folder.description} (ID: ${folder.id})`);
            if (isBoundToLocation && locationPath) {
                const repoRoot = this.getRepoRoot();
                const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
                const absoluteLocationPath = path.join(repoRoot, locationPathRel);
                console.log(`📁 [addDocument] Absolute location path: ${absoluteLocationPath}`);
                if (fs.existsSync(absoluteLocationPath)) {
                    console.log(`✅ [addDocument] Location directory exists`);
                }
                else {
                    console.log(`⚠️ [addDocument] Location directory does not exist, will be created during file save`);
                }
            }
            const base64 = documentData.content || documentData.file_content;
            if (base64) {
                console.log(`💾 [addDocument] Processing file content for: ${documentData.fileName}`);
                const repoRoot = this.getRepoRoot();
                console.log(`📁 [addDocument] Repository root: ${repoRoot}`);
                let folderPathToUse = folder.folder_path;
                console.log(`📁 [addDocument] Original folder path: ${folderPathToUse}`);
                if (isBoundToLocation && locationPath) {
                    folderPathToUse = `${locationPath}/Furnizori/${supplierNameSimplified}`;
                    console.log(`📍 [addDocument] Using location-specific folder path: ${folderPathToUse}`);
                }
                else {
                    if (folder.folder_path.includes(`/suppliers/${supplierId}/`)) {
                        folderPathToUse = `/files/suppliers/${supplierNameSimplified}/${folder.folder_path.split('/').slice(4).join('/')}`;
                        console.log(`🔄 [addDocument] Converted old path structure to new: ${folderPathToUse}`);
                    }
                    else if (folder.folder_path.startsWith(`/files/suppliers/`) && !folder.folder_path.includes(`/${supplierId}/`)) {
                        folderPathToUse = folder.folder_path;
                        console.log(`✅ [addDocument] Using existing new folder path structure: ${folderPathToUse}`);
                    }
                }
                let subfolderPath = folderPathToUse;
                if (documentData.notes) {
                    const folderMatch = documentData.notes.match(/\|folder:([^|]+)\|/);
                    if (folderMatch && folderMatch[1]) {
                        const designatedFolder = folderMatch[1];
                        subfolderPath = path.join(folderPathToUse, designatedFolder);
                        console.log(`📂 [addDocument] Using designated subfolder: ${designatedFolder}`);
                    }
                }
                console.log(`📁 [addDocument] Final subfolder path: ${subfolderPath}`);
                const subfolderPathRel = subfolderPath.startsWith('/') ? subfolderPath.slice(1) : subfolderPath;
                const absoluteDir = path.join(repoRoot, subfolderPathRel);
                const absolutePath = path.join(absoluteDir, documentData.fileName);
                console.log(`📁 [addDocument] Absolute directory: ${absoluteDir}`);
                console.log(`📄 [addDocument] Absolute file path: ${absolutePath}`);
                try {
                    console.log(`🔍 [addDocument] Checking if directory exists: ${absoluteDir}`);
                    if (!fs.existsSync(absoluteDir)) {
                        console.log(`FontAwesomeIcon [addDocument] Directory does not exist, creating: ${absoluteDir}`);
                        fs.mkdirSync(absoluteDir, { recursive: true });
                        console.log(`✅ [addDocument] Directory created successfully`);
                    }
                    else {
                        console.log(`✅ [addDocument] Directory already exists`);
                    }
                }
                catch (dirError) {
                    console.error(`❌ [addDocument] Failed to create directory ${absoluteDir}:`, dirError);
                    throw new Error(`Failed to create directory: ${dirError.message || dirError}`);
                }
                if (isBoundToLocation && locationPath) {
                    const locationPathRel = locationPath.startsWith('/') ? locationPath.slice(1) : locationPath;
                    const supplierDir = path.join(repoRoot, locationPathRel, 'Furnizori', supplierNameSimplified);
                    console.log(`📍 [addDocument] Checking location-specific supplier directory: ${supplierDir}`);
                    try {
                        if (!fs.existsSync(supplierDir)) {
                            console.log(`📁 [addDocument] Creating location-specific supplier directory`);
                            fs.mkdirSync(supplierDir, { recursive: true });
                            console.log(`✅ [addDocument] Created location-specific supplier directory: ${supplierDir}`);
                        }
                        else {
                            console.log(`✅ [addDocument] Location-specific supplier directory already exists`);
                        }
                        const supplierSubfolders = [
                            'Certificat de Înregistrare furnizor',
                            'Certificat Fiscal furnizor',
                            'Act Constitutiv furnizor',
                            'Contract furnizare / prestări servicii',
                            'Acte adiționale',
                            'Acord GDPR',
                            'Comenzi (PO)',
                            'Confirmări de comandă',
                            'Recepții totale',
                            'Recepții parțiale',
                            'Facturi',
                            'Dovezi de plată',
                            'Procese verbale neconformitate',
                            'Oferte comerciale',
                            'Corespondență',
                            'Alte documente'
                        ];
                        console.log(`📂 [addDocument] Ensuring supplier subfolders exist in location structure`);
                        const designatedFolder = documentData.notes?.match(/\|folder:([^|]+)\|/)?.[1] || 'Alte documente';
                        const subfolderToCreate = supplierSubfolders.find(folder => folder === designatedFolder) || 'Alte documente';
                        const subfolderPath = path.join(supplierDir, subfolderToCreate);
                        console.log(`🔍 [addDocument] Checking specific subfolder: ${subfolderPath}`);
                        if (!fs.existsSync(subfolderPath)) {
                            console.log(`📁 [addDocument] Creating subfolder: ${subfolderToCreate}`);
                            fs.mkdirSync(subfolderPath, { recursive: true });
                            console.log(`✅ [addDocument] Created subfolder: ${subfolderPath}`);
                        }
                        else {
                            console.log(`✅ [addDocument] Subfolder already exists: ${subfolderToCreate}`);
                        }
                    }
                    catch (error) {
                        console.error(`❌ [addDocument] Error creating location-specific supplier folder structure:`, error?.message || error);
                        throw new Error(`Failed to create location-specific supplier folder structure: ${error?.message || error}`);
                    }
                }
                try {
                    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
                    console.log(`💾 [addDocument] Writing file with ${base64Data.length} base64 characters`);
                    const buffer = Buffer.from(base64Data, 'base64');
                    fs.writeFileSync(absolutePath, buffer);
                    console.log(`✅ [addDocument] File written successfully to: ${absolutePath} (${buffer.length} bytes)`);
                }
                catch (fileError) {
                    console.error(`❌ [addDocument] Failed to write file ${absolutePath}:`, fileError);
                    throw new Error(`Failed to write file: ${fileError.message || fileError}`);
                }
            }
            else {
                console.log(`⚠️ [addDocument] No file content provided, skipping file save`);
            }
            let filePathToUse = folder.folder_path;
            console.log(`📄 [addDocument] Determining file path for database record. Original: ${filePathToUse}`);
            if (isBoundToLocation && locationPath) {
                filePathToUse = `${locationPath}/Furnizori/${supplierNameSimplified}`;
                console.log(`📍 [addDocument] Using location-specific path for database: ${filePathToUse}`);
            }
            else {
                if (folder.folder_path.includes(`/suppliers/${supplierId}/`)) {
                    filePathToUse = `/files/suppliers/${supplierNameSimplified}/${folder.folder_path.split('/').slice(4).join('/')}`;
                    console.log(`🔄 [addDocument] Converted old path structure for database: ${filePathToUse}`);
                }
                else if (folder.folder_path.startsWith(`/files/suppliers/`) && !folder.folder_path.includes(`/${supplierId}/`)) {
                    filePathToUse = folder.folder_path;
                    console.log(`✅ [addDocument] Using existing new path structure for database: ${filePathToUse}`);
                }
            }
            let subfolderForDb = '';
            if (documentData.notes) {
                const folderMatch = documentData.notes.match(/\|folder:([^|]+)\|/);
                if (folderMatch && folderMatch[1]) {
                    subfolderForDb = folderMatch[1];
                }
            }
            if (!subfolderForDb) {
                subfolderForDb = 'Alte documente';
            }
            const document = this.supplierDocumentRepo.create({
                folder_id: folder.id,
                document_type: supplier_document_entity_1.DocumentType.OTHER,
                file_name: documentData.fileName,
                file_path: `${filePathToUse}/${subfolderForDb}/${documentData.fileName}`,
                expire_date: documentData.expire_date ? new Date(documentData.expire_date) : null,
                notes: documentData.notes,
            });
            console.log(`💾 [addDocument] Creating document record in database`);
            const savedDocument = await this.supplierDocumentRepo.save(document);
            console.log(`✅ [addDocument] Document saved to database with ID: ${savedDocument.id}`);
            return savedDocument;
        }
        catch (error) {
            console.error(`❌ [addDocument] Unexpected error during document upload:`, error);
            throw error;
        }
    }
    async syncFolderFromDisk(supplierId, folderId) {
        const folder = await this.folderRepo.findOne({
            where: { id: folderId, supplier_id: supplierId },
            relations: ['documents'],
        });
        if (!folder) {
            throw new common_1.NotFoundException(`Folderul cu ID ${folderId} nu a fost găsit pentru furnizorul ${supplierId}`);
        }
        const repoRoot = this.getRepoRoot();
        const folderPathRel = (folder.folder_path || '').replace(/^\//, '').replace(/\/$/, '');
        const subfolderRel = folderPathRel ? `${folderPathRel}/${folder.description}` : folder.description;
        const absoluteDir = path.join(repoRoot, subfolderRel.split('/').join(path.sep));
        this.logger.log(`📂 [syncFolderFromDisk] Furnizor ${supplierId}, folder ${folderId} (${folder.description})`);
        this.logger.log(`📂 [syncFolderFromDisk] folder_path="${folder.folder_path}" → subfolderRel="${subfolderRel}"`);
        this.logger.log(`📂 [syncFolderFromDisk] absoluteDir="${absoluteDir}" exists=${fs.existsSync(absoluteDir)} repoRoot="${repoRoot}"`);
        const existingNames = new Set((folder.documents || []).map((d) => d.file_name));
        let created = 0;
        if (fs.existsSync(absoluteDir)) {
            const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
            this.logger.log(`📂 [syncFolderFromDisk] Fișiere pe disk: ${entries.filter((e) => e.isFile()).map((e) => e.name).join(', ') || '(niciunul)'}`);
            for (const ent of entries) {
                if (!ent.isFile())
                    continue;
                const fileName = ent.name;
                if (existingNames.has(fileName))
                    continue;
                const filePathForDb = subfolderRel.startsWith('files') ? `/${subfolderRel}/${fileName}` : `/files/${subfolderRel}/${fileName}`;
                const doc = this.supplierDocumentRepo.create({
                    folder_id: folder.id,
                    document_type: supplier_document_entity_1.DocumentType.OTHER,
                    file_name: fileName,
                    file_path: filePathForDb,
                    notes: `|folder:${folder.description}| Sincronizat de pe disk`,
                });
                await this.supplierDocumentRepo.save(doc);
                existingNames.add(fileName);
                created++;
                this.logger.log(`✅ [syncFolderFromDisk] Creat în DB: ${fileName} (folder ${folderId})`);
            }
        }
        else {
            this.logger.warn(`⚠️ [syncFolderFromDisk] Directorul nu există: ${absoluteDir}. Încerc path după locație...`);
            const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
            if (supplier) {
                const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
                const supplierLocations = await this.supplierLocationsRepo.find({ where: { supplier_id: supplierId } });
                for (const sl of supplierLocations || []) {
                    try {
                        const location = await this.fetchLocation(sl.id_location);
                        if (!location)
                            continue;
                        let companyName = 'UnknownCompany';
                        try {
                            const companiesUrl = this.configService.get('COMPANIES_HTTP_URL') || 'http://localhost:3003';
                            const serviceSecret = this.configService.get('SERVICE_SECRET') || 'default-service-secret';
                            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                                headers: { 'x-internal-service': 'locations', 'x-service-secret': serviceSecret, 'Content-Type': 'application/json' },
                                timeout: 3000,
                            }));
                            if (response?.data?.company_name)
                                companyName = response.data.company_name;
                        }
                        catch {
                        }
                        const locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
                        const locationSubfolderRel = `${locationPath.replace(/^\//, '')}/Furnizori/${supplierNameSimplified}/${folder.description}`;
                        const locationAbsoluteDir = path.join(repoRoot, locationSubfolderRel.split('/').join(path.sep));
                        this.logger.log(`📂 [syncFolderFromDisk] Încerc path locație: ${locationAbsoluteDir} exists=${fs.existsSync(locationAbsoluteDir)}`);
                        if (fs.existsSync(locationAbsoluteDir)) {
                            const entries = fs.readdirSync(locationAbsoluteDir, { withFileTypes: true });
                            this.logger.log(`📂 [syncFolderFromDisk] Fișiere pe disk (locație): ${entries.filter((e) => e.isFile()).map((e) => e.name).join(', ') || '(niciunul)'}`);
                            for (const ent of entries) {
                                if (!ent.isFile())
                                    continue;
                                const fileName = ent.name;
                                if (existingNames.has(fileName))
                                    continue;
                                const filePathForDb = `/${locationSubfolderRel}/${fileName}`;
                                const doc = this.supplierDocumentRepo.create({
                                    folder_id: folder.id,
                                    document_type: supplier_document_entity_1.DocumentType.OTHER,
                                    file_name: fileName,
                                    file_path: filePathForDb,
                                    notes: `|folder:${folder.description}| Sincronizat de pe disk`,
                                });
                                await this.supplierDocumentRepo.save(doc);
                                existingNames.add(fileName);
                                created++;
                                this.logger.log(`✅ [syncFolderFromDisk] Creat în DB (locație): ${fileName} (folder ${folderId})`);
                            }
                            break;
                        }
                    }
                    catch (locErr) {
                        this.logger.warn(`⚠️ [syncFolderFromDisk] Eroare path locație: ${locErr?.message || locErr}`);
                    }
                }
            }
        }
        const updatedFolder = await this.folderRepo.findOne({
            where: { id: folderId },
            relations: ['documents'],
        });
        const documents = updatedFolder?.documents ?? [];
        this.logger.log(`✅ [syncFolderFromDisk] Furnizor ${supplierId}, folder ${folderId}: ${documents.length} documente (${created} noi de pe disk)`);
        return { folder: updatedFolder || folder, documents };
    }
    async createFolder(supplierId, body, locationId) {
        const description = (body?.description || '').trim();
        if (!description) {
            throw new common_1.BadRequestException('description este obligatoriu');
        }
        const parentId = body?.parent_id ?? null;
        const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
        if (!supplier) {
            throw new common_1.NotFoundException(`Furnizorul cu ID ${supplierId} nu a fost găsit`);
        }
        const existing = await this.folderRepo.findOne({
            where: { supplier_id: supplierId, description, parent_id: parentId != null ? parentId : (0, typeorm_2.IsNull)() },
        });
        if (existing) {
            this.logger.log(`[createFolder] Folder deja există: ${description} (ID: ${existing.id})`);
            return existing;
        }
        const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
        let basePath;
        const repoRoot = this.getRepoRoot();
        let locationPath = null;
        let isBoundToLocation = false;
        if (locationId) {
            try {
                const location = await this.fetchLocation(locationId);
                if (location) {
                    let companyName = 'UnknownCompany';
                    try {
                        const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
                        const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
                        const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                            headers: { 'x-internal-service': 'locations', 'x-service-secret': serviceSecret, 'Content-Type': 'application/json' },
                            timeout: 3000,
                        }));
                        if (response?.data?.company_name)
                            companyName = response.data.company_name;
                    }
                    catch {
                    }
                    locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
                    isBoundToLocation = true;
                }
            }
            catch {
            }
        }
        if (!isBoundToLocation || !locationPath) {
            const supplierLocations = await this.supplierLocationsRepo.find({ where: { supplier_id: supplierId } });
            if (supplierLocations?.length > 0) {
                try {
                    const location = await this.fetchLocation(supplierLocations[0].id_location);
                    if (location) {
                        let companyName = 'UnknownCompany';
                        try {
                            const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
                            const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
                            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                                headers: { 'x-internal-service': 'locations', 'x-service-secret': serviceSecret, 'Content-Type': 'application/json' },
                                timeout: 3000,
                            }));
                            if (response?.data?.company_name)
                                companyName = response.data.company_name;
                        }
                        catch {
                        }
                        locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
                        isBoundToLocation = true;
                    }
                }
                catch {
                }
            }
        }
        if (isBoundToLocation && locationPath) {
            basePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
        }
        else {
            basePath = `/files/suppliers/${supplierNameSimplified}`;
        }
        let folderPath;
        if (parentId) {
            const parent = await this.folderRepo.findOne({ where: { id: parentId, supplier_id: supplierId } });
            if (!parent) {
                throw new common_1.NotFoundException(`Folderul părinte cu ID ${parentId} nu a fost găsit`);
            }
            const parentPath = (parent.folder_path || '').replace(/\/+$/, '');
            const parentDesc = (parent.description || '').trim();
            folderPath = parentPath ? `${parentPath}/${parentDesc}/` : `${basePath.replace(/\/+$/, '')}/${parentDesc}/`;
        }
        else {
            folderPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
        }
        const folder = this.folderRepo.create({
            supplier_id: supplierId,
            description,
            folder_path: folderPath,
            parent_id: parentId,
        });
        const saved = await this.folderRepo.save(folder);
        const folderPathRel = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath;
        const absoluteDir = path.join(repoRoot, folderPathRel.split('/').join(path.sep), description);
        if (!fs.existsSync(absoluteDir)) {
            fs.mkdirSync(absoluteDir, { recursive: true });
            this.logger.log(`[createFolder] Creat director pe disk: ${absoluteDir}`);
        }
        this.logger.log(`[createFolder] Folder creat: ${description} (ID: ${saved.id}, parent_id: ${parentId ?? 'null'})`);
        return saved;
    }
    async updateFolder(supplierId, folderId, body) {
        const newDescription = (body?.description || '').trim();
        if (!newDescription) {
            throw new common_1.BadRequestException('description este obligatoriu');
        }
        const folder = await this.folderRepo.findOne({ where: { id: folderId, supplier_id: supplierId } });
        if (!folder) {
            throw new common_1.NotFoundException(`Folderul cu ID ${folderId} nu a fost găsit pentru furnizorul ${supplierId}`);
        }
        if (folder.description === newDescription) {
            return folder;
        }
        const parentId = folder.parent_id ?? null;
        const existing = await this.folderRepo.findOne({
            where: { supplier_id: supplierId, description: newDescription, parent_id: parentId != null ? parentId : (0, typeorm_2.IsNull)() },
        });
        if (existing && existing.id !== folderId) {
            throw new common_1.BadRequestException('Există deja un folder cu acest nume.');
        }
        const oldDescription = folder.description;
        folder.description = newDescription;
        const saved = await this.folderRepo.save(folder);
        const repoRoot = this.getRepoRoot();
        const folderPathRel = (folder.folder_path || '').replace(/^\//, '').replace(/\/$/, '');
        const oldDir = path.join(repoRoot, folderPathRel.split('/').join(path.sep), oldDescription);
        const newDir = path.join(repoRoot, folderPathRel.split('/').join(path.sep), newDescription);
        if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
            try {
                fs.renameSync(oldDir, newDir);
                this.logger.log(`[updateFolder] Redenumit director pe disk: ${oldDir} -> ${newDir}`);
            }
            catch (err) {
                this.logger.warn(`[updateFolder] Nu s-a putut redenumi directorul: ${err?.message || err}`);
            }
        }
        else if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
            this.logger.log(`[updateFolder] Creat director pe disk: ${newDir}`);
        }
        this.logger.log(`[updateFolder] Folder actualizat: ${oldDescription} -> ${newDescription} (ID: ${saved.id})`);
        return saved;
    }
    async removeFolder(supplierId, folderId) {
        const folder = await this.folderRepo.findOne({ where: { id: folderId, supplier_id: supplierId } });
        if (!folder) {
            throw new common_1.NotFoundException(`Folderul cu ID ${folderId} nu a fost găsit pentru furnizorul ${supplierId}`);
        }
        await this.folderRepo.remove(folder);
        this.logger.log(`[removeFolder] Șters folder ${folderId} (${folder.description}) pentru furnizor ${supplierId}`);
    }
    async removeDocument(documentId) {
        const document = await this.supplierDocumentRepo.findOne({ where: { id: documentId } });
        if (!document) {
            this.logger.warn(`Document with ID ${documentId} not found in database`);
            throw new common_1.NotFoundException('Documentul nu a fost găsit');
        }
        try {
            const repoRoot = this.getRepoRoot();
            let filePathToUse = document.file_path;
            this.logger.log(`📄 Removing document ID: ${documentId}, Name: ${document.file_name}, Path: ${document.file_path}`);
            if (document.file_path.includes('/suppliers/')) {
                const pathParts = document.file_path.split('/');
                const suppliersIndex = pathParts.indexOf('suppliers');
                if (suppliersIndex !== -1 && pathParts.length > suppliersIndex + 2) {
                    const possibleId = pathParts[suppliersIndex + 1];
                    if (!isNaN(Number(possibleId))) {
                        const supplierName = pathParts[suppliersIndex + 2];
                        filePathToUse = `/files/suppliers/${supplierName}/${pathParts.slice(suppliersIndex + 3).join('/')}`;
                        this.logger.log(`📄 Converting old path structure to new for removal: ${filePathToUse}`);
                    }
                }
            }
            const filePathRel = (filePathToUse.startsWith('/files') ? filePathToUse : `/files${filePathToUse}`).replace(/^\//, '');
            const absolutePath = path.join(repoRoot, filePathRel);
            this.logger.log(`📄 Absolute file path for removal: ${absolutePath}`);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                this.logger.log(`✅ Deleted physical file: ${absolutePath}`);
            }
            else {
                this.logger.warn(`⚠️ Physical file not found for removal: ${absolutePath}`);
            }
        }
        catch (error) {
            this.logger.warn(`⚠️ Failed to delete physical file for document ${documentId}:`, error);
        }
        await this.supplierDocumentRepo.remove(document);
        this.logger.log(`✅ Removed document record from database: ${documentId}`);
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
        const supplier = await this.findOne(supplierId, undefined);
        if (!supplier) {
            throw new common_1.NotFoundException(`Furnizorul cu ID ${supplierId} nu a fost găsit`);
        }
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
        const savedAssignment = await this.supplierLocationsRepo.save(assignment);
        this.updateFolderPathsForLocationBoundSupplier(supplierId, locationId).catch((error) => {
            this.logger.error(`❌ [assignSupplierToLocation] Eroare la actualizarea path-urilor pentru furnizor ${supplierId}:`, error);
        });
        return savedAssignment;
    }
    async updateFolderPathsForLocationBoundSupplier(supplierId, locationId) {
        try {
            this.logger.log(`📍 [updateFolderPathsForLocationBoundSupplier] Updating folder paths for supplier ${supplierId} bound to location ${locationId}`);
            const supplier = await this.findOne(supplierId, undefined);
            const supplierNameSimplified = this.simplifySupplierName(supplier.supplier_name);
            const location = await this.fetchLocation(locationId);
            if (!location) {
                this.logger.warn(`⚠️ [updateFolderPathsForLocationBoundSupplier] Location ${locationId} not found`);
                return;
            }
            let companyName = 'UnknownCompany';
            try {
                const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
                const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
                this.logger.log(`🏢 [updateFolderPathsForLocationBoundSupplier] Fetching company details from: ${companiesUrl}/companies/${location.company_id}`);
                const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${companiesUrl}/companies/${location.company_id}`, {
                    headers: {
                        'x-internal-service': 'locations',
                        'x-service-secret': serviceSecret,
                        'Content-Type': 'application/json',
                    },
                    timeout: 3000,
                }));
                if (response.data && response.data.company_name) {
                    companyName = response.data.company_name;
                    this.logger.log(`🏢 [updateFolderPathsForLocationBoundSupplier] Company name: ${companyName}`);
                }
            }
            catch (error) {
                this.logger.warn(`⚠️ [updateFolderPathsForLocationBoundSupplier] Could not fetch company name for company ID ${location.company_id}:`, error?.message || error);
            }
            const locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
            const newBasePath = `${locationPath}/Furnizori/${supplierNameSimplified}`;
            this.logger.log(`📍 [updateFolderPathsForLocationBoundSupplier] New base path: ${newBasePath}`);
            const folders = await this.folderRepo.find({ where: { supplier_id: supplierId } });
            for (const folder of folders) {
                const oldPath = folder.folder_path;
                folder.folder_path = `${newBasePath}/`;
                this.logger.log(`📁 [updateFolderPathsForLocationBoundSupplier] Updating folder ${folder.id} path from '${oldPath}' to '${folder.folder_path}'`);
                await this.folderRepo.save(folder);
            }
            this.logger.log(`✅ [updateFolderPathsForLocationBoundSupplier] Successfully updated ${folders.length} folder paths for supplier ${supplierId}`);
            const documents = await this.supplierDocumentRepo
                .createQueryBuilder('document')
                .leftJoinAndSelect('document.folder', 'folder')
                .where('folder.supplier_id = :supplierId', { supplierId })
                .getMany();
            this.logger.log(`📄 [updateFolderPathsForLocationBoundSupplier] Found ${documents.length} documents to update`);
            for (const document of documents) {
                const currentPath = document.file_path;
                const pathParts = currentPath.split('/');
                if (pathParts.length >= 2) {
                    const subfolder = pathParts[pathParts.length - 2];
                    const filename = pathParts[pathParts.length - 1];
                    const newDocumentPath = `${newBasePath}/${subfolder}/${filename}`;
                    const oldPath = document.file_path;
                    document.file_path = newDocumentPath;
                    this.logger.log(`📄 [updateFolderPathsForLocationBoundSupplier] Updating document ${document.id} path from '${oldPath}' to '${document.file_path}'`);
                    await this.supplierDocumentRepo.save(document);
                }
            }
            this.logger.log(`✅ [updateFolderPathsForLocationBoundSupplier] Successfully updated ${documents.length} document paths for supplier ${supplierId}`);
        }
        catch (error) {
            this.logger.error(`❌ [updateFolderPathsForLocationBoundSupplier] Error updating folder paths for supplier ${supplierId}:`, error);
        }
    }
    async findSupplierLocations(supplierId) {
        await this.findOne(supplierId, undefined);
        const rows = await this.supplierLocationsRepo.find({
            where: { supplier_id: supplierId },
            relations: ['supplier'],
        });
        return await this.enrichWithLocations(rows);
    }
    async findLocationSuppliers(locationId) {
        const rows = await this.supplierLocationsRepo.find({
            where: { id_location: locationId },
            relations: ['supplier'],
        });
        return await this.enrichWithLocations(rows);
    }
    async fetchLocation(locationId) {
        try {
            this.logger.log(`📍 [fetchLocation] Fetching location ${locationId} from ${this.locationsServiceUrl}/locations/${locationId}`);
            const resp = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.locationsServiceUrl}/locations/${locationId}`, {
                headers: {
                    'x-internal-service': 'suppliers',
                    'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                    'Content-Type': 'application/json',
                },
                timeout: 5000,
            }));
            this.logger.log(`✅ [fetchLocation] Location response received for ${locationId}`);
            return resp.data;
        }
        catch (error) {
            this.logger.warn(`⚠️ [fetchLocation] Nu am putut încărca locația ${locationId}: ${error?.message || error}`);
            return null;
        }
    }
    async enrichWithLocations(rows) {
        const results = await Promise.all(rows.map(async (row) => {
            const location = await this.fetchLocation(row.id_location);
            return { ...row, workLocation: location };
        }));
        return results;
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
    async findExpiringDocuments(targetDate) {
        this.logger.log(`[SUPPLIERS SERVICE] Finding documents expiring on ${targetDate}`);
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
    async findExpiredDocuments() {
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
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = SuppliersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(supplier_entity_1.Supplier)),
    __param(1, (0, typeorm_1.InjectRepository)(supplier_folder_entity_1.SupplierFolder)),
    __param(2, (0, typeorm_1.InjectRepository)(supplier_product_entity_1.SupplierProduct)),
    __param(3, (0, typeorm_1.InjectRepository)(supplier_order_entity_1.SupplierOrder)),
    __param(4, (0, typeorm_1.InjectRepository)(supplier_order_item_entity_1.SupplierOrderItem)),
    __param(5, (0, typeorm_1.InjectRepository)(supplier_order_document_entity_1.SupplierOrderDocument)),
    __param(6, (0, typeorm_1.InjectRepository)(supplier_order_item_reception_entity_1.SupplierOrderItemReception)),
    __param(7, (0, typeorm_1.InjectRepository)(supplier_order_cancelled_item_entity_1.SupplierOrderCancelledItem)),
    __param(8, (0, typeorm_1.InjectRepository)(supplier_document_entity_1.SupplierDocument)),
    __param(9, (0, typeorm_1.InjectRepository)(supplier_locations_entity_1.SupplierLocations)),
    __param(10, (0, typeorm_1.InjectConnection)()),
    __param(14, (0, common_1.Inject)('NOTIFICATIONS_RMQ')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Connection,
        stock_http_service_1.StockHttpService,
        axios_1.HttpService,
        config_1.ConfigService,
        microservices_1.ClientProxy])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map