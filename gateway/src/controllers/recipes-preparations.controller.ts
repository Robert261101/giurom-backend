import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, ParseIntPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('recipe-preparations')
export class RecipePreparationsController {
  constructor(@Inject('RECIPES_SERVICE') private readonly client: ClientProxy) {}

  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return await lastValueFrom(this.client.send('recipe-preparations.findAll', { page, limit }));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipe-preparations.findOne', id));
  }

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('recipe-preparations.create', dto));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('recipe-preparations.update', { id, dto }));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipe-preparations.delete', id));
  }

  // Composite operation: prepare with stock (delegated to recipes MS for now)
  @Post('prepare-with-stock')
  async prepareWithStock(@Body() dto: any) {
    return await lastValueFrom(this.client.send('recipe-preparations.prepareWithStock', dto));
  }
}


