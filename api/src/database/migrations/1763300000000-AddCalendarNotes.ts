import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendarNotes1763300000000 implements MigrationInterface {
  name = 'AddCalendarNotes1763300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE calendar_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        date date NOT NULL,
        title varchar(160) NOT NULL,
        body text NOT NULL DEFAULT '',
        city_slug varchar(100),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_calendar_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT ck_calendar_notes_date CHECK (date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
        CONSTRAINT ck_calendar_notes_title CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
        CONSTRAINT ck_calendar_notes_body CHECK (char_length(body) <= 10000)
      );
      CREATE INDEX idx_calendar_notes_user_date ON calendar_notes(user_id, date);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting this migration removes private notes; requires an explicit backup/approval.
    await queryRunner.query('DROP TABLE calendar_notes');
  }
}
