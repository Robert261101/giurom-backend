import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TaskTemplate } from './entity/task-template.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../permissions/permissions.decorator';

@ApiTags('Templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.create', 'suppliers.create')
  @ApiOperation({ summary: 'Creează un template nou cu elementele sale' })
  @ApiResponse({ 
    status: 201, 
    description: 'Template creat cu succes',
    type: TaskTemplate 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  create(@Body() createTemplateDto: CreateTemplateDto): Promise<TaskTemplate> {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.read', 'suppliers.create', 'assignment.create')
  @ApiOperation({ summary: 'Obține toate template-urile cu elementele lor pentru o locație specifică' })
  @ApiQuery({ name: 'locationId', required: true, description: 'ID-ul locației (OBLIGATORIU)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de template-uri pentru locația specificată',
    type: [TaskTemplate] 
  })
  @ApiResponse({ status: 400, description: 'locationId este obligatoriu' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  findAll(@Query('locationId') locationId: string): Promise<TaskTemplate[]> {
    
    if (!locationId) {
      throw new Error('locationId este obligatoriu pentru a obține template-urile');
    }
    
    const locationIdNumber = parseInt(locationId);
    if (isNaN(locationIdNumber)) {
      throw new Error('locationId trebuie să fie un număr valid');
    }
    
    return this.templateService.findAll(locationIdNumber);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.read', 'suppliers.create', 'assignment.create')
  @ApiOperation({ summary: 'Obține un template specific cu elementele sale pentru o locație specifică' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiQuery({ name: 'locationId', required: true, description: 'ID-ul locației (OBLIGATORIU)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Template găsit și disponibil în locația specificată',
    type: TaskTemplate 
  })
  @ApiResponse({ status: 400, description: 'locationId este obligatoriu' })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit sau nu este disponibil în locația specificată' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('locationId') locationId: string
  ): Promise<TaskTemplate> {
    
    if (!locationId) {
      throw new Error('locationId este obligatoriu pentru a obține template-ul');
    }
    
    const locationIdNumber = parseInt(locationId);
    if (isNaN(locationIdNumber)) {
      throw new Error('locationId trebuie să fie un număr valid');
    }
    
    return this.templateService.findOne(id, locationIdNumber);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.update', 'suppliers.create')
  @ApiOperation({ summary: 'Actualizează un template și elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Template actualizat cu succes',
    type: TaskTemplate 
  })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ): Promise<TaskTemplate> {
    return this.templateService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.delete', 'suppliers.create')
  @ApiOperation({ summary: 'Șterge un template și toate elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ status: 200, description: 'Template șters cu succes' })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.templateService.remove(id);
  }

  @Post(':id/locations/:locationId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.update', 'suppliers.create')
  @ApiOperation({ summary: 'Adaugă un template existent la o locație' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({ status: 201, description: 'Template adăugat la locație cu succes' })
  @ApiResponse({ status: 400, description: 'Template-ul este deja asignat la această locație' })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  addLocationToTemplate(
    @Param('id', ParseIntPipe) templateId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
  ): Promise<any> {
    return this.templateService.addLocationToTemplate(templateId, locationId);
  }

}
