import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { EventSnapshot } from '../event-calendar.rules';

/** Content and original range are immutable; only lifecycle metadata may change. */
@Entity('event_publications')
@Index(['eventId', 'version'], { unique: true })
export class EventPublicationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid', name: 'event_id' }) eventId: string;
  @Column({ type: 'integer' }) version: number;
  @Index() @Column({ type: 'date', name: 'start_date' }) startDate: string;
  @Column({ type: 'date', name: 'end_date' }) endDate: string;
  @Column({ type: 'integer', name: 'display_order', default: 0 }) displayOrder: number;
  @Column({ type: 'jsonb' }) snapshot: EventSnapshot;
  @CreateDateColumn({ type: 'timestamptz', name: 'published_at' }) publishedAt: Date;
  @Column({ type: 'uuid', name: 'published_by' }) publishedBy: string;
  /** Exclusive cut-off: old dates remain accessible after stopping/replacing. */
  @Column({ type: 'date', name: 'stop_from', nullable: true }) stopFrom: string | null;
  @Column({ type: 'timestamptz', name: 'withdrawn_at', nullable: true }) withdrawnAt: Date | null;
}

@Entity('event_publication_actions')
export class EventPublicationActionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid', name: 'publication_id' }) publicationId: string;
  @Column({ type: 'uuid', name: 'actor_id' }) actorId: string;
  @Column({ type: 'varchar', length: 30 }) action: 'publish' | 'supersede' | 'stop_future' | 'withdraw_history';
  @Column({ type: 'text' }) reason: string;
  @Column({ type: 'jsonb', name: 'old_values', nullable: true }) oldValues: Record<string, unknown> | null;
  @Column({ type: 'jsonb', name: 'new_values' }) newValues: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
}
