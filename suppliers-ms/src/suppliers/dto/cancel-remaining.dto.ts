import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelRemainingDto {
  @ApiProperty({ 
    description: 'Motivul anulării (opțional)', 
    required: false,
    default: 'Anulat - partea rămasă de recepționat'
  })
  @IsString()
  @IsOptional()
  reason?: string;
}



export class CancelRemainingDto {
  @ApiProperty({ 
    description: 'Motivul anulării (opțional)', 
    required: false,
    default: 'Anulat - partea rămasă de recepționat'
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

