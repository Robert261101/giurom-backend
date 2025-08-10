import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WasteRecordsService } from '@/waste-records/waste-records.service';
import { CreateWasteRecordDto } from '@/waste-records/dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from '@/waste-records/dto/update-waste-record.dto';

@Controller()
export class WasteRecordsMicroController {
  constructor(private readonly service: WasteRecordsService) {}

  @MessagePattern('waste.create')
  create(@Payload() dto: CreateWasteRecordDto) { return this.service.create(dto); }

  @MessagePattern('waste.findAll')
  findAll() { return this.service.findAll(); }

  @MessagePattern('waste.findOne')
  findOne(@Payload() id: number) { return this.service.findOne(id); }

  @MessagePattern('waste.update')
  update(@Payload() payload: { id: number; dto: UpdateWasteRecordDto }) { return this.service.update(payload.id, payload.dto); }

  @MessagePattern('waste.remove')
  remove(@Payload() id: number) { return this.service.remove(id); }
}


