import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RespondCalendarEventDto {
  @ApiProperty({
    description: 'Răspuns la invitație (doar meeting)',
    enum: ['accepted', 'declined'],
    example: 'accepted',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['accepted', 'declined'])
  response_status: 'accepted' | 'declined';
}
