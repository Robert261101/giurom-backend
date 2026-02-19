import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { CreateSupplierWithDocumentsDto } from "./dto/create-supplier-with-documents.dto";
import { ApproveReceptionDto, RejectReceptionDto } from "./dto/approve-reception.dto";
import { CancelRemainingDto } from "./dto/cancel-remaining.dto";
import { CancelOrderItemsDto } from "./dto/cancel-order-items.dto";
import { Response } from "express";
export declare class SuppliersHttpController {
    private readonly service;
    private readonly logger;
    constructor(service: SuppliersService);
    getSuppliers(_page?: string, _limit?: string, _search?: string, _is_active?: string, location_id?: string, req?: any): Promise<import("./entities/supplier.entity").Supplier[]>;
    getSuppliersForOrders(location_id?: string): Promise<{
        id: number;
        supplier_name: string;
    }[]>;
    create(dto: CreateSupplierDto, req?: any): Promise<import("./entities/supplier.entity").Supplier>;
    createWithDocs(dto: CreateSupplierWithDocumentsDto): Promise<import("./entities/supplier.entity").Supplier>;
    assignSupplierToLocation(supplierId: string, locationId: string): Promise<import("./entities/supplier-locations.entity").SupplierLocations>;
    findSupplierLocations(supplierId: string): Promise<any[]>;
    findLocationSuppliers(locationId: string): Promise<any[]>;
    removeSupplierFromLocation(supplierId: string, locationId: string): Promise<void>;
    findOne(id: string, location_id?: string, req?: any): Promise<import("./entities/supplier.entity").Supplier>;
    update(id: string, dto: any): Promise<import("./entities/supplier.entity").Supplier>;
    remove(id: string): Promise<void>;
    getProducts(supplierId: string): Promise<import("./entities/supplier-product.entity").SupplierProduct[]>;
    addProduct(dto: any): Promise<import("./entities/supplier-product.entity").SupplierProduct>;
    updateProduct(productId: string, dto: any): Promise<import("./entities/supplier-product.entity").SupplierProduct>;
    removeProduct(productId: string): Promise<void>;
    getOrders(supplierId: string, location_id?: string): Promise<import("./entities/supplier-order.entity").SupplierOrder[]>;
    getOrdersBatch(supplierIdsRaw: string, dateFrom?: string, dateTo?: string, location_id?: string): never[] | Promise<import("./entities/supplier-order.entity").SupplierOrder[]>;
    createOrder(dto: any): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    deliver(orderId: string): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    partialReception(dto: any): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    approveReceptions(dto: ApproveReceptionDto): Promise<{
        approved: number;
        stockCreated: number;
    }>;
    rejectReceptions(dto: RejectReceptionDto): Promise<{
        rejected: number;
    }>;
    getReceptionReport(startDate: string, endDate: string): Promise<any[]>;
    getReceptionEvents(startDate: string, endDate: string, orderId?: string, orderItemId?: string, productId?: string, userId?: string): Promise<{
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
    }[]>;
    getOrderReceptionsBatch(orderIdsRaw: string): never[] | Promise<(import("./entities/supplier-order-item-reception.entity").SupplierOrderItemReception & {
        user_name?: string;
    })[]>;
    getOrderReceptions(orderId: string): Promise<(import("./entities/supplier-order-item-reception.entity").SupplierOrderItemReception & {
        user_name?: string;
    })[]>;
    getOrderCancelledItems(orderId: string): Promise<import("./entities/supplier-order-cancelled-item.entity").SupplierOrderCancelledItem[]>;
    getOrderCancelledItemsBatch(orderIdsRaw: string): never[] | Promise<import("./entities/supplier-order-cancelled-item.entity").SupplierOrderCancelledItem[]>;
    updateStatus(orderId: string, body: any): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    cancelRemaining(orderId: string, dto: CancelRemainingDto): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    cancelOrderItems(dto: CancelOrderItemsDto): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    emailLink(supplierId: string, orderId: string): {
        emailLink: string;
    };
    whatsappLink(supplierId: string, orderId: string): {
        whatsappLink: string;
    };
    addDocument(supplierId: string, body: any): Promise<import("./entities/supplier-document.entity").SupplierDocument>;
    createFolder(supplierId: string, body: {
        description: string;
        parent_id?: number;
    }, location_id?: string): Promise<import("./entities/supplier-folder.entity").SupplierFolder>;
    updateFolder(supplierId: string, folderId: string, body: {
        description: string;
    }): Promise<import("./entities/supplier-folder.entity").SupplierFolder>;
    removeFolder(supplierId: string, folderId: string): Promise<void>;
    syncFolderFromDisk(supplierId: string, folderId: string): Promise<{
        folder: import("./entities/supplier-folder.entity").SupplierFolder;
        documents: import("./entities/supplier-document.entity").SupplierDocument[];
    }>;
    removeDocument(documentId: string): Promise<void>;
    getSupplierFile(fileId: number, download: string, res: Response): Promise<Response<any, Record<string, any>>>;
    viewSupplierFile(fileId: number, res: Response): Promise<Response<any, Record<string, any>>>;
    getExpiringDocuments(targetDate: string): Promise<import("./entities/supplier-document.entity").SupplierDocument[]>;
    getExpiredDocuments(): Promise<import("./entities/supplier-document.entity").SupplierDocument[]>;
}
