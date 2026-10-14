import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive rollout only. Deliberately no historical publication backfill. */
export class AddEventPublications1763100000000 implements MigrationInterface {
  name = 'AddEventPublications1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE events
        ADD COLUMN media jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN slogan text NOT NULL DEFAULT '',
        ADD COLUMN extra_info text NOT NULL DEFAULT '',
        ADD COLUMN display_order integer NOT NULL DEFAULT 0;
      CREATE TABLE event_publications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        version integer NOT NULL CHECK (version > 0),
        start_date date NOT NULL,
        end_date date NOT NULL CHECK (end_date >= start_date),
        display_order integer NOT NULL DEFAULT 0,
        snapshot jsonb NOT NULL,
        published_at timestamptz NOT NULL DEFAULT now(),
        published_by uuid NOT NULL,
        stop_from date NULL,
        withdrawn_at timestamptz NULL,
        CONSTRAINT event_publications_version UNIQUE (event_id, version)
      );
      CREATE INDEX event_publications_dates ON event_publications(start_date, end_date);
      CREATE TABLE event_publication_actions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        publication_id uuid NOT NULL REFERENCES event_publications(id) ON DELETE RESTRICT,
        actor_id uuid NOT NULL,
        action varchar(30) NOT NULL,
        reason text NOT NULL,
        old_values jsonb NULL,
        new_values jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX event_publication_actions_publication ON event_publication_actions(publication_id);
    `);
    // Enforce immutable evidence in the database too, not merely in the API.
    await queryRunner.query(`
      CREATE FUNCTION protect_event_publication_snapshot() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Event publication history cannot be deleted';
        END IF;
        IF NEW.event_id IS DISTINCT FROM OLD.event_id OR
           NEW.version IS DISTINCT FROM OLD.version OR
           NEW.start_date IS DISTINCT FROM OLD.start_date OR
           NEW.end_date IS DISTINCT FROM OLD.end_date OR
           NEW.snapshot IS DISTINCT FROM OLD.snapshot OR
           NEW.display_order IS DISTINCT FROM OLD.display_order OR
           NEW.published_at IS DISTINCT FROM OLD.published_at OR
           NEW.published_by IS DISTINCT FROM OLD.published_by THEN
          RAISE EXCEPTION 'Event publication snapshot is immutable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER event_publications_immutable BEFORE UPDATE OR DELETE ON event_publications
        FOR EACH ROW EXECUTE FUNCTION protect_event_publication_snapshot();
    `);
  }

  async down(): Promise<void> {
    // A rollback must not erase publication evidence or media references.
    throw new Error('Event publication migration is additive and cannot be rolled back destructively');
  }
}
