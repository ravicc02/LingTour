import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import type { PriceSnapshot, ProcessStatus, RequestPaymentStatus, RequestRequirements, ServicePackage, ServiceType } from '../service-packages';

@Entity('booking_submissions')
@Index(['userId', 'requestIdempotencyKey'], { unique: true })
export class BookingSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 300 })
  contact: string;

  @Column({ type: 'varchar', length: 200 })
  city: string;

  @Column({ type: 'date', name: 'service_date' })
  serviceDate: string;

  @Column({ type: 'varchar', length: 200, name: 'support_mode' })
  supportMode: string;

  @Column({ type: 'varchar', length: 100, name: 'group_size', nullable: true })
  groupSize: string | null;

  @Column({ type: 'text', name: 'route_or_need', nullable: true })
  routeOrNeed: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: string;

  @Column({ type: 'varchar', length: 100, name: 'idempotency_key', nullable: true })
  @Index({ unique: true })
  idempotencyKey: string | null;

  @Column({ type: 'uuid', name: 'assigned_interpreter_id', nullable: true })
  assignedInterpreterId: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'assigned_interpreter_name',
    nullable: true,
  })
  assignedInterpreterName: string | null;

  @Column({ type: 'varchar', length: 30, name: 'service_type', default: 'legacy_interpretation' })
  serviceType: ServiceType | 'legacy_interpretation';

  @Index()
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 100, name: 'city_slug', nullable: true })
  citySlug: string | null;

  @Column({ type: 'uuid', name: 'route_id', nullable: true })
  routeId: string | null;

  @Column({ type: 'uuid', name: 'linked_request_id', nullable: true })
  linkedRequestId: string | null;

  @Column({ type: 'uuid', name: 'preferred_interpreter_id', nullable: true })
  preferredInterpreterId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  requirements: RequestRequirements | null;

  @Column({ type: 'jsonb', name: 'package_snapshot', nullable: true })
  packageSnapshot: ServicePackage | null;

  @Column({ type: 'jsonb', name: 'price_snapshot', nullable: true })
  priceSnapshot: PriceSnapshot | null;

  @Column({ type: 'uuid', name: 'assigned_planner_id', nullable: true })
  assignedPlannerId: string | null;

  @Column({ type: 'varchar', length: 30, name: 'process_status', nullable: true })
  processStatus: ProcessStatus | null;

  @Column({ type: 'varchar', length: 30, name: 'request_payment_status', nullable: true })
  requestPaymentStatus: RequestPaymentStatus | null;

  @Column({ type: 'varchar', length: 80, name: 'request_idempotency_key', nullable: true })
  requestIdempotencyKey: string | null;

  @Column({ type: 'varchar', length: 64, name: 'request_input_hash', nullable: true })
  requestInputHash: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
