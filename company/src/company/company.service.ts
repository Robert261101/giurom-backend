import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  /** Același mod ca locations: getRepoRoot() + files/companies. */
  private getRepoRoot(): string {
    return path.resolve(__dirname, '../../..');
  }

  private getCompanyFilesRootDir(): string {
    return path.join(this.getRepoRoot(), 'files', 'companies');
  }
  /**
   * Creează pe server structura obligatorie: files/companies/[nume companie]/ și Locații/.
   * La crearea unei locații se vor crea obligatoriu sub Locații/[nume locație]/ folderele Angajați și Furnizori.
   */
  private async createCompanyFolderStructure(company: Company): Promise<void> {
    try {
      // Obligatoriu: folder cu numele companiei în files/companies
      const companyRootDir = path.join(this.getCompanyFilesRootDir(), company.company_name);
      if (!fs.existsSync(companyRootDir)) {
        fs.mkdirSync(companyRootDir, { recursive: true });
        console.log(`📁 Created company root directory: ${companyRootDir}`);
      }

      // Obligatoriu: folder Locații în care vor apărea folderele per locație (Angajați, Furnizori)
      const locationsDir = path.join(companyRootDir, 'Locații');
      if (!fs.existsSync(locationsDir)) {
        fs.mkdirSync(locationsDir, { recursive: true });
        console.log(`📁 Created locations directory: ${locationsDir}`);
      }
      
      // Create "Companie" folder with all subfolders (documente firme)
      const companyDir = path.join(companyRootDir, 'Companie');
      if (!fs.existsSync(companyDir)) {
        fs.mkdirSync(companyDir, { recursive: true });
        console.log(`📁 Created company directory: ${companyDir}`);
      }
      
      // Create all required subfolders for "Companie"
      const companySubfolders = [
        'Certificat de Înregistrare',
        'Act Constitutiv',
        'Hotărâre ANAF',
        'Certificat Fiscal',
        'Procură',
        'Contract de Închiriere sediu',
        'Contracte utilități',
        'Contracte parteneri',
        'Contracte servicii (IT, contabilitate etc.)',
        'Decizii fiscale',
        'Declarații fiscale',
        'Situații financiare (bilanț, balanță)',
        'Registre contabile',
        'Regulament intern',
        'Politici GDPR',
        'Proceduri interne',
        'Documente SSM/PSI',
        'Procese verbale',
        'Alte documente'
      ];
      
      for (const subfolder of companySubfolders) {
        const subfolderPath = path.join(companyDir, subfolder);
        if (!fs.existsSync(subfolderPath)) {
          fs.mkdirSync(subfolderPath, { recursive: true });
          console.log(`📁 Created company subfolder: ${subfolderPath}`);
        }
      }
      
      console.log(`✅ Folder structure created successfully for company ${company.id}`);
    } catch (error) {
      console.error(`❌ Error creating folder structure for company ${company.id}:`, error);
    }
  }

  async createCompany(dto: CreateCompanyDto, work_location_id?: number): Promise<Company> {
    const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
    if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    const company = this.companyRepository.create(dto);
    const saved = await this.companyRepository.save(company);
    
    // Create the required folder structure for the new company
    await this.createCompanyFolderStructure(saved);
    
    // Send notification
    try {
      console.log(`🔍 [COMPANY SERVICE] Attempting to send company notification for company ID: ${saved.id}`);
      console.log(`📝 Notification details - Name: ${dto.company_name}, CUI: ${dto.cui}`);
      
      const notificationData = {
        type: 'company_created',
        title: 'Companie noua inregistrata',
        description: `S-a inregistrat compania: ${dto.company_name} (CUI: ${dto.cui})`,
        entity_id: saved.id,
        entity_type: 'company',
        priority: 'medium',
        target_url: `/firme/${saved.id}`,
        metadata: { companyId: saved.id, ...dto, ...(work_location_id != null ? { work_location_id } : {}) },
      };
      
      console.log(`📤 Sending notification data: ${JSON.stringify(notificationData, null, 2)}`);
      
      this.notificationsClient.emit({ cmd: 'company.notification' }, notificationData);
      
      console.log(`✅ [COMPANY SERVICE] Successfully sent notification for company ${saved.id}`);
    } catch (error) {
      console.error('❌ [COMPANY SERVICE] Failed to send company notification:', error);
    }
    
    return saved;
  }

  async createCompanyWithDocuments(dto: CreateCompanyWithDocumentsDto): Promise<Company> {
    const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
    if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    const { documents, ...companyData } = dto as any;
    const companyEntity: Company = this.companyRepository.create(companyData as Partial<Company>);
    const saved: Company = await this.companyRepository.save(companyEntity);
    
    // Create the required folder structure for the new company
    await this.createCompanyFolderStructure(saved);
    
    if (Array.isArray(documents) && documents.length) {
      for (const doc of documents) {
        // Create directory for company if it doesn't exist
        const companyDir = path.join(this.getCompanyFilesRootDir(), saved.company_name);
        if (!fs.existsSync(companyDir)) {
          fs.mkdirSync(companyDir, { recursive: true });
        }

        // Create folder directory if specified - inside the "Companie" folder
        let folderPath = '';
        if (doc.folder) {
          folderPath = path.join(companyDir, 'Companie', doc.folder);
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
              locationPath = `/files/companies/${saved.company_name}/Companie/${doc.folder}/${fileName}`;
            } else {
              locationPath = `/files/companies/${saved.company_name}/${fileName}`;
            }
          } catch (error) {
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
        await this.companyDocumentRepository.save(document);
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

  // Returnează doar id și company_name pentru utilizatori cu permisiunea companies.read_own
  async findForOwn(): Promise<{ id: number; company_name: string }[]> {
    const companies = await this.companyRepository
      .createQueryBuilder('company')
      .select(['company.id', 'company.company_name'])
      .where('company.status = :status', { status: 'active' })
      .orderBy('company.company_name', 'ASC')
      .getMany();

    return companies.map(company => ({
      id: company.id,
      company_name: company.company_name,
    }));
  }

  // Returnează doar id și company_name pentru o companie (pentru utilizatori cu permisiunea companies.read_own)
  async findNameById(id: number): Promise<{ id: number; company_name: string }> {
    const company = await this.companyRepository.findOne({
      where: { id },
      select: ['id', 'company_name']
    });
    
    if (!company) {
      throw new NotFoundException(`Compania cu ID-ul ${id} nu a fost găsită`);
    }
    
    return {
      id: company.id,
      company_name: company.company_name,
    };
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

  async updateCompany(id: number, dto: UpdateCompanyDto, work_location_id?: number): Promise<Company> {
    console.log(`🔍 [COMPANY SERVICE] Updating company ${id} with data:`, JSON.stringify(dto, null, 2));
    
    const company = await this.findCompanyById(id);
    if (dto.cui && dto.cui !== company.cui) {
      const existing = await this.companyRepository.findOne({ where: { cui: dto.cui } });
      if (existing) throw new ConflictException(`O companie cu CUI-ul ${dto.cui} există deja`);
    }
    Object.assign(company, dto);
    const updatedCompany = await this.companyRepository.save(company);
    
    // Send notification for updated company
    try {
      console.log(`🔔 [COMPANY SERVICE] Sending notification for updated company ${updatedCompany.id}`);
      
      const notificationData = {
        type: 'company_updated',
        title: 'Companie modificata',
        description: `Compania ${company.company_name} a fost modificata`,
        entity_id: updatedCompany.id,
        entity_type: 'company',
        priority: 'medium',
        target_url: `/firme/${updatedCompany.id}`,
        metadata: {
          companyId: updatedCompany.id,
          oldName: company.company_name,
          newName: updatedCompany.company_name,
          updatedFields: Object.keys(dto),
          ...(work_location_id != null ? { work_location_id } : {}),
        },
      };
      
      console.log(`📤 Sending notification data: ${JSON.stringify(notificationData, null, 2)}`);
      
      this.notificationsClient.emit({ cmd: 'company.notification' }, notificationData);
      
      console.log(`✅ [COMPANY SERVICE] Successfully sent notification for updated company ${updatedCompany.id}`);
    } catch (error) {
      console.error('❌ [COMPANY SERVICE] Failed to send company update notification:', error);
    }
    
    return updatedCompany;
  }

  async removeCompany(id: number, work_location_id?: number): Promise<void> {
    console.log(`🔍 [COMPANY SERVICE] Removing company ${id}`);
    
    const company = await this.findCompanyById(id);
    const companyName = company.company_name;
    await this.companyRepository.remove(company);
    
    // Send notification for deleted company
    try {
      console.log(`🔔 [COMPANY SERVICE] Sending notification for deleted company ${id}`);
      
      const notificationData = {
        type: 'company_deleted',
        title: 'Companie stearsa',
        description: `Compania ${companyName} a fost stearsa`,
        entity_id: id,
        entity_type: 'company',
        priority: 'medium',
        target_url: `/firme/${id}`,
        metadata: { companyId: id, companyName, ...(work_location_id != null ? { work_location_id } : {}) },
      };
      
      console.log(`📤 Sending notification data: ${JSON.stringify(notificationData, null, 2)}`);
      
      this.notificationsClient.emit({ cmd: 'company.notification' }, notificationData);
      
      console.log(`✅ [COMPANY SERVICE] Successfully sent notification for deleted company ${id}`);
    } catch (error) {
      console.error('❌ [COMPANY SERVICE] Failed to send company delete notification:', error);
    }
  }

  async createCompanyDocument(dto: CreateCompanyDocumentDto & { file_content?: string; expire_date?: string }): Promise<CompanyDocument> {
    const company = await this.findCompanyById(dto.company_id);
    
    // Create directory for company if it doesn't exist
    const companyDir = path.join(this.getCompanyFilesRootDir(), company.company_name);
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }

    // Create folder directory if specified - inside the "Companie" folder
    let folderPath = '';
    if (dto.folder) {
      folderPath = path.join(companyDir, 'Companie', dto.folder);
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
          locationPath = `/files/companies/${company.company_name}/Companie/${dto.folder}/${fileName}`;
        } else {
          locationPath = `/files/companies/${company.company_name}/${fileName}`;
        }
      } catch (error) {
        console.error('Error saving document to disk:', error);
        // Continue even if file save fails - document is still saved in DB
      }
    }

    const documentData = {
      ...dto,
      location_path: locationPath,
      expire_date: dto.expire_date ? new Date(dto.expire_date) : null
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
    
    // Remove physical file from disk
    try {
      // Construct the file path from the location_path (same logic as in serveCompanyFile)
      const basePath = this.getCompanyFilesRootDir();
      const relativePath = document.location_path.replace('/files/companies/', '');
      const filePath = path.join(basePath, relativePath);
      
      // Remove the physical file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted physical file: ${filePath}`);
      } else {
        console.warn(`⚠️ Physical file not found for removal: ${filePath}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to delete physical file for document ${documentId}:`, error);
    }
    
    // Remove database record
    await this.companyDocumentRepository.remove(document);
  }

  // Serve a company file from disk
  async serveCompanyFile(fileId: number, forceDownload: boolean = false): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
    const document = await this.findDocumentById(fileId);
    
    // Construct the file path from the location_path
    const basePath = this.getCompanyFilesRootDir();
    const relativePath = document.location_path.replace('/files/companies/', '');
    const filePath = path.join(basePath, relativePath);
    
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
    }
    
    const mimeType = this.getMimeType(document.document_name);
    const fileBuffer = fs.readFileSync(filePath);

    return {
      data: fileBuffer.toString('base64'),
      mimeType,
      fileName: document.document_name,
      disposition: forceDownload ? 'attachment' : 'inline',
    };
  }

  /**
   * Returnează informații de bază pentru o listă de companii (folosit pentru batch lookup între microservicii)
   */
  async findByIdsBasic(
    ids: number[],
  ): Promise<Array<Pick<Company, 'id' | 'company_name'>>> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids));

    const companies = await this.companyRepository.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'company_name'],
    });

    return companies;
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

  /**
   * Returnează lista de foldere: din DB (cu documente) + de pe disk (directoare din Companie/).
   * Astfel după refresh în UI apar și folderele goale create cu createCompanyFolder.
   */
  async getCompanyFolders(companyId: number): Promise<string[]> {
    const company = await this.findCompanyById(companyId);
    const fromDb = await this.companyDocumentRepository.find({
      where: { company_id: companyId },
      select: ['folder'],
    });
    const dbFolders = fromDb
      .map((doc) => doc.folder)
      .filter((f): f is string => !!f && !!f.trim());
    const uniqueDb = [...new Set(dbFolders)];

    const rootDir = path.resolve(this.getCompanyFilesRootDir());
    const companieDir = path.join(rootDir, company.company_name, 'Companie');
    const diskFolders: string[] = [];
    if (fs.existsSync(companieDir)) {
      const collect = (dir: string, prefix: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          const name = e.name;
          const relPath = prefix ? `${prefix}/${name}` : name;
          diskFolders.push(relPath);
          const fullPath = path.join(dir, name);
          collect(fullPath, relPath);
        }
      };
      collect(companieDir, '');
    }

    const combined = [...new Set([...uniqueDb, ...diskFolders])].sort();
    return combined;
  }

  /**
   * Creează pe disk un folder în Companie (pentru documente firmă).
   * @param companyId ID companie
   * @param folder Cale folder (ex: "Folder nou" sau "Parent/Child"); se creează sub files/companies/{nume}/Companie/
   */
  async createCompanyFolder(companyId: number, folder: string): Promise<void> {
    if (!folder || !folder.trim()) return;
    const company = await this.findCompanyById(companyId);
    const rootDir = path.resolve(this.getCompanyFilesRootDir());
    const companyDir = path.join(rootDir, company.company_name);
    const companieDir = path.join(companyDir, 'Companie');
    const folderPath = path.resolve(path.join(companieDir, folder.trim()));

    try {
      if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });
      if (!fs.existsSync(companieDir)) fs.mkdirSync(companieDir, { recursive: true });
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        if (!fs.existsSync(folderPath)) throw new Error(`Nu s-a putut crea: ${folderPath}`);
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * Șterge pe disk un folder din Companie (și subfoldere). Documentele din DB cu folder=X rămân; poți adăuga ștergere lor dacă e nevoie.
   */
  async deleteCompanyFolder(companyId: number, folder: string): Promise<void> {
    if (!folder || !folder.trim()) return;
    const company = await this.findCompanyById(companyId);
    const rootDir = path.resolve(this.getCompanyFilesRootDir());
    const companyDir = path.join(rootDir, company.company_name);
    const companieDir = path.join(companyDir, 'Companie');
    const folderPath = path.resolve(path.join(companieDir, folder.trim()));
    if (!folderPath.startsWith(companieDir)) throw new Error('Cale invalidă');
    if (!fs.existsSync(folderPath)) return;
    fs.rmSync(folderPath, { recursive: true });
  }

  // Get file system structure from files/company directory
  async getCompanyFileStructure(companyId: number): Promise<any> {
    const company = await this.findCompanyById(companyId);
    
    // Try both paths: files/company/{companyName} and files/companies/{companyId}
    const repoRoot = this.getRepoRoot();
    
    // Also try common alternative paths
    const possibleRoots = [
      repoRoot,
      path.join(repoRoot, '..'), // One level up
      '/home/giurom', // Common production path
      '/var/www/giurom', // Alternative production path
      process.cwd(), // Current working directory
    ];
    
    let foundRoot = null;
    for (const root of possibleRoots) {
      const testFilesDir = path.join(root, 'files');
      if (fs.existsSync(testFilesDir)) {
        foundRoot = root;
        break;
      }
    }
    
    if (!foundRoot) {
      foundRoot = repoRoot;
    }
    
    const companyNamePath = path.join(foundRoot, 'files', 'company', company.company_name);
    const companyIdPath = path.join(foundRoot, 'files', 'companies', company.id.toString());
    
    // Check which path exists
    let companyDir = '';
    if (fs.existsSync(companyNamePath)) {
      companyDir = companyNamePath;
    } else if (fs.existsSync(companyIdPath)) {
      companyDir = companyIdPath;
    } else {
      return { type: 'folder', name: company.company_name, children: [] };
    }
    
    // Recursive function to read directory structure
    const readDirectory = (dirPath: string, relativePath: string = ''): any => {
      const result: any = {
        type: 'folder',
        name: path.basename(dirPath),
        path: relativePath,
        children: []
      };
      
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          
          if (entry.isDirectory()) {
            result.children.push(readDirectory(fullPath, entryRelativePath));
          } else if (entry.isFile()) {
            result.children.push({
              type: 'file',
              name: entry.name,
              path: entryRelativePath
            });
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
      
      return result;
    };
    
    return readDirectory(companyDir);
  }

  // Get files from a specific folder path on server
  async getFilesFromFolder(companyId: number, folderPath: string): Promise<Array<{ name: string; path: string; size?: number; modified?: Date }>> {
    const company = await this.findCompanyById(companyId);
    
    // Try both paths: files/company/{companyName} and files/companies/{companyId}
    const repoRoot = this.getRepoRoot();
    
    // Also try common alternative paths
    const possibleRoots = [
      repoRoot,
      path.join(repoRoot, '..'), // One level up
      '/home/giurom', // Common production path
      '/var/www/giurom', // Alternative production path
      process.cwd(), // Current working directory
    ];
    
    let foundRoot = null;
    for (const root of possibleRoots) {
      const testFilesDir = path.join(root, 'files');
      if (fs.existsSync(testFilesDir)) {
        foundRoot = root;
        break;
      }
    }
    
    if (!foundRoot) {
      foundRoot = repoRoot;
    }
    
    // Try multiple possible paths for company directory
    const possibleCompanyPaths = [
      path.join(foundRoot, 'files', 'companies', company.id.toString()), // /home/files/companies/3
      path.join(foundRoot, 'files', 'companies', company.company_name), // /home/files/companies/Giurom Divert Srl
      path.join(foundRoot, 'files', 'company', company.company_name), // /home/files/company/Giurom Divert Srl (legacy)
      path.join(foundRoot, 'files', 'company', company.id.toString()), // /home/files/company/3 (legacy)
    ];
    
    // Check which path exists
    let companyDir = '';
    for (const companyPath of possibleCompanyPaths) {
      if (fs.existsSync(companyPath)) {
        companyDir = companyPath;
        break;
      }
    }
    
    if (!companyDir) {
      return [];
    }
    
    // Build full path to the folder
    // folderPath is like: "locations/gyros-doner-constanta/suppliers/furnizor-testsx/certificat-de-inregistrare-furnizor"
    // But on server:
    // - "locations" is "Locații" (with diacritics and capital)
    // - "gyros-doner-constanta" is "Gyros & Doner Constanta" (with diacritics and capital)
    // - "suppliers" is "Furnizori" (with diacritics and capital)
    // - "furnizor-testsx" might be "furnizor testsx" (with spaces)
    // So we need to correct all of these step by step
    let correctedFolderPath = folderPath;
    
    // Helper function to simplify a name for comparison
    const simplifyName = (name: string): string => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    };
    
    // Step 1: Correct "locations" -> "Locații"
    if (correctedFolderPath.startsWith('locations/')) {
      const companyDirContents = fs.existsSync(companyDir) ? fs.readdirSync(companyDir) : [];
      const locationsFolderName = companyDirContents.find(name => 
        name.toLowerCase() === 'locations' || 
        name.toLowerCase() === 'locații' ||
        name === 'Locații' ||
        name === 'locations'
      );
      
      if (locationsFolderName) {
        correctedFolderPath = correctedFolderPath.replace(/^locations\//i, `${locationsFolderName}/`);
      }
    }
    
    // Step 2: Find the actual location name
    const pathParts = correctedFolderPath.split('/');
    const locationsIndex = pathParts.findIndex(part => 
      part.toLowerCase() === 'locations' || 
      part.toLowerCase() === 'locații' ||
      part === 'Locații'
    );
    
    if (locationsIndex >= 0 && locationsIndex + 1 < pathParts.length) {
      const simplifiedLocationName = pathParts[locationsIndex + 1]; // e.g., "gyros-doner-constanta"
      const locationsPath = path.join(companyDir, pathParts[locationsIndex]);
      
      if (fs.existsSync(locationsPath)) {
        const locationDirContents = fs.readdirSync(locationsPath);
        const actualLocationName = locationDirContents.find(name => 
          simplifyName(name) === simplifiedLocationName
        );
        
        if (actualLocationName && actualLocationName !== simplifiedLocationName) {
          pathParts[locationsIndex + 1] = actualLocationName;
          correctedFolderPath = pathParts.join('/');
        }
      }
    }
    
    // Step 3: Correct "suppliers" -> "Furnizori" and find actual supplier name
    // Use correctedFolderPath (after Step 1 and Step 2) to get the updated path parts
    let updatedPathParts = correctedFolderPath.split('/');
    const suppliersIndex = updatedPathParts.findIndex(part => 
      part.toLowerCase() === 'suppliers' || 
      part.toLowerCase() === 'furnizori'
    );
    
    if (suppliersIndex >= 0) {
      // Find the location folder to check for "Furnizori"
      const locationFolderIndex = updatedPathParts.findIndex(part => 
        part === 'Locații' || part.toLowerCase() === 'locații'
      );
      
      if (locationFolderIndex >= 0 && locationFolderIndex + 1 < suppliersIndex) {
        const locationName = updatedPathParts[locationFolderIndex + 1];
        const locationPath = path.join(companyDir, updatedPathParts.slice(0, locationFolderIndex + 2).join('/'));
        
        if (fs.existsSync(locationPath)) {
          const locationDirContents = fs.readdirSync(locationPath);
          
          const suppliersFolderName = locationDirContents.find(name => 
            name.toLowerCase() === 'suppliers' || 
            name.toLowerCase() === 'furnizori' ||
            name === 'Furnizori' ||
            name === 'suppliers'
          );
          
          if (suppliersFolderName && suppliersFolderName !== updatedPathParts[suppliersIndex]) {
            updatedPathParts[suppliersIndex] = suppliersFolderName;
            correctedFolderPath = updatedPathParts.join('/');
          }
          
          // Step 4: Find the actual supplier name
          if (suppliersIndex + 1 < updatedPathParts.length) {
            const simplifiedSupplierName = updatedPathParts[suppliersIndex + 1]; // e.g., "furnizor-testsx"
            const suppliersPath = path.join(locationPath, suppliersFolderName || 'Furnizori');
            
            if (fs.existsSync(suppliersPath)) {
              const suppliersDirContents = fs.readdirSync(suppliersPath);
              
              const actualSupplierName = suppliersDirContents.find(name => 
                simplifyName(name) === simplifiedSupplierName
              );
              
              if (actualSupplierName && actualSupplierName !== simplifiedSupplierName) {
                updatedPathParts[suppliersIndex + 1] = actualSupplierName;
                correctedFolderPath = updatedPathParts.join('/');
              }
            }
          }
        }
      }
    }
    
    const fullFolderPath = path.join(companyDir, correctedFolderPath);
    
    if (!fs.existsSync(fullFolderPath) || !fs.statSync(fullFolderPath).isDirectory()) {
      return [];
    }
    
    const files: Array<{ name: string; path: string; size?: number; modified?: Date }> = [];
    
    try {
      const entries = fs.readdirSync(fullFolderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(fullFolderPath, entry.name);
          const stats = fs.statSync(filePath);
          files.push({
            name: entry.name,
            path: `${folderPath}/${entry.name}`,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
    } catch (error) {
      // Error reading folder
    }
    
    return files;
  }

  // Serve a file from a specific folder path on server
  async serveFileFromPath(companyId: number, filePath: string, forceDownload: boolean = false): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
    const company = await this.findCompanyById(companyId);
    
    // Try both paths: files/company/{companyName} and files/companies/{companyId}
    const repoRoot = this.getRepoRoot();
    
    // Also try common alternative paths
    const possibleRoots = [
      repoRoot,
      path.join(repoRoot, '..'), // One level up
      '/home/giurom', // Common production path
      '/var/www/giurom', // Alternative production path
      process.cwd(), // Current working directory
    ];
    
    let foundRoot = null;
    for (const root of possibleRoots) {
      const testFilesDir = path.join(root, 'files');
      if (fs.existsSync(testFilesDir)) {
        foundRoot = root;
        break;
      }
    }
    
    if (!foundRoot) {
      foundRoot = repoRoot;
    }
    
    const companyNamePath = path.join(foundRoot, 'files', 'company', company.company_name);
    const companyIdPath = path.join(foundRoot, 'files', 'companies', company.id.toString());
    
    // Check which path exists
    let companyDir = '';
    if (fs.existsSync(companyNamePath)) {
      companyDir = companyNamePath;
    } else if (fs.existsSync(companyIdPath)) {
      companyDir = companyIdPath;
    } else {
      throw new NotFoundException('Folderul companiei nu a fost găsit');
    }
    
    // Build full path to the file
    const fullFilePath = path.join(companyDir, filePath);
    
    if (!fs.existsSync(fullFilePath) || !fs.statSync(fullFilePath).isFile()) {
      throw new NotFoundException('Fișierul nu a fost găsit');
    }
    
    const fileName = path.basename(fullFilePath);
    const mimeType = this.getMimeType(fileName);
    const fileBuffer = fs.readFileSync(fullFilePath);
    
    return {
      data: fileBuffer.toString('base64'),
      mimeType,
      fileName,
      disposition: forceDownload ? 'attachment' : 'inline',
    };
  }

  async getCompanyStatistics(): Promise<{ total: number; active: number; inactive: number; vat_payers: number }> {
    const total = await this.companyRepository.count();
    const active = await this.companyRepository.count({ where: { status: 'activ' } });
    const inactive = await this.companyRepository.count({ where: { status: 'inactiv' } });
    const vat_payers = await this.companyRepository.count({ where: { vat_payer: true } });
    return { total, active, inactive, vat_payers };
  }

  // Find documents expiring on a specific date
  async findExpiringDocuments(targetDate: string): Promise<CompanyDocument[]> {
    // Format the date to match the database format (YYYY-MM-DD)
    const formattedDate = new Date(targetDate);
    formattedDate.setHours(0, 0, 0, 0);
    
    const documents = await this.companyDocumentRepository
      .createQueryBuilder('document')
      .where('DATE(document.expire_date) = :targetDate', { targetDate })
      .leftJoinAndSelect('document.company', 'company')
      .getMany();
    
    return documents;
  }

  // Find documents that have already expired
  async findExpiredDocuments(): Promise<CompanyDocument[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const documents = await this.companyDocumentRepository
      .createQueryBuilder('document')
      .where('document.expire_date < :today', { today })
      .andWhere('document.expire_date IS NOT NULL')
      .leftJoinAndSelect('document.company', 'company')
      .getMany();
    
    return documents;
  }
}