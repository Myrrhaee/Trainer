DROP POLICY IF EXISTS attention_items_update_owner_trainer ON app.attention_items;
DROP POLICY IF EXISTS review_command_receipts_insert_actor ON app.review_command_receipts;
DROP POLICY IF EXISTS review_command_receipts_select_actor ON app.review_command_receipts;
DROP POLICY IF EXISTS attention_manual_resolutions_insert_owner ON app.attention_manual_resolutions;
DROP POLICY IF EXISTS attention_manual_resolutions_select_owner ON app.attention_manual_resolutions;
DROP POLICY IF EXISTS trainer_feedback_insert_owner ON app.trainer_feedback;
DROP POLICY IF EXISTS trainer_feedback_select_participants ON app.trainer_feedback;

DROP TRIGGER IF EXISTS attention_items_enforce_review_update ON app.attention_items;
DROP FUNCTION IF EXISTS app.enforce_attention_item_review_update();

DROP TABLE IF EXISTS app.review_command_receipts;
DROP TABLE IF EXISTS app.attention_manual_resolutions;
DROP TABLE IF EXISTS app.trainer_feedback;

DROP TYPE IF EXISTS app.review_command_kind;
DROP TYPE IF EXISTS app.trainer_feedback_kind;
