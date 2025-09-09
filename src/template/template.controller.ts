import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TaskTemplate } from './entity/task-template.entity';
import { TemplateLocation } from './entity/template-location.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../permissions/permissions.decorator';

@ApiTags('Templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.create')
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
  @Permissions('template.read')
  @ApiOperation({ summary: 'Obține toate template-urile cu elementele lor' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de template-uri',
    type: [TaskTemplate] 
  })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  findAll(): Promise<TaskTemplate[]> {
    return this.templateService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.read')
  @ApiOperation({ summary: 'Obține un template specific cu elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Template găsit',
    type: TaskTemplate 
  })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TaskTemplate> {
    return this.templateService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('template.update')
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
  @Permissions('template.delete')
  @ApiOperation({ summary: 'Șterge un template și toate elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ status: 200, description: 'Template șters cu succes' })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.templateService.remove(id);
  }

  // ===== ENDPOINT-URI PENTRU GESTIONAREA LOCAȚIILOR =====

  @Post(':id/locations/:locationId')
  @ApiOperation({ summary: 'Adaugă o locație la un template' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({ 
    status: 201, 
    description: 'Locația adăugată cu succes la template',
    type: TemplateLocation 
  })
  @ApiResponse({ status: 400, description: 'Locația este deja asociată cu template-ul' })
  @ApiResponse({ status: 404, description: 'Template sau locație nu a fost găsit' })
  addLocationToTemplate(
    @Param('id', ParseIntPipe) templateId: number,
    @Param('locationId', ParseIntPipe) locationId: number
  ): Promise<TemplateLocation> {
    return this.templateService.addLocationToTemplate(templateId, locationId);
  }

  @Delete(':id/locations/:locationId')
  @ApiOperation({ summary: 'Șterge o locație de la un template' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({ status: 200, description: 'Locația ștearsă cu succes de la template' })
  @ApiResponse({ status: 404, description: 'Relația nu a fost găsită' })
  removeLocationFromTemplate(
    @Param('id', ParseIntPipe) templateId: number,
    @Param('locationId', ParseIntPipe) locationId: number
  ): Promise<void> {
    return this.templateService.removeLocationFromTemplate(templateId, locationId);
  }

  @Get(':id/locations')
  @ApiOperation({ summary: 'Obține toate locațiile unui template' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de locații asociate cu template-ul',
    type: [TemplateLocation] 
  })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  getTemplateLocations(@Param('id', ParseIntPipe) templateId: number): Promise<TemplateLocation[]> {
    return this.templateService.getTemplateLocations(templateId);
  }

  @Get('by-location/:locationId')
  @ApiOperation({ summary: 'Obține toate template-urile dintr-o locație' })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de template-uri din locația specificată',
    type: [TaskTemplate] 
  })
  getTemplatesForLocation(@Param('locationId', ParseIntPipe) locationId: number): Promise<TaskTemplate[]> {
    return this.templateService.getTemplatesForLocation(locationId);
  }

  @Get(':id/available-in-location/:locationId')
  @ApiOperation({ summary: 'Verifică dacă un template este disponibil într-o locație' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({ 
    status: 200, 
    description: 'Statusul disponibilității template-ului în locație',
    schema: { type: 'object', properties: { available: { type: 'boolean' } } }
  })
  isTemplateAvailableInLocation(
    @Param('id', ParseIntPipe) templateId: number,
    @Param('locationId', ParseIntPipe) locationId: number
  ): Promise<{ available: boolean }> {
    return this.templateService.isTemplateAvailableInLocation(templateId, locationId)
      .then(available => ({ available }));
  }
}
