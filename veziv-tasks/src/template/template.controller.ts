import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TaskTemplate } from './entity/task-template.entity';

@ApiTags('Templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @ApiOperation({ summary: 'Creează un template nou cu elementele sale' })
  @ApiResponse({ 
    status: 201, 
    description: 'Template creat cu succes',
    type: TaskTemplate 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  create(@Body() createTemplateDto: CreateTemplateDto): Promise<TaskTemplate> {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obține toate template-urile cu elementele lor' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de template-uri',
    type: [TaskTemplate] 
  })
  findAll(): Promise<TaskTemplate[]> {
    return this.templateService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obține un template specific cu elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Template găsit',
    type: TaskTemplate 
  })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TaskTemplate> {
    return this.templateService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizează un template și elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Template actualizat cu succes',
    type: TaskTemplate 
  })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ): Promise<TaskTemplate> {
    return this.templateService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge un template și toate elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul template-ului' })
  @ApiResponse({ status: 200, description: 'Template șters cu succes' })
  @ApiResponse({ status: 404, description: 'Template nu a fost găsit' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.templateService.remove(id);
  }
}
