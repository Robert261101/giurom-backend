import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyDocument)
    private readonly companyDocumentRepository: Repository<CompanyDocument>,
  ) {}

  /**
   * Creează o nouă companie
   */
  async createCompany(createCompanyDto: CreateCompanyDto): Promise<Company> {
    // Verifică dacă CUI-ul este deja înregistrat
    const existingCompany = await this.companyRepository.findOne({
      where: { cui: createCompanyDto.cui },
    });

    if (existingCompany) {
      throw new ConflictException(
        `O companie cu CUI-ul ${createCompanyDto.cui} există deja`,
      );
    }

    const company = this.companyRepository.create(createCompanyDto);
    return await this.companyRepository.save(company);
  }

  /**
   * Creează o nouă companie cu documente
   */
  async createCompanyWithDocuments(dto: CreateCompanyWithDocumentsDto): Promise<Company> {
    // Verifică dacă CUI-ul este deja înregistrat
    const existingCompany = await this.companyRepository.findOne({
      where: { cui: dto.cui },
    });

    if (existingCompany) {
      throw new ConflictException(
        `O companie cu CUI-ul ${dto.cui} există deja`,
      );
    }

    // Extrage datele pentru companie (fără documents)
    const { documents, ...companyData } = dto;
    
    // Creează compania
    const company = this.companyRepository.create(companyData);
    const savedCompany = await this.companyRepository.save(company);

    // Salvează documentele dacă există
    if (dto.documents && dto.documents.length > 0) {
      await this.saveCompanyDocuments(savedCompany, dto.documents);
    }

    return savedCompany;
  }

  /**
   * Returnează toate companiile cu opțiune de filtrare
   */
  async findAllCompanies(
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
  ): Promise<{ companies: Company[]; total: number; totalPages: number }> {
    const queryBuilder = this.companyRepository
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.documents', 'documents')
      .leftJoinAndSelect('company.work_locations', 'work_locations');

    // Aplicarea filtrărilor
    if (search) {
      queryBuilder.where(
        'company.company_name LIKE :search OR company.cui LIKE :search',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('company.status = :status', { status });
    }

    // Paginarea
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Ordonarea
    queryBuilder.orderBy('company.created_at', 'DESC');

    const [companies, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return { companies, total, totalPages };
  }

  /**
   * Returnează o companie după ID cu toate relațiile
   */
  async findCompanyById(id: number): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['documents', 'work_locations'],
    });

    if (!company) {
      throw new NotFoundException(`Compania cu ID-ul ${id} nu a fost găsită`);
    }

    return company;
  }

  /**
   * Returnează o companie după CUI
   */
  async findCompanyByCui(cui: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { cui },
      relations: ['documents', 'work_locations'],
    });

    if (!company) {
      throw new NotFoundException(`Compania cu CUI-ul ${cui} nu a fost găsită`);
    }

    return company;
  }

  /**
   * Actualizează o companie
   */
  async updateCompany(
    id: number,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<Company> {
    const company = await this.findCompanyById(id);

    // Verifică CUI-ul doar dacă se schimbă
    if (updateCompanyDto.cui && updateCompanyDto.cui !== company.cui) {
      const existingCompany = await this.companyRepository.findOne({
        where: { cui: updateCompanyDto.cui },
      });

      if (existingCompany) {
        throw new ConflictException(
          `O companie cu CUI-ul ${updateCompanyDto.cui} există deja`,
        );
      }
    }

    Object.assign(company, updateCompanyDto);
    return await this.companyRepository.save(company);
  }

  /**
   * Șterge o companie
   */
  async removeCompany(id: number): Promise<void> {
    const company = await this.findCompanyById(id);
    await this.companyRepository.remove(company);
  }

  /**
   * Creează un document pentru o companie
   */
  async createCompanyDocument(
    createDocumentDto: CreateCompanyDocumentDto,
  ): Promise<CompanyDocument> {
    // Verifică dacă compania există
    await this.findCompanyById(createDocumentDto.company_id);

    const document = this.companyDocumentRepository.create(createDocumentDto);
    return await this.companyDocumentRepository.save(document);
  }

  /**
   * Returnează toate documentele unei companii
   */
  async findCompanyDocuments(companyId: number): Promise<CompanyDocument[]> {
    await this.findCompanyById(companyId);

    return await this.companyDocumentRepository.find({
      where: { company_id: companyId },
      relations: ['company'],
      order: { upload_date: 'DESC' },
    });
  }

  /**
   * Returnează un document după ID
   */
  async findDocumentById(documentId: number): Promise<CompanyDocument> {
    const document = await this.companyDocumentRepository.findOne({
      where: { id: documentId },
      relations: ['company'],
    });

    if (!document) {
      throw new NotFoundException(
        `Documentul cu ID-ul ${documentId} nu a fost găsit`,
      );
    }

    return document;
  }

  /**
   * Actualizează un document
   */
  async updateCompanyDocument(
    documentId: number,
    updateDocumentDto: UpdateCompanyDocumentDto,
  ): Promise<CompanyDocument> {
    const document = await this.findDocumentById(documentId);

    Object.assign(document, updateDocumentDto);
    return await this.companyDocumentRepository.save(document);
  }

  /**
   * Șterge un document
   */
  async removeCompanyDocument(documentId: number): Promise<void> {
    const document = await this.findDocumentById(documentId);
    await this.companyDocumentRepository.remove(document);
  }

  /**
   * Returnează statistici despre companii
   */
  async getCompanyStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    vat_payers: number;
  }> {
    const total = await this.companyRepository.count();
    const active = await this.companyRepository.count({
      where: { status: 'activ' },
    });
    const inactive = await this.companyRepository.count({
      where: { status: 'inactiv' },
    });
    const vat_payers = await this.companyRepository.count({
      where: { vat_payer: true },
    });

    return { total, active, inactive, vat_payers };
  }

  /**
   * Salvează documentele unei companii în folderul local
   */
  private async saveCompanyDocuments(company: Company, documents: any[]): Promise<void> {
    // Creează folderul pentru companie în files/companies
    const projectRoot = path.join(process.cwd(), '..');
    const filesDir = path.join(projectRoot, 'files');
    const companiesDir = path.join(filesDir, 'companies');
    const companyDir = path.join(companiesDir, company.id.toString());

    // Creează directoarele dacă nu există
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    if (!fs.existsSync(companiesDir)) fs.mkdirSync(companiesDir, { recursive: true });
    if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });

    // Salvează fiecare document
    for (const doc of documents) {
      try {
        // Generează un nume unic pentru fișier cu ID-ul companiei
        const fileName = doc.fileName || doc.name;
        const timestamp = Date.now();
        const uniqueFileName = `${company.id}_${timestamp}_${fileName}`;
        const filePath = path.join(companyDir, uniqueFileName);
        
        // Salvează fișierul real din conținutul base64
        if (doc.content && doc.content.startsWith('data:')) {
          // Extract base64 content (remove data:mime/type;base64, prefix)
          const base64Data = doc.content.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, buffer);
          console.log(`✅ Document companie salvat fizic (${buffer.length} bytes): ${filePath}`);
        } else {
          // Fallback: create a text file with document info if no content
          const fileContent = `Document: ${fileName}
Tip: ${doc.document_type || 'Document general'}
Note: ${doc.note || doc.notes || 'Fără note'}
Data upload: ${new Date().toISOString()}
Companie: ${company.company_name}
CUI: ${company.cui}`;
          fs.writeFileSync(filePath, fileContent, 'utf8');
          console.log(`✅ Document info companie salvat fizic: ${filePath}`);
        }
        console.log(`✅ Document companie salvat fizic: ${filePath}`);

        // Salvează informațiile în baza de date
        const documentData = {
          company_id: company.id,
          document_name: fileName,
          document_type: doc.document_type || 'Document general',
          location_path: `/files/companies/${company.id}/${uniqueFileName}`,
          upload_date: new Date(),
          notes: doc.note || doc.notes || '',
        };

        const document = this.companyDocumentRepository.create(documentData);
        await this.companyDocumentRepository.save(document);
        
        console.log(`✅ Document companie salvat în DB: ${fileName}`);
      } catch (error) {
        console.error('Error saving company document:', error);
        // Continue cu următorul document chiar dacă unul eșuează
      }
    }
  }
} 