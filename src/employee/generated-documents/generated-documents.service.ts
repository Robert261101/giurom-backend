import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { GeneratedDocuments } from '../entity/generated-documents.entity';
import { Employee } from '../entity/employee.entity';
import { CreateGeneratedDocumentDto } from './dto/create-generated-document.dto';
import { UpdateGeneratedDocumentDto } from './dto/update-generated-document.dto';

@Injectable()
export class GeneratedDocumentsService {
  constructor(
    @InjectRepository(GeneratedDocuments)
    private documentsRepository: Repository<GeneratedDocuments>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  // Creează un nou document generat
  async create(createDocumentDto: CreateGeneratedDocumentDto): Promise<GeneratedDocuments> {
    // Verifică dacă angajatul există
    const employee = await this.employeeRepository.findOne({
      where: { id: createDocumentDto.employee_id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${createDocumentDto.employee_id} nu a fost găsit`);
    }

    // Verifică dacă angajatul este activ
    if (!employee.is_active) {
      throw new BadRequestException('Nu se pot genera documente pentru un angajat inactiv');
    }

    // Verifică dacă există deja un document cu același doc_id și employee_id cu status activ
    const existingDocument = await this.documentsRepository.findOne({
      where: {
        employee_id: createDocumentDto.employee_id,
        doc_id: createDocumentDto.doc_id,
        status: 'Generated'
      }
    });

    if (existingDocument) {
      throw new ConflictException(`Există deja un document activ cu ID-ul ${createDocumentDto.doc_id} pentru acest angajat`);
    }

    // Validări de business pentru status și date
    if (createDocumentDto.status === 'Signed' && !createDocumentDto.signed_at) {
      throw new BadRequestException('Data semnării este obligatorie pentru documentele semnate');
    }

    if (createDocumentDto.signed_at && createDocumentDto.expired_date) {
      const signedDate = new Date(createDocumentDto.signed_at);
      const expiredDate = new Date(createDocumentDto.expired_date);
      
      if (signedDate >= expiredDate) {
        throw new BadRequestException('Data expirării trebuie să fie după data semnării');
      }
    }

    const document = this.documentsRepository.create(createDocumentDto);
    return await this.documentsRepository.save(document);
  }

  // Găsește toate documentele cu filtrare
  async findAll(
    page: number = 1,
    limit: number = 10,
    employee_id?: number,
    status?: string,
    doc_id?: number,
  ): Promise<{ documents: GeneratedDocuments[]; total: number; totalPages: number }> {
    const queryBuilder = this.documentsRepository.createQueryBuilder('document')
      .leftJoinAndSelect('document.employee', 'employee');

    // Aplică filtrele
    if (employee_id) {
      queryBuilder.andWhere('document.employee_id = :employee_id', { employee_id });
    }

    if (status) {
      queryBuilder.andWhere('document.status = :status', { status });
    }

    if (doc_id) {
      queryBuilder.andWhere('document.doc_id = :doc_id', { doc_id });
    }

    // Paginare
    const offset = (page - 1) * limit;
    const [documents, total] = await queryBuilder
      .orderBy('document.signed_at', 'DESC')
      .addOrderBy('document.id', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      documents,
      total,
      totalPages,
    };
  }

  // Găsește un document după ID
  async findOne(id: number): Promise<GeneratedDocuments> {
    const document = await this.documentsRepository.findOne({
      where: { id },
      relations: ['employee'],
    });

    if (!document) {
      throw new NotFoundException(`Documentul cu ID-ul ${id} nu a fost găsit`);
    }

    return document;
  }

  // Găsește toate documentele unui angajat
  async findByEmployee(employee_id: number): Promise<GeneratedDocuments[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
    }

    return await this.documentsRepository.find({
      where: { employee_id },
      relations: ['employee'],
      order: { signed_at: 'DESC', id: 'DESC' },
    });
  }

  // Găsește documente după status
  async findByStatus(status: string): Promise<GeneratedDocuments[]> {
    return await this.documentsRepository.find({
      where: { status },
      relations: ['employee'],
      order: { signed_at: 'DESC' },
    });
  }

  // Găsește documente după doc_id
  async findByDocId(doc_id: number): Promise<GeneratedDocuments[]> {
    return await this.documentsRepository.find({
      where: { doc_id },
      relations: ['employee'],
      order: { signed_at: 'DESC' },
    });
  }

  // Găsește documentele expirate
  async findExpiredDocuments(): Promise<GeneratedDocuments[]> {
    const currentDate = new Date();
    
    return await this.documentsRepository.find({
      where: {
        expired_date: LessThan(currentDate),
        status: 'Signed' // doar documentele semnate pot expira
      },
      relations: ['employee'],
      order: { expired_date: 'ASC' },
    });
  }

  // Actualizează un document
  async update(id: number, updateDocumentDto: UpdateGeneratedDocumentDto): Promise<GeneratedDocuments> {
    const document = await this.findOne(id);

    // Verifică FK-urile dacă sunt schimbate
    if (updateDocumentDto.employee_id && updateDocumentDto.employee_id !== document.employee_id) {
      const employee = await this.employeeRepository.findOne({
        where: { id: updateDocumentDto.employee_id }
      });

      if (!employee) {
        throw new NotFoundException(`Angajatul cu ID-ul ${updateDocumentDto.employee_id} nu a fost găsit`);
      }
    }

    // Validări de business pentru actualizare
    if (updateDocumentDto.status === 'Signed' && !updateDocumentDto.signed_at && !document.signed_at) {
      throw new BadRequestException('Data semnării este obligatorie pentru documentele semnate');
    }

    // Verifică consistența datelor
    const signedAt = updateDocumentDto.signed_at || document.signed_at;
    const expiredDate = updateDocumentDto.expired_date || document.expired_date;

    if (signedAt && expiredDate) {
      const signedDate = new Date(signedAt);
      const expiredDateObj = new Date(expiredDate);
      
      if (signedDate >= expiredDateObj) {
        throw new BadRequestException('Data expirării trebuie să fie după data semnării');
      }
    }

    await this.documentsRepository.update(id, updateDocumentDto);
    return await this.findOne(id);
  }

  // Semnează un document
  async signDocument(id: number): Promise<GeneratedDocuments> {
    const document = await this.findOne(id);

    if (document.status === 'Signed') {
      throw new BadRequestException('Documentul este deja semnat');
    }

    if (document.status === 'Expired' || document.status === 'Cancelled') {
      throw new BadRequestException('Nu se poate semna un document expirat sau anulat');
    }

    const updateData: UpdateGeneratedDocumentDto = {
      status: 'Signed',
      signed_at: new Date(),
    };

    await this.documentsRepository.update(id, updateData);
    return await this.findOne(id);
  }

  // Anulează un document
  async cancelDocument(id: number): Promise<GeneratedDocuments> {
    const document = await this.findOne(id);

    if (document.status === 'Cancelled') {
      throw new BadRequestException('Documentul este deja anulat');
    }

    if (document.status === 'Expired') {
      throw new BadRequestException('Nu se poate anula un document expirat');
    }

    await this.documentsRepository.update(id, { status: 'Cancelled' });
    return await this.findOne(id);
  }

  // Marchează documentele ca expirate (job programat)
  async markExpiredDocuments(): Promise<{ message: string; markedCount: number }> {
    const currentDate = new Date();
    
    const expiredDocuments = await this.documentsRepository.find({
      where: {
        expired_date: LessThan(currentDate),
        status: 'Signed'
      }
    });

    const markedCount = expiredDocuments.length;

    if (markedCount > 0) {
      await this.documentsRepository.update(
        { 
          expired_date: LessThan(currentDate), 
          status: 'Signed' 
        },
        { status: 'Expired' }
      );
    }

    return {
      message: `Au fost marcate ${markedCount} documente ca expirate`,
      markedCount,
    };
  }

  // Șterge un document
  async remove(id: number): Promise<{ message: string }> {
    const document = await this.findOne(id);
    
    if (document.status === 'Signed') {
      throw new BadRequestException('Nu se pot șterge documentele semnate. Vă rugăm să le anulați mai întâi.');
    }

    await this.documentsRepository.delete(id);
    
    return {
      message: `Documentul pentru angajatul ${document.employee.first_name} ${document.employee.last_name} a fost șters cu succes`,
    };
  }

  // Statistici documente
  async getStatistics(): Promise<{
    total: number;
    byStatus: { [key: string]: number };
    byEmployee: { [key: string]: number };
    expiringSoon: number;
    recentlySigned: number;
    byDocType: { [key: string]: number };
  }> {
    const total = await this.documentsRepository.count();

    // Statistici per status
    const statusStats = await this.documentsRepository.createQueryBuilder('document')
      .select('document.status', 'status')
      .addSelect('COUNT(document.id)', 'count')
      .groupBy('document.status')
      .getRawMany();

    const byStatus = statusStats.reduce((acc, curr) => {
      acc[curr.status] = parseInt(curr.count);
      return acc;
    }, {});

    // Statistici per angajat
    const employeeStats = await this.documentsRepository.createQueryBuilder('document')
      .select('document.employee_id', 'employee_id')
      .addSelect('COUNT(document.id)', 'count')
      .groupBy('document.employee_id')
      .getRawMany();

    const byEmployee = employeeStats.reduce((acc, curr) => {
      acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
      return acc;
    }, {});

    // Documente care expiră în următoarele 30 de zile
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringSoon = await this.documentsRepository.count({
      where: {
        expired_date: LessThan(thirtyDaysFromNow),
        status: 'Signed'
      }
    });

    // Documente semnate în ultimele 7 zile
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentlySigned = await this.documentsRepository.count({
      where: {
        signed_at: {
          $gte: sevenDaysAgo,
        } as any,
        status: 'Signed'
      }
    });

    // Statistici per tip de document
    const docTypeStats = await this.documentsRepository.createQueryBuilder('document')
      .select('document.doc_id', 'doc_id')
      .addSelect('COUNT(document.id)', 'count')
      .groupBy('document.doc_id')
      .getRawMany();

    const byDocType = docTypeStats.reduce((acc, curr) => {
      acc[`DocType_${curr.doc_id}`] = parseInt(curr.count);
      return acc;
    }, {});

    return {
      total,
      byStatus,
      byEmployee,
      expiringSoon,
      recentlySigned,
      byDocType,
    };
  }

  // Verifică dacă un document este valid și neexpirat
  async isDocumentValid(id: number): Promise<boolean> {
    const document = await this.findOne(id);
    
    if (document.status !== 'Signed') {
      return false;
    }

    if (document.expired_date && new Date(document.expired_date) < new Date()) {
      return false;
    }

    return true;
  }
} 