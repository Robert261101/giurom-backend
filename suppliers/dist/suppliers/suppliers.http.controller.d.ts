import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './dto/create-supplier-with-documents.dto';
import { Response } from 'express';
export declare class SuppliersHttpController {
    private readonly service;
    constructor(service: SuppliersService);
    getSuppliers(_page?: string, _limit?: string, _search?: string, _is_active?: string): Promise<import("./entities/supplier.entity").Supplier[]>;
    create(dto: CreateSupplierDto): Promise<import("./entities/supplier.entity").Supplier>;
    createWithDocs(dto: CreateSupplierWithDocumentsDto): Promise<import("./entities/supplier.entity").Supplier>;
    findOne(id: string): Promise<import("./entities/supplier.entity").Supplier>;
    update(id: string, dto: any): Promise<import("./entities/supplier.entity").Supplier>;
    remove(id: string): Promise<void>;
    getProducts(supplierId: string): Promise<import("./entities/supplier-product.entity").SupplierProduct[]>;
    addProduct(dto: any): Promise<import("./entities/supplier-product.entity").SupplierProduct>;
    updateProduct(productId: string, dto: any): Promise<import("./entities/supplier-product.entity").SupplierProduct>;
    removeProduct(productId: string): Promise<void>;
    getOrders(supplierId: string): Promise<import("./entities/supplier-order.entity").SupplierOrder[]>;
    createOrder(dto: any): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    deliver(orderId: string): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    updateStatus(orderId: string, body: any): Promise<import("./entities/supplier-order.entity").SupplierOrder>;
    emailLink(supplierId: string, orderId: string): {
        emailLink: string;
    };
    whatsappLink(supplierId: string, orderId: string): {
        whatsappLink: string;
    };
    addDocument(supplierId: string, body: any): Promise<import("./entities/supplier-document.entity").SupplierDocument>;
    removeDocument(documentId: string): Promise<void>;
    getSupplierFile(fileId: number, download: string, res: Response): Promise<any>;
    viewSupplierFile(fileId: number, res: Response): Promise<any>;
    assignSupplierToLocation(supplierId: string, locationId: string): Promise<import("./entities/supplier-locations.entity").SupplierLocations>;
    findSupplierLocations(supplierId: string): Promise<import("./entities/supplier-locations.entity").SupplierLocations[]>;
    findLocationSuppliers(locationId: string): Promise<import("./entities/supplier-locations.entity").SupplierLocations[]>;
    removeSupplierFromLocation(supplierId: string, locationId: string): Promise<void>;
}
