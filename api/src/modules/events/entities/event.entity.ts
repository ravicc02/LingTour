import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const EVENT_STATUSES = ['upcoming', 'ongoing', 'past', 'draft'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

@Entity('events')
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @Column({ type: 'jsonb' })
  title: string;

  @Column({ type: 'jsonb', default: '' })
  summary: string;

  @Column({ type: 'jsonb', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  city: string;

  @Index()
  @Column({ type: 'varchar', length: 120, name: 'city_slug', default: '' })
  citySlug: string;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string | null;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  @Index()
  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: EventStatus;

  @Column({ type: 'jsonb', name: 'related_route_slugs', default: [] })
  relatedRouteSlugs: string[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
