import { Controller, Get, Post, Delete, Body, Param, Inject, ParseIntPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('recipe-labels')
export class RecipeLabelsController {
  constructor(@Inject('RECIPES_SERVICE') private readonly client: ClientProxy) {}

  @Get()
  async findAll() {
    return await lastValueFrom(this.client.send('recipe-labels.findAll', {}));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipe-labels.findOne', id));
  }

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('recipe-labels.create', dto));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipe-labels.delete', id));
  }
}


