import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipeLabel } from './entities/recipe-label.entity';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { RecipeService } from './recipes.service';
import { RecipeAccessRequester, isRecipeAdminUser } from './recipe-access';

@Injectable()
export class RecipesLabelsService {
  private readonly employeesServiceUrl: string;

  constructor(
    @InjectRepository(RecipeLabel) private readonly labelRepo: Repository<RecipeLabel>,
    @InjectRepository(RecipePreparation) private readonly prepRepo: Repository<RecipePreparation>,
    @Inject('NOTIFICATIONS_RMQ') private readonly rmq: ClientProxy,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RecipeService))
    private readonly recipesService: RecipeService,
  ) {
    let employeesServiceUrl = this.configService.get<string>('EMPLOYEES_HTTP_URL') || 'http://localhost:3012';
    if (employeesServiceUrl.includes('bitap.ro') || employeesServiceUrl.includes(process.env.PUBLIC_SERVER_IP || '89.46.6.45')) {
      const portMatch = employeesServiceUrl.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '3012';
      employeesServiceUrl = `http://localhost:${port}`;
    }
    this.employeesServiceUrl = employeesServiceUrl;
  }

  private async assertLabelAccess(
    label: RecipeLabel,
    requester?: RecipeAccessRequester,
  ): Promise<void> {
    const prep = await this.prepRepo.findOne({
      where: { id: label.recipe_preparation_id },
    });
    if (!prep) {
      throw new NotFoundException('Label not found');
    }
    await this.recipesService.assertPreparationRecipeAccess(
      prep.recipe_id,
      prep.location_id,
      requester,
    );
  }

  async findAll(requester?: RecipeAccessRequester): Promise<any[]> {
    const labels = await this.labelRepo.find({ 
      order: { generated_at: 'DESC' },
      relations: ['preparation', 'preparation.recipe']
    });

    const filteredLabels =
      !requester || isRecipeAdminUser(requester.permissions || [])
        ? labels
        : (
            await Promise.all(
              labels.map(async (label) => {
                try {
                  await this.assertLabelAccess(label, requester);
                  return label;
                } catch {
                  return null;
                }
              }),
            )
          ).filter((label): label is RecipeLabel => label != null);

    // Populează numele angajaților pentru label-uri care au generated_by_employee_id
    const employeeIds = filteredLabels
      .map(label => label.generated_by_employee_id)
      .filter((id): id is number => id !== null && id !== undefined);
    
    const employeesMap = new Map<number, any>();
    
    if (employeeIds.length > 0 && this.httpService) {
      const serviceSecret = process.env.SERVICE_SECRET || '';
      const headers = {
        'Content-Type': 'application/json',
        'x-internal-service': 'recipes',
        'x-service-secret': serviceSecret
      };

      for (const employeeId of employeeIds) {
        try {
          const employeeResponse: any = await firstValueFrom(
            this.httpService.get(`${this.employeesServiceUrl}/employees/${employeeId}`, { headers })
          );
          const employeeData = employeeResponse?.data?.data || employeeResponse?.data || employeeResponse;
          if (employeeData) {
            employeesMap.set(employeeId, employeeData);
          }
        } catch (error: any) {
          // 404 means employee doesn't exist - this is normal, just skip
          if (error?.response?.status !== 404) {
            console.warn(`⚠️ [RECIPES LABELS SERVICE] Could not fetch employee ${employeeId}:`, error?.message);
          }
        }
      }
    }

    // Adaugă numele angajatului la fiecare label
    return filteredLabels.map(label => {
      const labelAny = label as any;
      if (label.generated_by_employee_id && employeesMap.has(label.generated_by_employee_id)) {
        const employee = employeesMap.get(label.generated_by_employee_id)!;
        labelAny.generated_by_name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() 
          || employee.email 
          || `Angajat ID: ${label.generated_by_employee_id}`;
      }
      return labelAny;
    });
  }

  async findOne(id: number, requester?: RecipeAccessRequester): Promise<RecipeLabel> {
    const label = await this.labelRepo.findOne({ where: { id } });
    if (!label) throw new NotFoundException('Label not found');
    await this.assertLabelAccess(label, requester);
    return label;
  }

  /**
   * Generează cod de etichetă în format: primele 3 inițiale din prenume + data (DDMMYYYY) + număr crescător
   * Exemplu: cos151120251 (Cosmin + 15.11.2025 + 1)
   */
  private async generateCode(user?: any): Promise<string> {
    // Obține primele 3 inițiale din prenumele angajatului din JWT (lowercase)
    const firstName = user?.first_name || user?.firstName || 'usr';
    const initials = firstName
      .toLowerCase()
      .replace(/[^a-zăâîșț]/g, '') // Elimină caractere non-alfabetice
      .substring(0, 3)
      .padEnd(3, 'x'); // Dacă are mai puțin de 3 caractere, completează cu 'x'
    
    // Obține data de astăzi în format DDMMYYYY
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${day}${month}${year}`;
    
    // Generează codul de bază: initials + date
    const baseCode = `${initials}${dateStr}`;
    
    // Găsește toate etichetele care au codul care începe cu baseCode (pentru a verifica numerele existente)
    // Nu verificăm după dată pentru că baseCode conține deja data de astăzi
    const existingLabels = await this.labelRepo
      .createQueryBuilder('label')
      .where('label.label_code LIKE :pattern', { pattern: `${baseCode}%` })
      .getMany();
    
    // Numără câte etichete au fost create cu același cod de bază
    // Extrage numărul final din fiecare cod existent
    const existingNumbers = existingLabels
      .map(label => {
        // Verifică dacă codul respectă formatul: baseCode + număr
        const match = label.label_code.match(new RegExp(`^${baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    // Găsește următorul număr disponibil
    const nextNumber = existingNumbers.length > 0 
      ? Math.max(...existingNumbers) + 1 
      : 1;
    
    // Generează codul final: initials + date + număr
    return `${baseCode}${nextNumber}`;
  }

  async create(
    dto: { recipe_preparation_id: number; label_code?: string },
    user?: any,
    requester?: RecipeAccessRequester,
  ): Promise<RecipeLabel> {
    const prep = await this.prepRepo.findOne({ where: { id: dto.recipe_preparation_id } });
    if (!prep) throw new NotFoundException('Preparation not found');
    await this.recipesService.assertPreparationRecipeAccess(
      prep.recipe_id,
      prep.location_id,
      requester,
    );
    // Dacă nu e furnizat un cod personalizat, generează-l automat
    const code = dto.label_code || await this.generateCode(user);
    
    // Verifică dacă codul există deja (trebuie să fie unic)
    // Notă: Nu verificăm aici pentru că generateCode() deja generează un număr unic
    // Dar dacă e furnizat manual un cod, verificăm unicitatea
    if (dto.label_code) {
      const existingLabel = await this.labelRepo.findOne({ where: { label_code: code } });
      if (existingLabel) {
        throw new NotFoundException(`Label code ${code} already exists. Please try again.`);
      }
    }
    
    // Obține employee_id din user (ar putea fi id, userId, sau id_employee)
    const employeeId = user?.id || user?.userId || user?.id_employee || null;
    
    const path = `/files/recipes/labels/${code}.pdf`;
    const label = this.labelRepo.create({ 
      recipe_preparation_id: prep.id, 
      label_code: code, 
      label_file_path: path,
      generated_by_employee_id: employeeId
    });
    const savedLabel = await this.labelRepo.save(label);

    // Update the preparation's is_labeled flag
    prep.is_labeled = true;
    await this.prepRepo.save(prep);

    // Notificare la admin și manager: s-a generat etichetă
    try {
      await firstValueFrom(
        this.rmq.emit({ cmd: 'recipes.notification' }, {
          type: 'label_generated',
          title: 'S-a generat etichetă',
          description: `S-a generat eticheta ${savedLabel.label_code} pentru preparatul ${prep.id}`,
          entity_id: savedLabel.id,
          entity_type: 'recipe_label',
          metadata: {
            preparationId: prep.id,
            labelCode: savedLabel.label_code,
            ...((prep as any).location_id != null ? { work_location_id: (prep as any).location_id } : {}),
          },
          priority: 'medium',
          target_url: '/retetar/istoric-etichete',
        })
      );
    } catch (e) {
      console.warn('Failed to send label_generated notification:', e);
    }

    return savedLabel;
  }

  async remove(id: number, requester?: RecipeAccessRequester): Promise<void> {
    const label = await this.labelRepo.findOne({ where: { id } });
    if (!label) throw new NotFoundException('Label not found');
    await this.assertLabelAccess(label, requester);
    await this.labelRepo.remove(label);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async emitExpiringLabelsNotifications(): Promise<void> {
    try {
      const now = new Date();
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Join to preparation -> recipe to compute expiration
      const labels = await this.labelRepo
        .createQueryBuilder('label')
        .leftJoinAndSelect('label.preparation', 'prep')
        .leftJoinAndSelect('prep.recipe', 'recipe')
        .where('prep.produced_at IS NOT NULL')
        .getMany();

      for (const label of labels) {
        const producedAt = label.preparation?.produced_at as unknown as Date;
        const expHours = (label.preparation?.recipe as any)?.expiration_hours || 48;
        if (!producedAt) continue;
        const expirationAt = new Date(producedAt);
        expirationAt.setHours(expirationAt.getHours() + expHours);

        if (expirationAt > now && expirationAt <= inTwoHours) {
          try {
            await firstValueFrom(this.rmq.emit({ cmd: 'labels.expiring-soon' }, {
              labelId: label.id,
              labelCode: label.label_code,
              preparationId: label.recipe_preparation_id,
              expiresAt: expirationAt.toISOString(),
            }));
          } catch {
            // Ignore transient RMQ errors
          }
        }
        if (expirationAt <= now) {
          try {
            await firstValueFrom(this.rmq.emit({ cmd: 'labels.expired' }, {
              labelId: label.id,
              labelCode: label.label_code,
              preparationId: label.recipe_preparation_id,
              expiresAt: expirationAt.toISOString(),
            }));
          } catch {
            // Ignore transient RMQ errors
          }
        }
      }
    } catch (error: any) {
      const message = String(error?.message || error);
      if (message.includes("doesn't exist")) {
        return;
      }
      throw error;
    }
  }
}


