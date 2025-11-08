import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Company } from './entity/company.entity';
import { CompanyDocument } from './entity/company-document.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyDocumentDto } from './dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './dto/update-company-document.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company) private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyDocument) private readonly companyDocumentRepository: Repository<CompanyDocument>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {}

  // Get the root directory for company files (corrected path to match project structure)
  private getCompanyFilesRootDir(): string {
    // Resolve repo root relative to this file location
    // __dirname is .../giurom-backend/company/src (dev with ts-node) or .../giurom-backend/company/dist (prod)
    // We need to go up 3 levels to reach giurom-backend, then up one more to reach giurom root
    const repoRoot = path.resolve(__dirname, '../../../..');
    return path.join(repoRoot, 'files', 'companies');
  }

  async createCompany(dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
    if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    const company = this.companyRepository.create(dto);
    const saved = await this.companyRepository.save(company);
    
    // Send notification
    try {
      this.notificationsClient.emit({ cmd: 'company.notification' }, {
        type: 'company_created',
        title: 'Companie nouă înregistrată',
        message: `S-a înregistrat compania: ${dto.name} (CUI: ${dto.cui})`,
        entity_id: saved.id,
        entity_type: 'company',
        priority: 'medium',
        data: { companyId: saved.id, ...dto }
      });
    } catch (error) {
      console.error('Failed to send company notification:', error);
    }
    
    return saved;
  }

  async createCompanyWithDocuments(dto: CreateCompanyWithDocumentsDto): Promise<Company> {
    console.log('Received data in backend:', JSON.stringify(dto, null, 2));
    const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
    if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    const { documents, ...companyData } = dto as any;
    const companyEntity: Company = this.companyRepository.create(companyData as Partial<Company>);
    const saved: Company = await this.companyRepository.save(companyEntity);
    if (Array.isArray(documents) && documents.length) {
      console.log('Documents received:', documents);
      for (const doc of documents) {
        console.log('Processing document:', doc);
        // Create directory for company if it doesn't exist
        const companyDir = path.join(this.getCompanyFilesRootDir(), saved.id.toString());
        if (!fs.existsSync(companyDir)) {
          fs.mkdirSync(companyDir, { recursive: true });
        }

        // Create folder directory if specified
        let folderPath = '';
        if (doc.folder) {
          folderPath = path.join(companyDir, doc.folder);
          if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
          }
        }

        let locationPath = doc.location_path || '';
        
        // If document has content, save it to disk
        if (doc.content) {
          try {
            // Extract base64 content from data URL (remove data:type;base64, prefix)
            let base64Data = doc.content;
            if (base64Data.includes(',')) {
              base64Data = base64Data.split(',')[1];
            }
            
            const fileName = doc.fileName || doc.document_name || `document_${Date.now()}.txt`;
            // Save file in folder directory if specified, otherwise in company directory
            const filePath = folderPath ? path.join(folderPath, fileName) : path.join(companyDir, fileName);
            
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);
            
            // Update location path
            if (doc.folder) {
              locationPath = `/files/companies/${saved.id}/${doc.folder}/${fileName}`;
            } else {
              locationPath = `/files/companies/${saved.id}/${fileName}`;
            }
          } catch (error) {
            console.error('Error saving document to disk:', error);
            // Continue even if file save fails - document is still saved in DB
          }
        }

        const document = this.companyDocumentRepository.create({
          company_id: saved.id,
          document_name: doc.fileName || doc.document_name,
          document_type: doc.document_type || 'Document',
          folder: doc.folder || null,
          location_path: locationPath,
          upload_date: new Date(),
          notes: doc.note || doc.notes || null,
        });
        console.log('Document to be saved:', document);
        await this.companyDocumentRepository.save(document);
        console.log('Document saved successfully');
      }
    }
    return saved;
  }

  async findAllCompanies(page = 1, limit = 10, search?: string, status?: string): Promise<{ companies: Company[]; total: number; totalPages: number }> {
    const qb = this.companyRepository.createQueryBuilder('company').leftJoinAndSelect('company.documents', 'documents');
    if (search) qb.where('company.company_name LIKE :search OR company.cui LIKE :search', { search: `%${search}%` });
    if (status) qb.andWhere('company.status = :status', { status });
    const offset = (page - 1) * limit;
    const [companies, total] = await qb.orderBy('company.created_at', 'DESC').skip(offset).take(limit).getManyAndCount();
    return { companies, total, totalPages: Math.ceil(total / limit) };
  }

  async findCompanyById(id: number): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id }, relations: ['documents'] });
    if (!company) throw new NotFoundException(`Compania cu ID-ul ${id} nu a fost găsită`);
    return company;
  }

  async findCompanyByCui(cui: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { cui }, relations: ['documents'] });
    if (!company) throw new NotFoundException(`Compania cu CUI-ul ${cui} nu a fost găsită`);
    return company;
  }

  async updateCompany(id: number, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findCompanyById(id);
    if (dto.cui && dto.cui !== company.cui) {
      const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
      if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    }
    Object.assign(company, dto);
    return await this.companyRepository.save(company);
  }

  async removeCompany(id: number): Promise<void> {
    const company = await this.findCompanyById(id);
    await this.companyRepository.remove(company);
  }

  async createCompanyDocument(dto: CreateCompanyDocumentDto & { file_content?: string }): Promise<CompanyDocument> {
    const company = await this.findCompanyById(dto.company_id);
    
    // Create directory for company if it doesn't exist
    const companyDir = path.join(this.getCompanyFilesRootDir(), company.id.toString());
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }

    // Create folder directory if specified
    let folderPath = '';
    if (dto.folder) {
      folderPath = path.join(companyDir, dto.folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    }

    let locationPath = dto.location_path || '';
    
    // If document has content, save it to disk
    if (dto.file_content) {
      try {
        // Extract base64 content from data URL (remove data:type;base64, prefix)
        let base64Data = dto.file_content;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        
        const fileName = dto.document_name;
        // Save file in folder directory if specified, otherwise in company directory
        const filePath = folderPath ? path.join(folderPath, fileName) : path.join(companyDir, fileName);
        
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        
        // Update location path
        if (dto.folder) {
          locationPath = `/files/companies/${company.id}/${dto.folder}/${fileName}`;
        } else {
          locationPath = `/files/companies/${company.id}/${fileName}`;
        }
      } catch (error) {
        console.error('Error saving document to disk:', error);
        // Continue even if file save fails - document is still saved in DB
      }
    }

    const documentData = {
      ...dto,
      location_path: locationPath
    };

    const document = this.companyDocumentRepository.create(documentData);
    return await this.companyDocumentRepository.save(document);
  }

  async findCompanyDocuments(companyId: number): Promise<CompanyDocument[]> {
    await this.findCompanyById(companyId);
    return await this.companyDocumentRepository.find({ where: { company_id: companyId }, relations: ['company'], order: { upload_date: 'DESC' } });
  }

  async findCompanyDocumentsByFolder(companyId: number, folder: string): Promise<CompanyDocument[]> {
    await this.findCompanyById(companyId);
    return await this.companyDocumentRepository.find({ 
      where: { 
        company_id: companyId,
        folder: folder
      }, 
      relations: ['company'], 
      order: { upload_date: 'DESC' } 
    });
  }

  async findDocumentById(documentId: number): Promise<CompanyDocument> {
    const document = await this.companyDocumentRepository.findOne({ where: { id: documentId }, relations: ['company'] });
    if (!document) throw new NotFoundException(`Documentul cu ID-ul ${documentId} nu a fost găsit`);
    return document;
  }

  async updateCompanyDocument(documentId: number, dto: UpdateCompanyDocumentDto): Promise<CompanyDocument> {
    const document = await this.findDocumentById(documentId);
    Object.assign(document, dto);
    return await this.companyDocumentRepository.save(document);
  }

  async removeCompanyDocument(documentId: number): Promise<void> {
    const document = await this.findDocumentById(documentId);
    await this.companyDocumentRepository.remove(document);
  }

  // Serve a company file from disk
  async serveCompanyFile(fileId: number, forceDownload: boolean = false): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
    console.log(`🔍 Serving company file with ID: ${fileId}, forceDownload: ${forceDownload}`);
    
    const document = await this.findDocumentById(fileId);
    console.log(`📄 Document metadata:`, {
      id: document.id,
      name: document.document_name,
      company_id: document.company_id,
      location_path: document.location_path
    });
    
    // Construct the file path from the location_path
    const basePath = this.getCompanyFilesRootDir();
    const relativePath = document.location_path.replace('/files/companies/', '');
    const filePath = path.join(basePath, relativePath);
    console.log(`📁 Serving file from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found on disk: ${filePath}`);
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
    }
    
    const mimeType = this.getMimeType(document.document_name);
    console.log(`📋 MIME type determined: ${mimeType}`);
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`✅ File read successfully: ${document.document_name} (${fileBuffer.length} bytes)`);

    return {
      data: fileBuffer.toString('base64'),
      mimeType,
      fileName: document.document_name,
      disposition: forceDownload ? 'attachment' : 'inline',
    };
  }

  // Determine MIME type based on file extension
  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'txt': 'text/plain',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
    };
    
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  async getCompanyFolders(companyId: number): Promise<string[]> {
    await this.findCompanyById(companyId);
    const documents = await this.companyDocumentRepository.find({ 
      where: { company_id: companyId },
      select: ['folder']
    });
    
    // Extract unique folder names, filtering out null/undefined values
    const folders = documents
      .map(doc => doc.folder)
      .filter((folder, index, self) => 
        folder && self.indexOf(folder) === index
      ) as string[];
      
    return folders;
  }

  async getCompanyStatistics(): Promise<{ total: number; active: number; inactive: number; vat_payers: number }> {
    const total = await this.companyRepository.count();
    const active = await this.companyRepository.count({ where: { status: 'activ' } });
    const inactive = await this.companyRepository.count({ where: { status: 'inactiv' } });
    const vat_payers = await this.companyRepository.count({ where: { vat_payer: true } });
    return { total, active, inactive, vat_payers };
  }
}