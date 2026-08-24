REVOKE UPDATE (
  goal_summary,
  biography,
  training_experience,
  athlete_context,
  training_preferences,
  available_equipment,
  schedule_context,
  athlete_reported_limitations
) ON app.athlete_profiles FROM ai_strength_app;

DROP POLICY IF EXISTS users_select_current_coaching_identity ON app.users;
DROP POLICY IF EXISTS athlete_profiles_update_self ON app.athlete_profiles;
DROP POLICY IF EXISTS athlete_profiles_select_current_trainer ON app.athlete_profiles;

ALTER TABLE app.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profile_limitations_length,
  DROP CONSTRAINT IF EXISTS athlete_profile_schedule_length,
  DROP CONSTRAINT IF EXISTS athlete_profile_equipment_count,
  DROP CONSTRAINT IF EXISTS athlete_profile_preferences_count,
  DROP CONSTRAINT IF EXISTS athlete_profile_context_length,
  DROP CONSTRAINT IF EXISTS athlete_profile_experience_length,
  DROP CONSTRAINT IF EXISTS athlete_profile_biography_length,
  DROP CONSTRAINT IF EXISTS athlete_profile_goal_length,
  DROP COLUMN IF EXISTS athlete_reported_limitations,
  DROP COLUMN IF EXISTS schedule_context,
  DROP COLUMN IF EXISTS available_equipment,
  DROP COLUMN IF EXISTS training_preferences,
  DROP COLUMN IF EXISTS athlete_context,
  DROP COLUMN IF EXISTS training_experience,
  DROP COLUMN IF EXISTS biography,
  DROP COLUMN IF EXISTS goal_summary;
