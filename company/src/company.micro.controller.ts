import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CompanyService } from '@/company/company.service';
import { CreateCompanyDto } from '@/company/dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from '@/company/dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from '@/company/dto/update-company.dto';
import { CreateCompanyDocumentDto } from '@/company/dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from '@/company/dto/update-company-document.dto';

@Controller()
export class CompanyMicroController {
  constructor(private readonly companyService: CompanyService) {}

  @MessagePattern('company.create')
  create(@Payload() dto: CreateCompanyDto) {
    return this.companyService.createCompany(dto);
  }

  @MessagePattern('company.createWithDocuments')
  createWithDocuments(@Payload() dto: CreateCompanyWithDocumentsDto) {
    return this.companyService.createCompanyWithDocuments(dto);
  }

  @MessagePattern('company.findAll')
  findAll(
    @Payload()
    payload: { page: number; limit: number; search?: string; status?: string },
  ) {
    return this.companyService.findAllCompanies(
      payload.page,
      payload.limit,
      payload.search,
      payload.status,
    );
  }

  @MessagePattern('company.statistics')
  statistics() {
    return this.companyService.getCompanyStatistics();
  }

  @MessagePattern('company.findById')
  findById(@Payload() id: number) {
    return this.companyService.findCompanyById(id);
  }

  @MessagePattern('company.findByCui')
  findByCui(@Payload() cui: string) {
    return this.companyService.findCompanyByCui(cui);
  }

  @MessagePattern('company.update')
  update(@Payload() payload: { id: number; dto: UpdateCompanyDto }) {
    return this.companyService.updateCompany(payload.id, payload.dto);
  }

  @MessagePattern('company.remove')
  remove(@Payload() id: number) {
    return this.companyService.removeCompany(id);
  }

  @MessagePattern('company.documents.create')
  createDocument(@Payload() dto: CreateCompanyDocumentDto) {
    return this.companyService.createCompanyDocument(dto);
  }

  @MessagePattern('company.documents.findByCompany')
  findCompanyDocuments(@Payload() companyId: number) {
    return this.companyService.findCompanyDocuments(companyId);
  }

  @MessagePattern('company.documents.findById')
  findDocumentById(@Payload() documentId: number) {
    return this.companyService.findDocumentById(documentId);
  }

  @MessagePattern('company.documents.update')
  updateDocument(
    @Payload() payload: { documentId: number; dto: UpdateCompanyDocumentDto },
  ) {
    return this.companyService.updateCompanyDocument(
      payload.documentId,
      payload.dto,
    );
  }

  @MessagePattern('company.documents.remove')
  removeDocument(@Payload() documentId: number) {
    return this.companyService.removeCompanyDocument(documentId);
  }
}