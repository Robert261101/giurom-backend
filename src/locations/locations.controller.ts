import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LocationsService } from './locations.service';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './dto/update-task-template-assignment.dto';
import { WorkLocation } from './entity/work-location.entity';
import { WorkLocationTaskTemplate } from './entity/work-location-task-template.entity';

@ApiTags('locations')
@Controller('locations')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ===================== WORK LOCATION OPERATIONS =====================

  @Post()
  @ApiOperation({
    summary: 'Creează o nouă locație de lucru',
    description: 'Adaugă o nouă locație de lucru pentru o companie existentă',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Locația a fost creată cu succes',
    type: WorkLocation,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Compania nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date de intrare invalide',
  })
  async createWorkLocation(
    @Body() createWorkLocationDto: CreateWorkLocationDto,
  ): Promise<WorkLocation> {
    return await this.locationsService.createWorkLocation(createWorkLocationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Returnează lista locațiilor de lucru',
    description: 'Returnează o listă paginată de locații cu opțiuni de filtrare și căutare',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numărul paginii (implicit: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Numărul de elemente per pagină (implicit: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    type: Number,
    description: 'Filtrează după ID-ul companiei',
    example: 1,
  })
  @ApiQuery({
    name: 'city',
    required: false,
    type: String,
    description: 'Filtrează după oraș',
    example: 'București',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Căutare după numele locației sau adresă',
    example: 'Sediul Central',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista locațiilor a fost returnată cu succes',
  })
  async findAllWorkLocations(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: number,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ): Promise<{ locations: WorkLocation[]; total: number; totalPages: number }> {
    return await this.locationsService.findAllWorkLocations(
      page || 1,
      limit || 10,
      companyId,
      city,
      search,
    );
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Returnează statistici despre locații',
    description: 'Returnează numărul total de locații, distribuția pe companii și atribuiri de template-uri',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost returnate cu succes',
  })
  async getLocationStatistics(): Promise<{
    total_locations: number;
    locations_by_company: { company_id: number; company_name: string; count: number }[];
    total_assignments: number;
    active_assignments: number;
  }> {
    return await this.locationsService.getLocationStatistics();
  }

  @Get('company/:companyId')
  @ApiOperation({
    summary: 'Returnează locațiile unei companii',
    description: 'Returnează toate locațiile de lucru ale unei companii specifice',
  })
  @ApiParam({
    name: 'companyId',
    type: Number,
    description: 'ID-ul companiei',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista locațiilor companiei a fost returnată cu succes',
    type: [WorkLocation],
  })
  async findWorkLocationsByCompany(
    @Param('companyId', ParseIntPipe) companyId: number,
  ): Promise<WorkLocation[]> {
    return await this.locationsService.findWorkLocationsByCompany(companyId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Returnează o locație după ID',
    description: 'Returnează detaliile complete ale unei locații incluzând compania și template-urile',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID-ul locației',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Locația a fost găsită',
    type: WorkLocation,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Locația nu a fost găsită',
  })
  async findWorkLocationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<WorkLocation> {
    return await this.locationsService.findWorkLocationById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizează o locație',
    description: 'Actualizează datele unei locații de lucru existente',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID-ul locației de actualizat',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Locația a fost actualizată cu succes',
    type: WorkLocation,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Locația nu a fost găsită',
  })
  async updateWorkLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkLocationDto: UpdateWorkLocationDto,
  ): Promise<WorkLocation> {
    return await this.locationsService.updateWorkLocation(id, updateWorkLocationDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Șterge o locație',
    description: 'Șterge definitiv o locație din sistem (incluzând template-urile asociate)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID-ul locației de șters',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Locația a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Locația nu a fost găsită',
  })
  async removeWorkLocation(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.locationsService.removeWorkLocation(id);
  }

  // ===================== TASK TEMPLATE ASSIGNMENT OPERATIONS =====================

  @Post('assignments')
  @ApiOperation({
    summary: 'Atribuie un template de sarcină la o locație',
    description: 'Creează o nouă atribuire între o locație de lucru și un template de sarcină',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Template-ul a fost atribuit cu succes',
    type: WorkLocationTaskTemplate,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Locația nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Template-ul este deja atribuit activ la această locație',
  })
  async createTaskTemplateAssignment(
    @Body() createAssignmentDto: CreateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    return await this.locationsService.createTaskTemplateAssignment(createAssignmentDto);
  }

  @Get('assignments')
  @ApiOperation({
    summary: 'Returnează lista atribuirilor de template-uri',
    description: 'Returnează o listă paginată de atribuiri cu opțiuni de filtrare',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numărul paginii (implicit: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Numărul de elemente per pagină (implicit: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'locationId',
    required: false,
    type: Number,
    description: 'Filtrează după ID-ul locației',
    example: 1,
  })
  @ApiQuery({
    name: 'templateId',
    required: false,
    type: Number,
    description: 'Filtrează după ID-ul template-ului',
    example: 1,
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filtrează după statusul activ',
    example: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista atribuirilor a fost returnată cu succes',
  })
  async findAllTaskTemplateAssignments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('locationId') locationId?: number,
    @Query('templateId') templateId?: number,
    @Query('active', ParseBoolPipe) active?: boolean,
  ): Promise<{
    assignments: WorkLocationTaskTemplate[];
    total: number;
    totalPages: number;
  }> {
    return await this.locationsService.findAllTaskTemplateAssignments(
      page || 1,
      limit || 10,
      locationId,
      templateId,
      active,
    );
  }

  @Get(':locationId/assignments')
  @ApiOperation({
    summary: 'Returnează atribuirile unei locații',
    description: 'Returnează toate atribuirile de template-uri pentru o locație specifică',
  })
  @ApiParam({
    name: 'locationId',
    type: Number,
    description: 'ID-ul locației',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista atribuirilor locației a fost returnată cu succes',
    type: [WorkLocationTaskTemplate],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Locația nu a fost găsită',
  })
  async findTaskTemplateAssignmentsByLocation(
    @Param('locationId', ParseIntPipe) locationId: number,
  ): Promise<WorkLocationTaskTemplate[]> {
    return await this.locationsService.findTaskTemplateAssignmentsByLocation(locationId);
  }

  @Get('assignments/:assignmentId')
  @ApiOperation({
    summary: 'Returnează o atribuire după ID',
    description: 'Returnează detaliile unei atribuiri specifice de template',
  })
  @ApiParam({
    name: 'assignmentId',
    type: Number,
    description: 'ID-ul atribuirii',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Atribuirea a fost găsită',
    type: WorkLocationTaskTemplate,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Atribuirea nu a fost găsită',
  })
  async findTaskTemplateAssignmentById(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<WorkLocationTaskTemplate> {
    return await this.locationsService.findTaskTemplateAssignmentById(assignmentId);
  }

  @Patch('assignments/:assignmentId')
  @ApiOperation({
    summary: 'Actualizează o atribuire',
    description: 'Actualizează informațiile unei atribuiri de template existente',
  })
  @ApiParam({
    name: 'assignmentId',
    type: Number,
    description: 'ID-ul atribuirii de actualizat',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Atribuirea a fost actualizată cu succes',
    type: WorkLocationTaskTemplate,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Atribuirea nu a fost găsită',
  })
  async updateTaskTemplateAssignment(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() updateAssignmentDto: UpdateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    return await this.locationsService.updateTaskTemplateAssignment(
      assignmentId,
      updateAssignmentDto,
    );
  }

  @Patch('assignments/:assignmentId/toggle')
  @ApiOperation({
    summary: 'Activează/dezactivează o atribuire',
    description: 'Schimbă statusul unei atribuiri între activ și inactiv',
  })
  @ApiParam({
    name: 'assignmentId',
    type: Number,
    description: 'ID-ul atribuirii',
    example: 1,
  })
  @ApiQuery({
    name: 'active',
    type: Boolean,
    description: 'Noul status (true pentru activ, false pentru inactiv)',
    example: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statusul atribuirii a fost schimbat cu succes',
    type: WorkLocationTaskTemplate,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Atribuirea nu a fost găsită',
  })
  async toggleAssignmentStatus(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Query('active', ParseBoolPipe) active: boolean,
  ): Promise<WorkLocationTaskTemplate> {
    return await this.locationsService.toggleAssignmentStatus(assignmentId, active);
  }

  @Delete('assignments/:assignmentId')
  @ApiOperation({
    summary: 'Șterge o atribuire',
    description: 'Șterge definitiv o atribuire de template din sistem',
  })
  @ApiParam({
    name: 'assignmentId',
    type: Number,
    description: 'ID-ul atribuirii de șters',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Atribuirea a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Atribuirea nu a fost găsită',
  })
  async removeTaskTemplateAssignment(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<void> {
    return await this.locationsService.removeTaskTemplateAssignment(assignmentId);
  }

  @Patch('templates/:templateId/deactivate')
  @ApiOperation({
    summary: 'Dezactivează toate atribuirile unui template',
    description: 'Dezactivează toate atribuirile active pentru un template specific',
  })
  @ApiParam({
    name: 'templateId',
    type: Number,
    description: 'ID-ul template-ului',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Toate atribuirile template-ului au fost dezactivate cu succes',
  })
  async deactivateTemplateAssignments(
    @Param('templateId', ParseIntPipe) templateId: number,
  ): Promise<void> {
    return await this.locationsService.deactivateTemplateAssignments(templateId);
  }
} 