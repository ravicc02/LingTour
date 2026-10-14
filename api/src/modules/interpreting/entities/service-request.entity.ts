import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('service_request_messages')
@Index(['requestId', 'sequence'], { unique: true })
@Index(['requestId', 'senderId', 'idempotencyKey'], { unique: true })
export class ServiceRequestMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'request_id' }) requestId: string;
  @Column({ type: 'int' }) sequence: number;
  @Column({ type: 'uuid', name: 'sender_id' }) senderId: string;
  @Column({ type: 'varchar', length: 10, name: 'sender_type' }) senderType: 'owner' | 'staff';
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'varchar', length: 80, name: 'idempotency_key' }) idempotencyKey: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
}

@Entity('service_request_reads')
@Index(['requestId', 'userId'], { unique: true })
export class ServiceRequestRead {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'request_id' }) requestId: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId: string;
  @Column({ type: 'int', name: 'last_sequence', default: 0 }) lastSequence: number;
}

@Entity('service_request_quotes')
@Index(['requestId', 'revision'], { unique: true })
export class ServiceRequestQuote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'request_id' }) requestId: string;
  @Column({ type: 'int' }) revision: number;
  @Column({ type: 'int', name: 'amount_cents' }) amountCents: number;
  @Column({ type: 'varchar', length: 3, default: 'USD' }) currency: 'USD';
  @Column({ type: 'text' }) scope: string;
  @Column({ type: 'varchar', length: 20, default: 'offered' }) status: 'offered' | 'accepted' | 'superseded';
  @Column({ type: 'uuid', name: 'offered_by' }) offeredBy: string;
  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true }) acceptedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
}

@Entity('service_request_assignments')
@Index(['requestId', 'createdAt'])
export class ServiceRequestAssignment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'request_id' }) requestId: string;
  @Column({ type: 'uuid', name: 'assigned_by' }) assignedBy: string;
  @Column({ type: 'uuid', name: 'planner_id' }) plannerId: string;
  @Column({ type: 'uuid', name: 'previous_planner_id', nullable: true }) previousPlannerId: string | null;
  @Column({ type: 'uuid', name: 'interpreter_id', nullable: true }) interpreterId: string | null;
  @Column({ type: 'text', default: '' }) reason: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
}
