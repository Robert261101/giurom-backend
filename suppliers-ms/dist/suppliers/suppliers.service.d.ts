import { Repository, Connection } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './entities/supplier-order-document.entity';
import { SupplierOrderItemReception } from './entities/supplier-order-item-reception.entity';
import { SupplierOrderCancelledItem } from './entities/supplier-order-cancelled-item.entity';
import { SupplierDocument } from './entities/supplier-document.entity';
import { SupplierLocations } from './entities/supplier-locations.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { PartialReceptionDto } from './dto/partial-reception.dto';
import { StockHttpService } from './stock-http.service';
export declare class SuppliersService {
    private readonly supplierRepo;
    private readonly folderRepo;
    private readonly supplierProductRepo;
    private readonly orderRepo;
    private readonly orderItemRepo;
    private readonly orderDocumentRepo;
    private readonly orderItemReceptionRepo;
    private readonly cancelledItemRepo;
    private readonly supplierDocumentRepo;
    private readonly supplierLocationsRepo;
    private readonly connection;
    private readonly stockHttpService;
    private readonly httpService;
    private readonly configService;
    private readonly notificationsClient;
    private readonly logger;
    private readonly locationsServiceUrl;
    constructor(supplierRepo: Repository<Supplier>, folderRepo: Repository<SupplierFolder>, supplierProductRepo: Repository<SupplierProduct>, orderRepo: Repository<SupplierOrder>, orderItemRepo: Repository<SupplierOrderItem>, orderDocumentRepo: Repository<SupplierOrderDocument>, orderItemReceptionRepo: Repository<SupplierOrderItemReception>, cancelledItemRepo: Repository<SupplierOrderCancelledItem>, supplierDocumentRepo: Repository<SupplierDocument>, supplierLocationsRepo: Repository<SupplierLocations>, connection: Connection, stockHttpService: StockHttpService, httpService: HttpService, configService: ConfigService, notificationsClient: ClientProxy);
    private sendSupplierNotification;
    create(dto: CreateSupplierDto, location_id?: number): Promise<Supplier>;
    createWithDocuments(dto: CreateSupplierWithDocumentsDto, location_id?: number): Promise<Supplier>;
    private getRepoRoot;
    private createSupplierFolders;
    private createSupplierFoldersWithCustomName;
    private simplifySupplierName;
    serveDocument(fileId: number, forceDownload: boolean): Promise<{
        data: string;
        mimeType: string;
        fileName: string;
        disposition: 'inline' | 'attachment';
    }>;
    findAll(locationId: number): Promise<Supplier[]>;
    findForOrders(locationId?: number): Promise<{
        id: number;
        supplier_name: string;
    }[]>;
    findOne(id: number, location_id?: number): Promise<Supplier>;
    update(id: number, dto: UpdateSupplierDto): Promise<Supplier>;
    remove(id: number): Promise<void>;
    addProduct(dto: CreateSupplierProductDto): Promise<SupplierProduct>;
    getSupplierProducts(supplierId: number): Promise<SupplierProduct[]>;
    createOrder(dto: CreateSupplierOrderDto): Promise<SupplierOrder>;
    private generateOrderPDF;
    markOrderAsDelivered(orderId: number): Promise<SupplierOrder>;
    markOrderAsPartiallyReceived(dto: PartialReceptionDto): Promise<SupplierOrder>;
    updateOrderStatus(orderId: number, status: string): Promise<SupplierOrder>;
    cancelOrderItems(dto: {
        orderId: number;
        items: Array<{
            itemId: number;
            returnedQuantity: number;
            returnReason?: string;
        }>;
    }): Promise<SupplierOrder>;
    cancelRemainingQuantity(orderId: number, reason?: string): Promise<SupplierOrder>;
    approveReceptions(orderId: number, receptionIds: number[]): Promise<{
        approved: number;
        stockCreated: number;
    }>;
    rejectReceptions(orderId: number, receptionIds: number[], reason?: string): Promise<{
        rejected: number;
    }>;
    getOrderCancelledItems(orderId: number): Promise<SupplierOrderCancelledItem[]>;
    getOrderCancelledItemsBatch(orderIds: number[]): Promise<SupplierOrderCancelledItem[]>;
    getOrderReceptions(orderId: number): Promise<Array<SupplierOrderItemReception & {
        user_name?: string;
    }>>;
    getOrderReceptionsBatch(orderIds: number[]): Promise<Array<SupplierOrderItemReception & {
        user_name?: string;
    }>>;
    getReceptionReport(startDate: string, endDate: string): Promise<any[]>;
    getReceptionEvents(startDate: string, endDate: string, orderId?: number, orderItemId?: number, productId?: number, userId?: number): Promise<Array<{
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
    }>>;
    getSupplierOrders(supplierId: number, locationId?: number): Promise<SupplierOrder[]>;
    getSupplierOrdersBatch(supplierIds: number[], options?: {
        dateFrom?: string;
        dateTo?: string;
        locationId?: number;
    }): Promise<SupplierOrder[]>;
    updateSupplierProduct(productId: number, updateData: Partial<SupplierProduct>): Promise<SupplierProduct>;
    removeSupplierProduct(productId: number): Promise<void>;
    addDocument(supplierId: number, documentData: {
        fileName: string;
        folderId?: number;
        folderName?: string;
        notes?: string;
        content?: string;
        file_content?: string;
        expire_date?: string;
    }): Promise<SupplierDocument>;
    syncFolderFromDisk(supplierId: number, folderId: number): Promise<{
        folder: SupplierFolder;
        documents: SupplierDocument[];
    }>;
    createFolder(supplierId: number, body: {
        description: string;
        parent_id?: number;
    }, locationId?: number): Promise<SupplierFolder>;
    updateFolder(supplierId: number, folderId: number, body: {
        description: string;
    }): Promise<SupplierFolder>;
    removeFolder(supplierId: number, folderId: number): Promise<void>;
    removeDocument(documentId: number): Promise<void>;
    generateEmailLink(supplierId: number, orderId: number): string;
    generateWhatsAppLink(supplierId: number, orderId: number, pdfUrl?: string): string;
    assignSupplierToLocation(supplierId: number, locationId: number): Promise<SupplierLocations>;
    private updateFolderPathsForLocationBoundSupplier;
    findSupplierLocations(supplierId: number): Promise<any[]>;
    findLocationSuppliers(locationId: number): Promise<any[]>;
    private fetchLocation;
    private enrichWithLocations;
    removeSupplierFromLocation(supplierId: number, locationId: number): Promise<void>;
    findExpiringDocuments(targetDate: string): Promise<SupplierDocument[]>;
    findExpiredDocuments(): Promise<SupplierDocument[]>;
}
