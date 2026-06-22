import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { EventCategoryService } from './event-category.service';
import { AuthOnly, Permissions } from './permissions/permissions.decorator';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';
import { EventCategory } from './entities/event-category.entity';

@ApiTags('calendar')
@Controller('calendar/categories')
@ApiBearerAuth()
export class EventCategoryController {
  constructor(private readonly categoryService: EventCategoryService) {}

  // POST /calendar/categories – creare categorie
  @Post()
  @Permissions('calendar.create')
  @ApiOperation({ summary: 'Creează o categorie de evenimente' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Categoria a fost creată cu succes',
    type: EventCategory,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru categorie',
  })
  create(@Body() createEventCategoryDto: CreateEventCategoryDto): Promise<EventCategory> {
    return this.categoryService.create(createEventCategoryDto);
  }

  // GET /calendar/categories – listare categorii
  @Get()
  @AuthOnly()
  @ApiOperation({ summary: 'Obține toate categoriile de evenimente' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista categoriilor de evenimente',
    type: [EventCategory],
  })
  findAll(): Promise<EventCategory[]> {
    return this.categoryService.findAll();
  }

  // GET /calendar/categories/:id – obținere categorie specifică
  @Get(':id')
  @AuthOnly()
  @ApiOperation({ summary: 'Obține o categorie de evenimente specifică' })
  @ApiParam({ name: 'id', description: 'ID-ul categoriei' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoria găsită',
    type: EventCategory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoria nu a fost găsită',
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<EventCategory> {
    return this.categoryService.findOne(id);
  }

  // PATCH /calendar/categories/:id – modificare categorie
  @Patch(':id')
  @Permissions('calendar.update')
  @ApiOperation({ summary: 'Modifică o categorie de evenimente' })
  @ApiParam({ name: 'id', description: 'ID-ul categoriei' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoria a fost modificată cu succes',
    type: EventCategory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoria nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru actualizare',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEventCategoryDto: UpdateEventCategoryDto,
  ): Promise<EventCategory> {
    return this.categoryService.update(id, updateEventCategoryDto);
  }

  // DELETE /calendar/categories/:id – ștergere categorie
  @Delete(':id')
  @Permissions('calendar.delete')
  @ApiOperation({ summary: 'Șterge o categorie de evenimente' })
  @ApiParam({ name: 'id', description: 'ID-ul categoriei' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Categoria a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoria nu a fost găsită',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoryService.remove(id);
  }
}