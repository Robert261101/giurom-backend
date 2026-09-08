import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';

export type PlanFeatureCompanyType = 'client' | 'furnizor';

@Entity('plan_features')
@Unique('UQ_plan_features_plan_type_key', ['plan_code', 'company_type', 'feature_key'])
@Index('IDX_plan_features_type_plan', ['company_type', 'plan_code'])
export class PlanFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  plan_code: string;

  @Column({ type: 'enum', enum: ['client', 'furnizor'] })
  company_type: PlanFeatureCompanyType;

  @Column({ type: 'varchar', length: 64 })
  feature_key: string;

  @ManyToOne(() => SubscriptionPlan, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_code', referencedColumnName: 'code' })
  plan?: SubscriptionPlan;

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  created_at: Date;
}
