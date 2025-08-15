import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, ParseIntPipe, Headers } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('calendar')
export class CalendarController {
  constructor(@Inject('CALENDAR_SERVICE') private readonly client: ClientProxy) {}

  @Post('recurrence-rule')
  async createRecurrence(@Body() dto: any) {
    return await lastValueFrom(this.client.send('calendar.recurrence.create', dto));
  }

  @Post('calendar-event')
  async createEvent(@Body() body: any, @Headers('x-user-id') userId?: string) {
    // Hard-coded for local testing: creator acts as 1 if not provided
    const currentUserId = userId ? parseInt(userId) : 1;

    // Support both direct DTO and the { event, recurrenceSettings } shape used by the frontend
    const hasWrappedShape = body && (body.event || body.recurrenceSettings);
    if (hasWrappedShape) {
      const eventDto = body.event ?? body.dto ?? body;
      if (!eventDto.created_by) eventDto.created_by = currentUserId;
      const recurrenceSettings = body.recurrenceSettings;

      if (recurrenceSettings?.enabled) {
        // Map recurrenceSettings -> CreateRecurrenceRuleDto
        const mapDay = (d: string) => {
          const m: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
          return m[d.toLowerCase()] ?? d;
        };
        const recurrenceDto = {
          frequency: recurrenceSettings.frequency,
          interval: 1,
          start_datetime: eventDto.start_datetime,
          end_datetime: recurrenceSettings.endDate ?? undefined,
          recurrence_days: Array.isArray(recurrenceSettings.days) && recurrenceSettings.days.length
            ? recurrenceSettings.days.map(mapDay).join(',')
            : undefined,
        };

        const recurrence = await lastValueFrom(this.client.send('calendar.recurrence.create', recurrenceDto));
        eventDto.recurrence_id = recurrence?.id;
      }

      return await lastValueFrom(this.client.send('calendar.events.create', { dto: eventDto, currentUserId }));
    }

    const dto = { ...(body ?? {}) };
    if (!dto.created_by) dto.created_by = currentUserId;
    return await lastValueFrom(this.client.send('calendar.events.create', { dto, currentUserId }));
  }

  @Get('calendar-events')
  async findEvents(@Query() filters: any, @Headers('x-user-id') userId?: string) {
    // Hard-coded for local testing: viewer acts as 1
    const currentUserId = userId ? parseInt(userId) : 1;
    return await lastValueFrom(this.client.send('calendar.events.find', { filters, currentUserId }));
  }

  @Patch('calendar-event/:id')
  async updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @Headers('x-user-id') userId?: string,
  ) {
    // Hard-coded for local testing: approver acts as 2
    const currentUserId = userId ? parseInt(userId) : 2;
    return await lastValueFrom(this.client.send('calendar.events.update', { id, dto, currentUserId }));
  }

  @Get('event/:id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Headers('x-user-id') userId?: string) {
    const currentUserId = userId ? parseInt(userId) : 1;
    return await lastValueFrom(this.client.send('calendar.events.findOne', { id, currentUserId }));
  }

  @Delete('event/:id')
  async delete(@Param('id', ParseIntPipe) id: number, @Headers('x-user-id') userId?: string) {
    const currentUserId = userId ? parseInt(userId) : 2;
    return await lastValueFrom(this.client.send('calendar.events.delete', { id, currentUserId }));
  }

  @Patch('event/:id/recurrence-end-date')
  async updateRecurrenceEndDate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Headers('x-user-id') userId?: string,
  ) {
    const currentUserId = userId ? parseInt(userId) : 2;
    const endDate = body?.endDate ?? body?.end_date;
    return await lastValueFrom(this.client.send('calendar.recurrence.endDate.update', { eventId: id, endDate, currentUserId }));
  }

  @Get('recurrence-rule/:id/generate-events')
  async generateRecurring(
    @Param('id', ParseIntPipe) recurrenceRuleId: number,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    return await lastValueFrom(this.client.send('calendar.recurrence.generate', { recurrenceRuleId, startDate, endDate }));
  }
}


