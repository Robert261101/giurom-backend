import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('test-auth')
export class ExampleAuthController {
  @Get('secure-read')
  @Permissions('recipes.read')
  secureRead() {
    return { ok: true, scope: 'recipes.read' };
  }

  @Get('secure-delete')
  @Permissions('recipes.delete')
  secureDelete() {
    return { ok: true, scope: 'recipes.delete' };
  }
}



