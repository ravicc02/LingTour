import { MigrationInterface, QueryRunner } from 'typeorm';

/** Add explicit associations only. Legacy location/route are not backfilled. */
export class AddCommunityAssociations1763200000000 implements MigrationInterface {
  name = 'AddCommunityAssociations1763200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE community_posts
      ADD COLUMN IF NOT EXISTS city_slug varchar(100),
      ADD COLUMN IF NOT EXISTS route_id uuid,
      ADD COLUMN IF NOT EXISTS interpreter_id uuid,
      ADD COLUMN IF NOT EXISTS verified_experience boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS verified_booking_id uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_community_city ON community_posts (city_slug, status, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_community_route ON community_posts (route_id, status, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_community_interpreter ON community_posts (interpreter_id, status, created_at DESC)`);
    await queryRunner.query(`ALTER TABLE community_posts
      ADD CONSTRAINT fk_community_city FOREIGN KEY (city_slug) REFERENCES cities(slug) ON DELETE SET NULL ON UPDATE CASCADE,
      ADD CONSTRAINT fk_community_route FOREIGN KEY (route_id) REFERENCES story_routes(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_community_interpreter FOREIGN KEY (interpreter_id) REFERENCES interpreter_profiles(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_community_verified_booking FOREIGN KEY (verified_booking_id) REFERENCES booking_submissions(id) ON DELETE SET NULL`);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Community associations/evidence rollback would discard data. Restore a verified backup or use an explicitly approved data-preserving migration plan.');
  }
}
