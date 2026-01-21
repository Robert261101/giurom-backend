import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SuppliersService } from './suppliers/suppliers.service';
import { CreateSupplierDto } from './suppliers/dto/create-supplier.dto';
import { CreateSupplierWithDocumentsDto } from './suppliers/dto/create-supplier-with-documents.dto';
import { UpdateSupplierDto } from './suppliers/dto/update-supplier.dto';
import { CreateSupplierProductDto } from './suppliers/dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './suppliers/dto/update-supplier-product.dto';
import { CreateSupplierOrderDto } from './suppliers/dto/create-supplier-order.dto';

@Controller()
export class SuppliersMicroController {
  constructor(private readonly service: SuppliersService) {}

  // Suppliers CRUD
  @MessagePattern('suppliers.create')
  create(@Payload() payload: CreateSupplierDto | { dto: CreateSupplierDto; location_id?: number }) {
    // Suport pentru payload simplu (doar DTO) sau payload cu DTO și location_id
    if ('dto' in payload) {
      return this.service.create(payload.dto, payload.location_id);
    }
    // Dacă este doar DTO, nu avem location_id - aruncă eroare sau permite fără (pentru compatibilitate)
    return this.service.create(payload, undefined);
  }

  @MessagePattern('suppliers.createWithDocuments')
  createWithDocuments(@Payload() payload: CreateSupplierWithDocumentsDto | { dto: CreateSupplierWithDocumentsDto; location_id?: number }) {
    // Suport pentru payload simplu (doar DTO) sau payload cu DTO și location_id
    if ('dto' in payload) {
      return this.service.createWithDocuments(payload.dto, payload.location_id);
    }
    // Dacă este doar DTO, nu avem location_id - aruncă eroare sau permite fără (pentru compatibilitate)
    return this.service.createWithDocuments(payload, undefined);
  }

  @MessagePattern('suppliers.findAll')
  findAll(@Payload() payload: { location_id: number } | number) {
    // Suport pentru payload simplu (doar location_id ca număr) sau payload cu obiect
    let locationId: number;
    if (typeof payload === 'number') {
      locationId = payload;
    } else {
      locationId = payload.location_id;
    }
    
    if (!locationId) {
      throw new Error('location_id is required for suppliers.findAll');
    }
    
    return this.service.findAll(locationId);
  }

  @MessagePattern('suppliers.findOne')
  findOne(@Payload() payload: number | { id: number; location_id?: number }) {
    // Suport pentru payload simplu (doar id) sau payload cu id și location_id
    if (typeof payload === 'number') {
      // Dacă este doar un număr, nu avem location_id - aruncă eroare sau returnează fără verificare
      // Pentru compatibilitate, permitem fără location_id în microservice (poate fi folosit intern)
      return this.service.findOne(payload, undefined);
    }
    return this.service.findOne(payload.id, payload.location_id);
  }

  @MessagePattern('suppliers.update')
  update(@Payload() payload: { id: number; dto: UpdateSupplierDto }) { return this.service.update(payload.id, payload.dto); }

  @MessagePattern('suppliers.remove')
  remove(@Payload() id: number) { return this.service.remove(id); }

  // Supplier products
  @MessagePattern('suppliers.products.add')
  addProduct(@Payload() dto: CreateSupplierProductDto) { return this.service.addProduct(dto); }

  @MessagePattern('suppliers.products.findBySupplier')
  getSupplierProducts(@Payload() supplierId: number) { return this.service.getSupplierProducts(supplierId); }

  @MessagePattern('suppliers.products.update')
  updateSupplierProduct(@Payload() payload: { productId: number; dto: UpdateSupplierProductDto }) { return this.service.updateSupplierProduct(payload.productId, payload.dto); }

  @MessagePattern('suppliers.products.remove')
  removeSupplierProduct(@Payload() productId: number) { return this.service.removeSupplierProduct(productId); }

  // Orders
  @MessagePattern('suppliers.orders.create')
  createOrder(@Payload() dto: CreateSupplierOrderDto) { return this.service.createOrder(dto); }

  @MessagePattern('suppliers.orders.findBySupplier')
  getSupplierOrders(@Payload() supplierId: number) { return this.service.getSupplierOrders(supplierId); }

  @MessagePattern('suppliers.orders.deliver')
  markOrderAsDelivered(@Payload() orderId: number) { return this.service.markOrderAsDelivered(orderId); }

  @MessagePattern('suppliers.orders.updateStatus')
  updateOrderStatus(@Payload() payload: { orderId: number; status: string }) { return this.service.updateOrderStatus(payload.orderId, payload.status); }

  // Documents
  @MessagePattern('suppliers.documents.add')
  addDocument(@Payload() payload: { supplierId: number; documentData: { fileName: string; folderId: number; notes?: string } }) {
    return this.service.addDocument(payload.supplierId, payload.documentData);
  }

  @MessagePattern('suppliers.documents.remove')
  removeDocument(@Payload() documentId: number) { return this.service.removeDocument(documentId); }

  @MessagePattern('suppliers.documents.findById')
  findDocumentById(@Payload() id: number) { return this.service['supplierDocumentRepo'].findOne({ where: { id } }); }

  // File serving
  @MessagePattern('suppliers.files.serveDocument')
  serveDocument(@Payload() payload: { file_id: number; forceDownload?: boolean }) { return this.service.serveDocument(payload.file_id, !!payload.forceDownload); }

  // Links
  @MessagePattern('suppliers.orders.emailLink')
  emailLink(@Payload() payload: { supplierId: number; orderId: number }) { return { emailLink: this.service.generateEmailLink(payload.supplierId, payload.orderId) }; }

  @MessagePattern('suppliers.orders.whatsappLink')
  whatsappLink(@Payload() payload: { supplierId: number; orderId: number; pdfUrl?: string }) { return { whatsappLink: this.service.generateWhatsAppLink(payload.supplierId, payload.orderId, payload.pdfUrl) }; }
}


