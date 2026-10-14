import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('booking_submissions')
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

  @Index()
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
