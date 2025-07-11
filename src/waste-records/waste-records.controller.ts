import { Controller, Get, Post, Body, Param, Patch, Delete, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { WasteRecordsService } from './waste-records.service';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';
import { WasteRecord } from './entities/waste-record.entity';

@ApiTags('waste-records')
@ApiBearerAuth()
@Controller('waste-records')
export class WasteRecordsController {
  constructor(private readonly service: WasteRecordsService) {}

  @Post()
  @ApiOperation({ summary: 'Crează înregistrare pierdere' })
  @ApiResponse({ status: HttpStatus.CREATED, type: WasteRecord })
  create(@Body() dto: CreateWasteRecordDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listă pierderi' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWasteRecordDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
} 