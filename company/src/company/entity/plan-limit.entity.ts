import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('plan_limits')
@Unique('UQ_plan_limits_plan_key', ['plan_code', 'limit_key'])
export class PlanLimit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  plan_code: string;

  @Column({ type: 'varchar', length: 64 })
  limit_key: string;

  @Column({ type: 'int' })
  limit_value: number;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.limits, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_code', referencedColumnName: 'code' })
  plan?: SubscriptionPlan;

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updated_at: Date;
}
