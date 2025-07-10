import { Controller, Get, Post, Param, Body, Delete, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { RecipeLabelsService } from './recipe-labels.service';
import { CreateRecipeLabelDto } from './dto/create-recipe-label.dto';
import { RecipeLabel } from './entities/recipe-label.entity';

@ApiTags('recipe-labels')
@ApiBearerAuth()
@Controller('recipe-labels')
export class RecipeLabelsController {
  constructor(private readonly service: RecipeLabelsService) {}

  @Get()
  @ApiOperation({ summary: 'Listă etichete' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiParam({ name: 'id', example: 1 })
  @ApiOperation({ summary: 'Detalii etichetă' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Creare etichetă manuală' })
  @ApiResponse({ status: HttpStatus.CREATED, type: RecipeLabel })
  create(@Body() dto: CreateRecipeLabelDto) {
    return this.service.createManual(dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
} 