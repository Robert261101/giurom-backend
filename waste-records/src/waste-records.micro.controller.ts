import { Controller, Get, Post, Param, Patch, Body } from '@nestjs/common';
import { WasteRecordsService, CreateWasteRecordDto, UpdateWasteRecordDto } from './waste-records/waste-records.service';

@Controller('waste-records')
export class WasteRecordsMicroController {
  constructor(private readonly service: WasteRecordsService) {}

  @Post()
  create(@Body() dto: CreateWasteRecordDto) { return this.service.create(dto); }

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(Number(id)); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWasteRecordDto) { return this.service.update(Number(id), dto); }

  @Patch(':id/delete')
  remove(@Param('id') id: string) { return this.service.remove(Number(id)); }
}


