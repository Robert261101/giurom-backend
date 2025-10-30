import { SuppliersService } from './suppliers/suppliers.service';
import { CreateSupplierDto } from './suppliers/dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './suppliers/dto/create-supplier-with-documents.dto';
import { UpdateSupplierDto } from './suppliers/dto/update-supplier.dto';
import { CreateSupplierProductDto } from './suppliers/dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './suppliers/dto/update-supplier-product.dto';
import { CreateSupplierOrderDto } from './suppliers/dto/create-supplier-order.dto';
export declare class SuppliersMicroController {
    private readonly service;
    constructor(service: SuppliersService);
    create(dto: CreateSupplierDto): Promise<import("./suppliers/entities/supplier.entity").Supplier>;
    createWithDocuments(dto: CreateSupplierWithDocumentsDto): Promise<import("./suppliers/entities/supplier.entity").Supplier>;
    findAll(): Promise<import("./suppliers/entities/supplier.entity").Supplier[]>;
    findOne(id: number): Promise<import("./suppliers/entities/supplier.entity").Supplier>;
    update(payload: {
        id: number;
        dto: UpdateSupplierDto;
    }): Promise<import("./suppliers/entities/supplier.entity").Supplier>;
    remove(id: number): Promise<void>;
    addProduct(dto: CreateSupplierProductDto): Promise<import("./suppliers/entities/supplier-product.entity").SupplierProduct>;
    getSupplierProducts(supplierId: number): Promise<import("./suppliers/entities/supplier-product.entity").SupplierProduct[]>;
    updateSupplierProduct(payload: {
        productId: number;
        dto: UpdateSupplierProductDto;
    }): Promise<import("./suppliers/entities/supplier-product.entity").SupplierProduct>;
    removeSupplierProduct(productId: number): Promise<void>;
    createOrder(dto: CreateSupplierOrderDto): Promise<import("./suppliers/entities/supplier-order.entity").SupplierOrder>;
    getSupplierOrders(supplierId: number): Promise<import("./suppliers/entities/supplier-order.entity").SupplierOrder[]>;
    markOrderAsDelivered(orderId: number): Promise<import("./suppliers/entities/supplier-order.entity").SupplierOrder>;
    updateOrderStatus(payload: {
        orderId: number;
        status: string;
    }): Promise<import("./suppliers/entities/supplier-order.entity").SupplierOrder>;
    addDocument(payload: {
        supplierId: number;
        documentData: {
            fileName: string;
            folderId: number;
            notes?: string;
        };
    }): Promise<import("./suppliers/entities/supplier-document.entity").SupplierDocument>;
    removeDocument(documentId: number): Promise<void>;
    findDocumentById(id: number): Promise<import("./suppliers/entities/supplier-document.entity").SupplierDocument | null>;
    serveDocument(payload: {
        file_id: number;
        forceDownload?: boolean;
    }): Promise<{
        data: string;
        mimeType: string;
        fileName: string;
        disposition: "inline" | "attachment";
    }>;
    emailLink(payload: {
        supplierId: number;
        orderId: number;
    }): {
        emailLink: string;
    };
    whatsappLink(payload: {
        supplierId: number;
        orderId: number;
        pdfUrl?: string;
    }): {
        whatsappLink: string;
    };
}
