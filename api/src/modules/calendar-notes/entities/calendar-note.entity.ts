import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('calendar_notes')
@Index('idx_calendar_notes_user_date', ['userId', 'date'])
export class CalendarNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  // A civil date, never converted through the browser/server's local timezone.
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'varchar', length: 100, name: 'city_slug', nullable: true })
  citySlug: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
