ALTER TABLE project_resources
  ADD COLUMN search_text text NOT NULL DEFAULT '',
  ADD COLUMN search_version integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT project_resource_search_version_check CHECK (search_version >= 0 AND search_version <= content_version),
  ADD CONSTRAINT project_resource_search_size_check CHECK (octet_length(search_text) <= 1048576);
CREATE INDEX project_resource_text_search_idx ON project_resources
  USING gin (to_tsvector('simple'::regconfig, title || E'\n' || search_text));
