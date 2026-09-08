import { Controller, Get, Post, Param, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { PlanFeatureGuard, RequiresPlanFeature } from './plan-access/plan-access.nest';
import { Request } from 'express';
import { Permissions } from './permissions/permissions.decorator';
import {
  WasteRecordsService,
  CreateWasteRecordDto,
  UpdateWasteRecordDto,
} from './waste-records/waste-records.service';
import type { WasteRecordsJwtUser } from './waste-records-access';

type AuthedRequest = Request & { user?: WasteRecordsJwtUser };

@Controller('waste-records')
// Subscription gate (after RBAC): waste records require the "arunca_consuma" feature.
@RequiresPlanFeature('arunca_consuma')
@UseGuards(PlanFeatureGuard)
export class WasteRecordsMicroController {
  constructor(private readonly service: WasteRecordsService) {}

  @Post()
  @Permissions('waste-records.create')
  create(@Req() req: AuthedRequest, @Body() dto: CreateWasteRecordDto) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Permissions('waste-records.read')
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAll(req.user);
  }

  @Get(':id')
  @Permissions('waste-records.read')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(Number(id), req.user);
  }

  @Patch(':id')
  @Permissions('waste-records.update')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWasteRecordDto,
  ) {
    return this.service.update(Number(id), dto, req.user);
  }

  @Patch(':id/delete')
  @Permissions('waste-records.delete')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(Number(id), req.user);
  }
}
