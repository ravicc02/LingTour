import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive only: legacy booking/order amounts and currencies are never rewritten. */
export class AddServiceRequests1763400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE booking_submissions
      ADD COLUMN service_type varchar(30) NOT NULL DEFAULT 'legacy_interpretation',
      ADD COLUMN user_id uuid NULL REFERENCES users(id),
      ADD COLUMN city_slug varchar(100) NULL,
      ADD COLUMN route_id uuid NULL,
      ADD COLUMN linked_request_id uuid NULL REFERENCES booking_submissions(id),
      ADD COLUMN preferred_interpreter_id uuid NULL,
      ADD COLUMN requirements jsonb NULL,
      ADD COLUMN package_snapshot jsonb NULL,
      ADD COLUMN price_snapshot jsonb NULL,
      ADD COLUMN assigned_planner_id uuid NULL REFERENCES users(id),
      ADD COLUMN process_status varchar(30) NULL,
      ADD COLUMN request_payment_status varchar(30) NULL,
      ADD COLUMN request_idempotency_key varchar(80) NULL,
      ADD COLUMN request_input_hash varchar(64) NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX service_request_owner_idempotency_idx ON booking_submissions(user_id, request_idempotency_key)`);
    await queryRunner.query(`CREATE INDEX service_request_owner_idx ON booking_submissions(user_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX service_request_triage_idx ON booking_submissions(service_type, process_status, created_at DESC)`);
    await queryRunner.query(`CREATE TABLE service_request_messages (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), request_id uuid NOT NULL REFERENCES booking_submissions(id),
      sequence integer NOT NULL CHECK(sequence > 0), sender_id uuid NOT NULL REFERENCES users(id),
      sender_type varchar(10) NOT NULL CHECK(sender_type IN ('owner','staff')),
      body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000), idempotency_key varchar(80) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id, sequence), UNIQUE(request_id, sender_id, idempotency_key))`);
    await queryRunner.query(`CREATE TABLE service_request_reads (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), request_id uuid NOT NULL REFERENCES booking_submissions(id),
      user_id uuid NOT NULL REFERENCES users(id), last_sequence integer NOT NULL DEFAULT 0 CHECK(last_sequence >= 0), UNIQUE(request_id, user_id))`);
    await queryRunner.query(`CREATE TABLE service_request_quotes (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), request_id uuid NOT NULL REFERENCES booking_submissions(id),
      revision integer NOT NULL CHECK(revision > 0), amount_cents integer NOT NULL CHECK(amount_cents > 0),
      currency varchar(3) NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'), scope text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','accepted','superseded')),
      offered_by uuid NOT NULL REFERENCES users(id), accepted_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id, revision))`);
    await queryRunner.query(`CREATE TABLE service_request_assignments (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), request_id uuid NOT NULL REFERENCES booking_submissions(id),
      assigned_by uuid NOT NULL REFERENCES users(id), planner_id uuid NOT NULL REFERENCES users(id),
      previous_planner_id uuid NULL REFERENCES users(id), interpreter_id uuid NULL,
      reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX service_request_assignments_history_idx ON service_request_assignments(request_id, created_at)`);
  }
  public async down(): Promise<void> {
    // Production request/conversation/quote history must not be silently dropped.
    // A rollback needs an explicitly authorized backup + data-preserving plan.
    throw new Error('Service request rollback requires a data-preserving recovery plan');
  }
}
