import { PartialType } from '@nestjs/swagger';
import { CreatePresenceInflexionDto } from './create-presence-inflexion.dto';

export class UpdatePresenceInflexionDto extends PartialType(CreatePresenceInflexionDto) {}