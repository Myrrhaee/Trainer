ALTER TABLE app.athlete_profiles
  ADD COLUMN goal_summary text,
  ADD COLUMN biography text,
  ADD COLUMN training_experience text,
  ADD COLUMN athlete_context text,
  ADD COLUMN training_preferences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN available_equipment text[] NOT NULL DEFAULT '{}',
  ADD COLUMN schedule_context text,
  ADD COLUMN athlete_reported_limitations text;

ALTER TABLE app.athlete_profiles
  ADD CONSTRAINT athlete_profile_goal_length
    CHECK (goal_summary IS NULL OR char_length(goal_summary) <= 500),
  ADD CONSTRAINT athlete_profile_biography_length
    CHECK (biography IS NULL OR char_length(biography) <= 2000),
  ADD CONSTRAINT athlete_profile_experience_length
    CHECK (training_experience IS NULL OR char_length(training_experience) <= 1000),
  ADD CONSTRAINT athlete_profile_context_length
    CHECK (athlete_context IS NULL OR char_length(athlete_context) <= 2000),
  ADD CONSTRAINT athlete_profile_preferences_count
    CHECK (cardinality(training_preferences) <= 20),
  ADD CONSTRAINT athlete_profile_equipment_count
    CHECK (cardinality(available_equipment) <= 50),
  ADD CONSTRAINT athlete_profile_schedule_length
    CHECK (schedule_context IS NULL OR char_length(schedule_context) <= 1000),
  ADD CONSTRAINT athlete_profile_limitations_length
    CHECK (athlete_reported_limitations IS NULL OR char_length(athlete_reported_limitations) <= 2000);

CREATE POLICY athlete_profiles_select_current_trainer ON app.athlete_profiles
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.trainer_athlete_relations relation
      WHERE relation.athlete_user_id = app.athlete_profiles.user_id
        AND relation.trainer_user_id = app.current_actor_user_id()
        AND relation.status IN ('active', 'suspended')
    )
  );

CREATE POLICY athlete_profiles_update_self ON app.athlete_profiles
  FOR UPDATE TO ai_strength_app
  USING (user_id = app.current_actor_user_id())
  WITH CHECK (user_id = app.current_actor_user_id());

CREATE POLICY users_select_current_coaching_identity ON app.users
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.trainer_athlete_relations relation
      WHERE relation.athlete_user_id = app.users.id
        AND relation.trainer_user_id = app.current_actor_user_id()
        AND relation.status IN ('active', 'suspended')
    )
  );

GRANT UPDATE (
  goal_summary,
  biography,
  training_experience,
  athlete_context,
  training_preferences,
  available_equipment,
  schedule_context,
  athlete_reported_limitations
) ON app.athlete_profiles TO ai_strength_app;

COMMENT ON COLUMN app.athlete_profiles.goal_summary IS 'Athlete-owned training goal shown to the current trainer';
COMMENT ON COLUMN app.athlete_profiles.athlete_context IS 'Athlete-owned context intentionally shared with the current trainer';
COMMENT ON COLUMN app.athlete_profiles.athlete_reported_limitations IS 'Athlete-reported context, not a medical diagnosis';
