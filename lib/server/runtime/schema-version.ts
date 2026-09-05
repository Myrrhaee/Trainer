export const expectedSchemaMigrations = [
  "0001_backend_foundation",
  "0002_email_otp",
  "0003_federated_identity",
  "0004_capabilities_and_invitations",
  "0005_workout_templates_and_assignments",
  "0006_workout_builder_lifecycle",
  "0007_workout_session_execution",
  "0008_workout_review_feedback",
  "0009_deployment_readiness",
  "0010_notification_outbox",
  "0011_closed_alpha_operator",
  "0012_athlete_profile_read_model",
  "0013_workout_template_revision_lifecycle",
  "0014_canonical_exercise_library",
  "0015_workout_template_command_hardening",
  "0016_workout_session_completion",
] as const;

export const expectedSchemaMigration = expectedSchemaMigrations.at(-1)!;
export const expectedSchemaMigrationCount = expectedSchemaMigrations.length;
