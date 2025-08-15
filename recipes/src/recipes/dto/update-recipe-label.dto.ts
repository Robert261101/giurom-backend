import { PartialType } from '@nestjs/swagger';
import { CreateRecipeLabelDto } from './create-recipe-label.dto';

export class UpdateRecipeLabelDto extends PartialType(CreateRecipeLabelDto) {}


