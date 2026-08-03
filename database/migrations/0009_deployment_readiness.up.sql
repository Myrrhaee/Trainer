GRANT SELECT ON public.app_schema_migrations TO ai_strength_health;

COMMENT ON TABLE public.app_schema_migrations IS
  'Checksummed canonical migration history; health role has read-only access for readiness';
