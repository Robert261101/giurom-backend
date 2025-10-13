import { Controller, Get, Post, Param, Patch, Body } from '@nestjs/common';
import { Permissions } from './permissions/permissions.decorator';
import { WasteRecordsService, CreateWasteRecordDto, UpdateWasteRecordDto } from './waste-records/waste-records.service';

@Controller('waste-records')
export class WasteRecordsMicroController {
  constructor(private readonly service: WasteRecordsService) {}

  @Post()
  @Permissions('waste-records.create')
  create(@Body() dto: CreateWasteRecordDto) { return this.service.create(dto); }

  @Get()
  @Permissions('waste-records.read')
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Permissions('waste-records.read')
  findOne(@Param('id') id: string) { return this.service.findOne(Number(id)); }

  @Patch(':id')
  @Permissions('waste-records.update')
  update(@Param('id') id: string, @Body() dto: UpdateWasteRecordDto) { return this.service.update(Number(id), dto); }

  @Patch(':id/delete')
  @Permissions('waste-records.delete')
  remove(@Param('id') id: string) { return this.service.remove(Number(id)); }
}


