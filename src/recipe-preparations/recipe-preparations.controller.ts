import { Controller, Post, Get, Patch, Delete, Body, Param, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RecipePreparationsService } from './recipe-preparations.service';
import { CreateRecipePreparationDto } from './dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './dto/update-recipe-preparation.dto';
import { RecipePreparation } from './entities/recipe-preparation.entity';

@ApiTags('recipes')
@Controller('recipe-preparations')
export class RecipePreparationsController {
  constructor(private readonly service: RecipePreparationsService) {}

  @Post()
  @ApiOperation({ summary: 'Creează o preparare de rețetă' })
  @ApiResponse({ status: HttpStatus.CREATED, type: RecipePreparation })
  create(@Body() dto: CreateRecipePreparationDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista preparărilor' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalii preparare' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizează prepararea' })
  @ApiParam({ name: 'id', example: 1 })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRecipePreparationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge prepararea' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
} 