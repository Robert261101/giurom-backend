import { Global, Module } from '@nestjs/common';
import { PlanAccessService, PlanFeatureGuard } from './plan-access.nest';

/**
 * Global so feature-module controllers (templates / assignments / executions)
 * can use `@UseGuards(PlanFeatureGuard)` without re-importing anything.
 */
@Global()
@Module({
  providers: [PlanAccessService, PlanFeatureGuard],
  exports: [PlanAccessService, PlanFeatureGuard],
})
export class PlanAccessModule {}
