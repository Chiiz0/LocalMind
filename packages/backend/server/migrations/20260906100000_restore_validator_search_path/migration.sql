-- pg_restore clears the session search_path before restoring checked rows.
-- These validators call each other and must resolve their schema explicitly.
ALTER FUNCTION public.ai_agent_runtime_adapter_resolution_step_types_valid(jsonb)
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.ai_agent_runtime_adapter_resolution_snapshot_valid(jsonb)
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.ai_agent_runtime_adapter_resolution_snapshot_matches(jsonb, jsonb)
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.ai_agent_runtime_adapter_resolution_snapshot_list_valid(jsonb)
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.ai_agent_runtime_adapter_resolution_valid(jsonb)
  SET search_path TO pg_catalog, public;
