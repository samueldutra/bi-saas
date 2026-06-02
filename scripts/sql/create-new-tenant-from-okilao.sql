-- Create a new tenant schema from the current okilao schema.
-- Usage:
-- 1. Edit the CONFIG section below.
-- 2. Run the whole script in Supabase SQL Editor with an admin/service role.
-- 3. Add the new schema to Supabase API > Exposed schemas.
--
-- The script clones structure from okilao at execution time, without copying
-- business data:
-- tables, defaults, identity columns, checks, indexes, FKs, views,
-- materialized views, functions, triggers, RLS policies, grants and
-- comments. Object names that contain the source schema name are adapted to
-- the target schema name.

BEGIN;

DO $$
DECLARE
  -- ========================================================================
  -- CONFIG
  -- ========================================================================
  v_source_schema text := 'okilao';
  v_target_schema text := 'novo_cliente';

  v_tenant_name text := 'Novo Cliente Ltda';
  v_tenant_slug text := 'novo-cliente';
  v_tenant_cnpj text := NULL; -- example: '12.345.678/0001-90'
  v_tenant_phone text := NULL; -- example: '(11) 98765-4321'

  -- Keep false for a pure structure clone. Enable only if the new client
  -- should start with okilao reference rows or parameter values.
  v_copy_reference_data boolean := false;
  v_copy_okilao_parameters boolean := false;

  -- Registers the new client in public.tenants. This is not copied okilao
  -- data; it is required for the app to see the tenant.
  v_register_tenant boolean := true;

  -- Reference tables copied from okilao. Business tables stay empty.
  v_reference_tables text[] := ARRAY[
    'departments_level_6',
    'departments_level_5',
    'departments_level_4',
    'departments_level_3',
    'departments_level_2',
    'departments_level_1',
    'departamentos_nivel1',
    'tipos_despesa',
    'motivos_perda'
  ];

  -- ========================================================================
  -- INTERNAL STATE
  -- ========================================================================
  v_reserved_schemas text[] := ARRAY[
    'public',
    'pg_catalog',
    'information_schema',
    'pg_toast',
    'pg_temp',
    'graphql_public',
    'supabase_functions',
    'extensions',
    'auth',
    'storage',
    'realtime',
    'vault',
    'pgsodium',
    'pgsodium_masks'
  ];

  v_new_tenant_id uuid;
  v_source_tenant_id uuid;
  v_sql text;
  v_new_name text;
  v_new_definition text;
  v_diff_details text;
  v_schema_comment text;
  v_roles text;
  v_grantee text;
  v_max_id bigint;
  v_sequence_regclass text;
  v_ref_table text;
  r record;

  v_tables_created int := 0;
  v_sequences_created int := 0;
  v_table_constraints_created int := 0;
  v_indexes_created int := 0;
  v_foreign_keys_created int := 0;
  v_views_created int := 0;
  v_matviews_created int := 0;
  v_matview_indexes_created int := 0;
  v_functions_created int := 0;
  v_triggers_created int := 0;
  v_policies_created int := 0;
  v_reference_tables_copied int := 0;
BEGIN
  PERFORM set_config('search_path', '', true);

  -- ========================================================================
  -- VALIDATION
  -- ========================================================================
  IF v_target_schema !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid schema name: %. Use lowercase letters, numbers and underscore, starting with a letter.', v_target_schema;
  END IF;

  IF v_target_schema = ANY (v_reserved_schemas) THEN
    RAISE EXCEPTION 'Reserved schema name: %', v_target_schema;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = v_source_schema) THEN
    RAISE EXCEPTION 'Source schema not found: %', v_source_schema;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = v_target_schema) THEN
    RAISE EXCEPTION 'Target schema already exists: %', v_target_schema;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE supabase_schema = v_target_schema
  ) THEN
    RAISE EXCEPTION 'A tenant already uses supabase_schema=%', v_target_schema;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE slug = v_tenant_slug
  ) THEN
    RAISE EXCEPTION 'A tenant already uses slug=%', v_tenant_slug;
  END IF;

  SELECT id
  INTO v_source_tenant_id
  FROM public.tenants
  WHERE supabase_schema = v_source_schema
  LIMIT 1;

  -- Fail instead of creating a partial clone if okilao starts using object
  -- classes this script does not reproduce exactly.
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind = 'p'
  ) THEN
    RAISE EXCEPTION 'Source schema has partitioned tables. Use pg_dump --schema-only for an exact clone.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
  ) THEN
    RAISE EXCEPTION 'Source schema has table inheritance. Use pg_dump --schema-only for an exact clone.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    LEFT JOIN pg_class c ON c.oid = t.typrelid
    WHERE n.nspname = v_source_schema
      AND (
        t.typtype IN ('d', 'e', 'm', 'r')
        OR (t.typtype = 'c' AND c.relkind = 'c')
      )
  ) THEN
    RAISE EXCEPTION 'Source schema has custom types. Use pg_dump --schema-only for an exact clone.';
  END IF;

  -- ========================================================================
  -- SCHEMA AND TABLES
  -- ========================================================================
  EXECUTE format('CREATE SCHEMA %I', v_target_schema);

  SELECT obj_description(n.oid, 'pg_namespace')
  INTO v_schema_comment
  FROM pg_namespace n
  WHERE n.nspname = v_source_schema;

  IF v_schema_comment IS NOT NULL THEN
    EXECUTE format('COMMENT ON SCHEMA %I IS %L', v_target_schema, v_schema_comment);
  END IF;

  FOR r IN
    SELECT c.relname AS table_name, c.relpersistence
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE %s TABLE %I.%I (LIKE %I.%I INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY INCLUDING CONSTRAINTS INCLUDING STORAGE INCLUDING COMMENTS INCLUDING COMPRESSION INCLUDING STATISTICS)',
      CASE WHEN r.relpersistence = 'u' THEN 'UNLOGGED' ELSE '' END,
      v_target_schema,
      r.table_name,
      v_source_schema,
      r.table_name
    );
    v_tables_created := v_tables_created + 1;
  END LOOP;

  -- Create standalone source sequences that table LIKE did not create.
  FOR r IN
    SELECT *
    FROM pg_sequences
    WHERE schemaname = v_source_schema
    ORDER BY sequencename
  LOOP
    IF to_regclass(format('%I.%I', v_target_schema, r.sequencename)) IS NULL THEN
      EXECUTE format(
        'CREATE SEQUENCE %I.%I AS %s INCREMENT BY %s MINVALUE %s MAXVALUE %s START WITH %s CACHE %s %s',
        v_target_schema,
        r.sequencename,
        r.data_type,
        r.increment_by,
        r.min_value,
        r.max_value,
        r.start_value,
        r.cache_size,
        CASE WHEN r.cycle THEN 'CYCLE' ELSE 'NO CYCLE' END
      );
      v_sequences_created := v_sequences_created + 1;
    END IF;
  END LOOP;

  -- Fix copied serial defaults that still point to okilao sequences.
  FOR r IN
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = v_target_schema
      AND column_default IS NOT NULL
      AND column_default LIKE '%' || v_source_schema || '.%'
  LOOP
    v_new_definition := replace(r.column_default, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_new_definition := replace(v_new_definition, v_source_schema || '.', v_target_schema || '.');

    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
      v_target_schema,
      r.table_name,
      r.column_name,
      v_new_definition
    );
  END LOOP;

  -- Restore sequence ownership where possible.
  FOR r IN
    SELECT
      seq.relname AS sequence_name,
      tbl.relname AS table_name,
      att.attname AS column_name
    FROM pg_class seq
    JOIN pg_namespace seq_ns ON seq_ns.oid = seq.relnamespace
    JOIN pg_depend dep ON dep.objid = seq.oid AND dep.deptype IN ('a', 'i')
    JOIN pg_class tbl ON tbl.oid = dep.refobjid
    JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
    JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = dep.refobjsubid
    WHERE seq_ns.nspname = v_source_schema
      AND tbl_ns.nspname = v_source_schema
      AND seq.relkind = 'S'
    ORDER BY seq.relname
  LOOP
    IF to_regclass(format('%I.%I', v_target_schema, r.sequence_name)) IS NOT NULL THEN
      BEGIN
        EXECUTE format(
          'ALTER SEQUENCE %I.%I OWNED BY %I.%I.%I',
          v_target_schema,
          r.sequence_name,
          v_target_schema,
          r.table_name,
          r.column_name
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not set ownership for sequence %.%: %', v_target_schema, r.sequence_name, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Apply table storage parameters that are not covered by LIKE on every
  -- PostgreSQL version/configuration.
  FOR r IN
    SELECT c.relname, c.reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind = 'r'
      AND c.reloptions IS NOT NULL
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I SET (%s)',
      v_target_schema,
      r.relname,
      array_to_string(r.reloptions, ', ')
    );
  END LOOP;

  -- Check constraints are copied by LIKE INCLUDING CONSTRAINTS. Rename any
  -- source-specific names so the target schema is self-consistent.
  FOR r IN
    SELECT con.conname, rel.relname AS table_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = v_source_schema
      AND con.contype = 'c'
      AND con.conname LIKE '%' || v_source_schema || '%'
    ORDER BY rel.relname, con.conname
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
      v_target_schema,
      r.table_name,
      r.conname,
      replace(r.conname, v_source_schema, v_target_schema)
    );
  END LOOP;

  -- Primary keys, unique constraints and exclusion constraints are created
  -- explicitly so their definitions and adapted names match the source.
  FOR r IN
    SELECT
      c.conname,
      rel.relname AS table_name,
      pg_get_constraintdef(c.oid, true) AS constraint_def
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.contype IN ('p', 'u', 'x')
    ORDER BY rel.relname, c.conname
  LOOP
    v_new_name := replace(r.conname, v_source_schema, v_target_schema);
    v_new_definition := replace(r.constraint_def, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_new_definition := replace(v_new_definition, v_source_schema || '.', v_target_schema || '.');

    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
      v_target_schema,
      r.table_name,
      v_new_name,
      v_new_definition
    );
    v_table_constraints_created := v_table_constraints_created + 1;
  END LOOP;

  -- Non-constraint indexes. Constraint-backed indexes are created above.
  FOR r IN
    SELECT
      idx.relname AS index_name,
      pg_get_indexdef(idx.oid) AS index_def,
      idx.reloptions
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    LEFT JOIN pg_constraint con ON con.conindid = idx.oid
    WHERE n.nspname = v_source_schema
      AND tbl.relkind = 'r'
      AND con.oid IS NULL
    ORDER BY tbl.relname, idx.relname
  LOOP
    v_new_name := replace(r.index_name, v_source_schema, v_target_schema);
    v_sql := replace(r.index_def, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_sql := replace(v_sql, v_source_schema || '.', v_target_schema || '.');
    v_sql := replace(v_sql, 'INDEX ' || quote_ident(r.index_name), 'INDEX ' || quote_ident(v_new_name));
    v_sql := replace(v_sql, 'INDEX ' || r.index_name, 'INDEX ' || v_new_name);

    EXECUTE v_sql;

    IF r.reloptions IS NOT NULL THEN
      EXECUTE format(
        'ALTER INDEX %I.%I SET (%s)',
        v_target_schema,
        v_new_name,
        array_to_string(r.reloptions, ', ')
      );
    END IF;

    v_indexes_created := v_indexes_created + 1;
  END LOOP;

  -- ========================================================================
  -- FOREIGN KEYS
  -- ========================================================================
  FOR r IN
    SELECT
      c.conname,
      rel.relname AS table_name,
      pg_get_constraintdef(c.oid, true) AS constraint_def
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.contype = 'f'
    ORDER BY rel.relname, c.conname
  LOOP
    v_new_name := replace(r.conname, v_source_schema, v_target_schema);
    v_new_definition := replace(r.constraint_def, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_new_definition := replace(v_new_definition, v_source_schema || '.', v_target_schema || '.');

    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
      v_target_schema,
      r.table_name,
      v_new_name,
      v_new_definition
    );
    v_foreign_keys_created := v_foreign_keys_created + 1;
  END LOOP;

  -- ========================================================================
  -- FUNCTIONS
  -- ========================================================================
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = v_source_schema
    ORDER BY p.proname, p.oid
  LOOP
    v_sql := pg_get_functiondef(r.oid);
    v_sql := replace(v_sql, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_sql := replace(v_sql, v_source_schema || '.', v_target_schema || '.');
    EXECUTE v_sql;
    v_functions_created := v_functions_created + 1;
  END LOOP;

  -- ========================================================================
  -- VIEWS AND MATERIALIZED VIEWS
  -- ========================================================================
  FOR r IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind = 'v'
    ORDER BY c.oid
  LOOP
    v_new_definition := pg_get_viewdef(r.oid, true);
    v_new_definition := replace(v_new_definition, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_new_definition := replace(v_new_definition, v_source_schema || '.', v_target_schema || '.');
    v_new_definition := regexp_replace(v_new_definition, ';\s*$', '');

    EXECUTE format(
      'CREATE OR REPLACE VIEW %I.%I AS %s',
      v_target_schema,
      r.relname,
      v_new_definition
    );
    v_views_created := v_views_created + 1;
  END LOOP;

  FOR r IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind = 'm'
    ORDER BY c.oid
  LOOP
    v_new_definition := pg_get_viewdef(r.oid, true);
    v_new_definition := replace(v_new_definition, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_new_definition := replace(v_new_definition, v_source_schema || '.', v_target_schema || '.');
    v_new_definition := regexp_replace(v_new_definition, ';\s*$', '');

    EXECUTE format(
      'CREATE MATERIALIZED VIEW %I.%I AS %s WITH NO DATA',
      v_target_schema,
      r.relname,
      v_new_definition
    );
    v_matviews_created := v_matviews_created + 1;
  END LOOP;

  FOR r IN
    SELECT c.relname, c.reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind = 'm'
      AND c.reloptions IS NOT NULL
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'ALTER MATERIALIZED VIEW %I.%I SET (%s)',
      v_target_schema,
      r.relname,
      array_to_string(r.reloptions, ', ')
    );
  END LOOP;

  -- Indexes on materialized views are not covered by CREATE TABLE LIKE.
  FOR r IN
    SELECT i.indexname, i.indexdef
    FROM pg_indexes i
    JOIN pg_class c
      ON c.relname = i.tablename
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
     AND n.nspname = i.schemaname
    WHERE i.schemaname = v_source_schema
      AND c.relkind = 'm'
    ORDER BY i.tablename, i.indexname
  LOOP
    v_new_name := replace(r.indexname, v_source_schema, v_target_schema);
    v_sql := replace(r.indexdef, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_sql := replace(v_sql, v_source_schema || '.', v_target_schema || '.');
    v_sql := replace(v_sql, 'INDEX ' || quote_ident(r.indexname), 'INDEX ' || quote_ident(v_new_name));
    v_sql := replace(v_sql, 'INDEX ' || r.indexname, 'INDEX ' || v_new_name);

    EXECUTE v_sql;
    v_matview_indexes_created := v_matview_indexes_created + 1;
  END LOOP;

  -- Apply source index storage parameters to every cloned index, including
  -- constraint-backed indexes.
  FOR r IN
    SELECT idx.relname AS index_name, idx.reloptions
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    WHERE n.nspname = v_source_schema
      AND tbl.relkind IN ('r', 'm')
      AND idx.reloptions IS NOT NULL
    ORDER BY idx.relname
  LOOP
    v_new_name := replace(r.index_name, v_source_schema, v_target_schema);

    IF to_regclass(format('%I.%I', v_target_schema, v_new_name)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER INDEX %I.%I SET (%s)',
        v_target_schema,
        v_new_name,
        array_to_string(r.reloptions, ', ')
      );
    END IF;
  END LOOP;

  -- ========================================================================
  -- TRIGGERS
  -- ========================================================================
  FOR r IN
    SELECT t.oid, t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  LOOP
    v_sql := pg_get_triggerdef(r.oid, true);
    v_sql := replace(v_sql, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
    v_sql := replace(v_sql, v_source_schema || '.', v_target_schema || '.');
    EXECUTE v_sql;
    v_triggers_created := v_triggers_created + 1;
  END LOOP;

  -- ========================================================================
  -- RLS AND POLICIES
  -- ========================================================================
  FOR r IN
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    IF r.relrowsecurity THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_target_schema, r.relname);
    END IF;

    IF r.relforcerowsecurity THEN
      EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', v_target_schema, r.relname);
    END IF;
  END LOOP;

  FOR r IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = v_source_schema
    ORDER BY tablename, policyname
  LOOP
    SELECT string_agg(quote_ident(role_text), ', ')
    INTO v_roles
    FROM unnest(r.roles) AS role_name(role_text);

    v_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname,
      v_target_schema,
      r.tablename,
      r.permissive,
      r.cmd,
      COALESCE(v_roles, 'public')
    );

    IF r.qual IS NOT NULL THEN
      v_new_definition := replace(r.qual, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
      v_new_definition := replace(v_new_definition, v_source_schema || '.', v_target_schema || '.');
      v_sql := v_sql || format(' USING (%s)', v_new_definition);
    END IF;

    IF r.with_check IS NOT NULL THEN
      v_new_definition := replace(r.with_check, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.');
      v_new_definition := replace(v_new_definition, v_source_schema || '.', v_target_schema || '.');
      v_sql := v_sql || format(' WITH CHECK (%s)', v_new_definition);
    END IF;

    EXECUTE v_sql;
    v_policies_created := v_policies_created + 1;
  END LOOP;

  -- ========================================================================
  -- COMMENTS
  -- ========================================================================
  FOR r IN
    SELECT c.relkind, c.relname, obj_description(c.oid, 'pg_class') AS comment_text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND c.relkind IN ('r', 'v', 'm', 'S', 'i', 'I')
      AND obj_description(c.oid, 'pg_class') IS NOT NULL
    ORDER BY c.relkind, c.relname
  LOOP
    v_new_name := replace(r.relname, v_source_schema, v_target_schema);

    IF r.relkind = 'S' THEN
      EXECUTE format('COMMENT ON SEQUENCE %I.%I IS %L', v_target_schema, v_new_name, r.comment_text);
    ELSIF r.relkind = 'v' THEN
      EXECUTE format('COMMENT ON VIEW %I.%I IS %L', v_target_schema, v_new_name, r.comment_text);
    ELSIF r.relkind = 'm' THEN
      EXECUTE format('COMMENT ON MATERIALIZED VIEW %I.%I IS %L', v_target_schema, v_new_name, r.comment_text);
    ELSIF r.relkind IN ('i', 'I') THEN
      IF to_regclass(format('%I.%I', v_target_schema, v_new_name)) IS NOT NULL THEN
        EXECUTE format('COMMENT ON INDEX %I.%I IS %L', v_target_schema, v_new_name, r.comment_text);
      END IF;
    ELSE
      EXECUTE format('COMMENT ON TABLE %I.%I IS %L', v_target_schema, v_new_name, r.comment_text);
    END IF;
  END LOOP;

  FOR r IN
    SELECT
      c.relname,
      a.attname,
      col_description(c.oid, a.attnum) AS comment_text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = v_source_schema
      AND c.relkind IN ('r', 'v', 'm')
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND col_description(c.oid, a.attnum) IS NOT NULL
    ORDER BY c.relname, a.attnum
  LOOP
    EXECUTE format(
      'COMMENT ON COLUMN %I.%I.%I IS %L',
      v_target_schema,
      r.relname,
      r.attname,
      r.comment_text
    );
  END LOOP;

  FOR r IN
    SELECT
      con.conname,
      rel.relname AS table_name,
      obj_description(con.oid, 'pg_constraint') AS comment_text
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = v_source_schema
      AND obj_description(con.oid, 'pg_constraint') IS NOT NULL
    ORDER BY rel.relname, con.conname
  LOOP
    v_new_name := replace(r.conname, v_source_schema, v_target_schema);
    EXECUTE format(
      'COMMENT ON CONSTRAINT %I ON %I.%I IS %L',
      v_new_name,
      v_target_schema,
      r.table_name,
      r.comment_text
    );
  END LOOP;

  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      obj_description(p.oid, 'pg_proc') AS comment_text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = v_source_schema
      AND obj_description(p.oid, 'pg_proc') IS NOT NULL
    ORDER BY p.proname, p.oid
  LOOP
    EXECUTE format(
      'COMMENT ON FUNCTION %I.%I(%s) IS %L',
      v_target_schema,
      r.proname,
      r.identity_args,
      r.comment_text
    );
  END LOOP;

  FOR r IN
    SELECT
      t.tgname,
      c.relname AS table_name,
      obj_description(t.oid, 'pg_trigger') AS comment_text
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = v_source_schema
      AND NOT t.tgisinternal
      AND obj_description(t.oid, 'pg_trigger') IS NOT NULL
    ORDER BY c.relname, t.tgname
  LOOP
    EXECUTE format(
      'COMMENT ON TRIGGER %I ON %I.%I IS %L',
      r.tgname,
      v_target_schema,
      r.table_name,
      r.comment_text
    );
  END LOOP;

  -- ========================================================================
  -- GRANTS COPIED FROM SOURCE OBJECTS
  -- ========================================================================
  EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', v_target_schema);

  FOR r IN
    SELECT
      e.grantee,
      e.is_grantable,
      string_agg(e.privilege_type, ', ' ORDER BY e.privilege_type) AS privileges
    FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(n.nspacl) e
    WHERE n.nspname = v_source_schema
    GROUP BY e.grantee, e.is_grantable
  LOOP
    IF r.grantee = 0 THEN
      v_grantee := 'PUBLIC';
    ELSE
      SELECT quote_ident(rolname) INTO v_grantee FROM pg_roles WHERE oid = r.grantee;
    END IF;

    IF v_grantee IS NOT NULL THEN
      EXECUTE format(
        'GRANT %s ON SCHEMA %I TO %s%s',
        r.privileges,
        v_target_schema,
        v_grantee,
        CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
      );
    END IF;
  END LOOP;

  FOR r IN
    SELECT
      c.relkind,
      c.relname,
      e.grantee,
      e.is_grantable,
      string_agg(e.privilege_type, ', ' ORDER BY e.privilege_type) AS privileges
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) e
    WHERE n.nspname = v_source_schema
      AND c.relkind IN ('r', 'v', 'm', 'S')
    GROUP BY c.relkind, c.relname, e.grantee, e.is_grantable
    ORDER BY c.relkind, c.relname
  LOOP
    IF r.grantee = 0 THEN
      v_grantee := 'PUBLIC';
    ELSE
      SELECT quote_ident(rolname) INTO v_grantee FROM pg_roles WHERE oid = r.grantee;
    END IF;

    IF v_grantee IS NOT NULL THEN
      IF r.relkind = 'S' THEN
        EXECUTE format(
          'GRANT %s ON SEQUENCE %I.%I TO %s%s',
          r.privileges,
          v_target_schema,
          r.relname,
          v_grantee,
          CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
        );
      ELSE
        EXECUTE format(
          'GRANT %s ON TABLE %I.%I TO %s%s',
          r.privileges,
          v_target_schema,
          r.relname,
          v_grantee,
          CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
        );
      END IF;
    END IF;
  END LOOP;

  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = v_source_schema
      AND p.proacl IS NOT NULL
    ORDER BY p.proname, p.oid
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
      v_target_schema,
      r.proname,
      r.identity_args
    );
  END LOOP;

  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      e.grantee,
      e.is_grantable,
      string_agg(e.privilege_type, ', ' ORDER BY e.privilege_type) AS privileges
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) e
    WHERE n.nspname = v_source_schema
    GROUP BY p.oid, p.proname, e.grantee, e.is_grantable
    ORDER BY p.proname, p.oid
  LOOP
    IF r.grantee = 0 THEN
      v_grantee := 'PUBLIC';
    ELSE
      SELECT quote_ident(rolname) INTO v_grantee FROM pg_roles WHERE oid = r.grantee;
    END IF;

    IF v_grantee IS NOT NULL THEN
      EXECUTE format(
        'GRANT %s ON FUNCTION %I.%I(%s) TO %s%s',
        r.privileges,
        v_target_schema,
        r.proname,
        r.identity_args,
        v_grantee,
        CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
      );
    END IF;
  END LOOP;

  -- ========================================================================
  -- REFERENCE DATA
  -- ========================================================================
  IF v_copy_reference_data THEN
    FOREACH v_ref_table IN ARRAY v_reference_tables
    LOOP
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = v_source_schema
          AND table_name = v_ref_table
      ) THEN
        EXECUTE format(
          'INSERT INTO %I.%I SELECT * FROM %I.%I ON CONFLICT DO NOTHING',
          v_target_schema,
          v_ref_table,
          v_source_schema,
          v_ref_table
        );
        v_reference_tables_copied := v_reference_tables_copied + 1;
      END IF;
    END LOOP;
  END IF;

  -- Reset serial/identity sequences after copying reference IDs.
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = v_target_schema
  LOOP
    SELECT pg_get_serial_sequence(format('%I.%I', v_target_schema, r.table_name), r.column_name)
    INTO v_sequence_regclass;

    IF v_sequence_regclass IS NOT NULL THEN
      EXECUTE format('SELECT max(%I)::bigint FROM %I.%I', r.column_name, v_target_schema, r.table_name)
      INTO v_max_id;

      IF v_max_id IS NULL THEN
        EXECUTE format('SELECT setval(%L::regclass, 1, false)', v_sequence_regclass);
      ELSE
        EXECUTE format('SELECT setval(%L::regclass, %s, true)', v_sequence_regclass, v_max_id);
      END IF;
    END IF;
  END LOOP;

  -- ========================================================================
  -- PUBLIC TENANT ROW AND PARAMETERS
  -- ========================================================================
  IF v_register_tenant THEN
    INSERT INTO public.tenants (
      name,
      slug,
      cnpj,
      phone,
      supabase_schema,
      is_active
    )
    VALUES (
      v_tenant_name,
      v_tenant_slug,
      NULLIF(v_tenant_cnpj, ''),
      NULLIF(v_tenant_phone, ''),
      v_target_schema,
      true
    )
    RETURNING id INTO v_new_tenant_id;
  END IF;

  IF v_register_tenant
    AND v_copy_okilao_parameters
    AND v_source_tenant_id IS NOT NULL
  THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_parameters'
        AND column_name = 'parameter_numeric_value'
    ) THEN
      INSERT INTO public.tenant_parameters (
        tenant_id,
        parameter_key,
        parameter_value,
        parameter_numeric_value
      )
      SELECT
        v_new_tenant_id,
        parameter_key,
        parameter_value,
        parameter_numeric_value
      FROM public.tenant_parameters
      WHERE tenant_id = v_source_tenant_id
      ON CONFLICT (tenant_id, parameter_key) DO UPDATE
      SET
        parameter_value = EXCLUDED.parameter_value,
        parameter_numeric_value = EXCLUDED.parameter_numeric_value,
        updated_at = now();
    ELSE
      INSERT INTO public.tenant_parameters (
        tenant_id,
        parameter_key,
        parameter_value
      )
      SELECT
        v_new_tenant_id,
        parameter_key,
        parameter_value
      FROM public.tenant_parameters
      WHERE tenant_id = v_source_tenant_id
      ON CONFLICT (tenant_id, parameter_key) DO UPDATE
      SET
        parameter_value = EXCLUDED.parameter_value,
        updated_at = now();
    END IF;
  END IF;

  -- ========================================================================
  -- ANALYZE
  -- ========================================================================
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = v_target_schema
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ANALYZE %I.%I', v_target_schema, r.table_name);
  END LOOP;

  -- ========================================================================
  -- STRICT STRUCTURE VALIDATION
  -- ========================================================================
  IF EXISTS (
    WITH src AS (
      SELECT
        c.relname,
        c.relkind,
        c.relpersistence,
        c.relrowsecurity,
        c.relforcerowsecurity,
        COALESCE(array_to_string(c.reloptions, ','), '') AS reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_source_schema
        AND c.relkind IN ('r', 'v', 'm', 'S')
    ),
    dst AS (
      SELECT
        c.relname,
        c.relkind,
        c.relpersistence,
        c.relrowsecurity,
        c.relforcerowsecurity,
        COALESCE(array_to_string(c.reloptions, ','), '') AS reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_target_schema
        AND c.relkind IN ('r', 'v', 'm', 'S')
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: relation set differs between % and %', v_source_schema, v_target_schema;
  END IF;

  IF EXISTS (
    WITH src AS (
      SELECT
        sequencename,
        data_type,
        start_value,
        min_value,
        max_value,
        increment_by,
        cycle,
        cache_size
      FROM pg_sequences
      WHERE schemaname = v_source_schema
    ),
    dst AS (
      SELECT
        sequencename,
        data_type,
        start_value,
        min_value,
        max_value,
        increment_by,
        cycle,
        cache_size
      FROM pg_sequences
      WHERE schemaname = v_target_schema
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: sequence options differ between % and %', v_source_schema, v_target_schema;
  END IF;

  IF EXISTS (
    WITH src AS (
      SELECT
        c.relname,
        a.attname,
        replace(a.atttypid::regtype::text, v_source_schema || '.', v_target_schema || '.') AS type_name,
        a.atttypmod,
        a.attnotnull,
        a.attidentity,
        a.attgenerated,
        a.attstorage,
        a.attcompression,
        COALESCE(a.attcollation::regcollation::text, '') AS collation_name,
        COALESCE(
          replace(
            replace(pg_get_expr(d.adbin, d.adrelid), quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.'),
            v_source_schema || '.',
            v_target_schema || '.'
          ),
          ''
        ) AS default_expr
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE n.nspname = v_source_schema
        AND c.relkind IN ('r', 'v', 'm')
        AND a.attnum > 0
        AND NOT a.attisdropped
    ),
    dst AS (
      SELECT
        c.relname,
        a.attname,
        a.atttypid::regtype::text AS type_name,
        a.atttypmod,
        a.attnotnull,
        a.attidentity,
        a.attgenerated,
        a.attstorage,
        a.attcompression,
        COALESCE(a.attcollation::regcollation::text, '') AS collation_name,
        COALESCE(pg_get_expr(d.adbin, d.adrelid), '') AS default_expr
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE n.nspname = v_target_schema
        AND c.relkind IN ('r', 'v', 'm')
        AND a.attnum > 0
        AND NOT a.attisdropped
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: column definitions differ between % and %', v_source_schema, v_target_schema;
  END IF;

  IF EXISTS (
    WITH src AS (
      SELECT
        replace(con.conname, v_source_schema, v_target_schema) AS conname,
        rel.relname,
        con.contype,
        replace(
          replace(pg_get_constraintdef(con.oid, true), quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.'),
          v_source_schema || '.',
          v_target_schema || '.'
        ) AS condef
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = v_source_schema
    ),
    dst AS (
      SELECT
        con.conname,
        rel.relname,
        con.contype,
        pg_get_constraintdef(con.oid, true) AS condef
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = v_target_schema
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: constraints differ between % and %', v_source_schema, v_target_schema;
  END IF;

  WITH src_raw AS (
      SELECT
        replace(idx.relname, v_source_schema, v_target_schema) AS index_name,
        tbl.relname AS table_name,
        replace(
          replace(
            replace(
              replace(
                pg_get_indexdef(idx.oid),
                'INDEX ' || quote_ident(idx.relname),
                'INDEX ' || quote_ident(replace(idx.relname, v_source_schema, v_target_schema))
              ),
              'INDEX ' || idx.relname,
              'INDEX ' || replace(idx.relname, v_source_schema, v_target_schema)
            ),
            quote_ident(v_source_schema) || '.',
            quote_ident(v_target_schema) || '.'
          ),
          v_source_schema || '.',
          v_target_schema || '.'
        ) AS index_def
      FROM pg_index i
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = tbl.relnamespace
      WHERE n.nspname = v_source_schema
        AND tbl.relkind IN ('r', 'm')
    ),
    dst_raw AS (
      SELECT
        idx.relname AS index_name,
        tbl.relname AS table_name,
        pg_get_indexdef(idx.oid) AS index_def
      FROM pg_index i
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = tbl.relnamespace
      WHERE n.nspname = v_target_schema
        AND tbl.relkind IN ('r', 'm')
    ),
    src AS (
      SELECT
        index_name,
        table_name,
        regexp_replace(
          regexp_replace(
            index_def,
            'ANY \(\(ARRAY\[([^]]+)\]\)::text\[\]\)',
            'ANY (ARRAY[\1])',
            'g'
          ),
          '\((''[^'']+''::character varying)\)::text',
          '\1',
          'g'
        ) AS index_def
      FROM src_raw
    ),
    dst AS (
      SELECT
        index_name,
        table_name,
        regexp_replace(
          regexp_replace(
            index_def,
            'ANY \(\(ARRAY\[([^]]+)\]\)::text\[\]\)',
            'ANY (ARRAY[\1])',
            'g'
          ),
          '\((''[^'']+''::character varying)\)::text',
          '\1',
          'g'
        ) AS index_def
      FROM dst_raw
    ),
    missing_in_target AS (
      SELECT 'missing_in_target'::text AS diff_side, m.*
      FROM (SELECT * FROM src EXCEPT SELECT * FROM dst) m
    ),
    extra_in_target AS (
      SELECT 'extra_in_target'::text AS diff_side, e.*
      FROM (SELECT * FROM dst EXCEPT SELECT * FROM src) e
    )
    SELECT string_agg(
      format(
        '%s | table=%s | index=%s | def=%s',
        diff_side,
        table_name,
        index_name,
        left(index_def, 1600)
      ),
      E'\n---\n'
    )
    INTO v_diff_details
    FROM (
      SELECT *
      FROM missing_in_target
      UNION ALL
      SELECT *
      FROM extra_in_target
      ORDER BY table_name, index_name, diff_side
      LIMIT 8
    ) d;

  IF v_diff_details IS NOT NULL THEN
    RAISE EXCEPTION 'Structure validation failed: indexes differ between % and %. First differences:%',
      v_source_schema,
      v_target_schema,
      E'\n' || v_diff_details;
  END IF;

  IF EXISTS (
    WITH src AS (
      SELECT
        c.relkind,
        c.relname,
        replace(
          replace(pg_get_viewdef(c.oid, true), quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.'),
          v_source_schema || '.',
          v_target_schema || '.'
        ) AS view_def
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_source_schema
        AND c.relkind IN ('v', 'm')
    ),
    dst AS (
      SELECT
        c.relkind,
        c.relname,
        pg_get_viewdef(c.oid, true) AS view_def
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_target_schema
        AND c.relkind IN ('v', 'm')
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: views differ between % and %', v_source_schema, v_target_schema;
  END IF;

  IF EXISTS (
    WITH src AS (
      SELECT
        p.proname,
        pg_get_function_identity_arguments(p.oid) AS identity_args,
        replace(
          replace(pg_get_functiondef(p.oid), quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.'),
          v_source_schema || '.',
          v_target_schema || '.'
        ) AS function_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = v_source_schema
    ),
    dst AS (
      SELECT
        p.proname,
        pg_get_function_identity_arguments(p.oid) AS identity_args,
        pg_get_functiondef(p.oid) AS function_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = v_target_schema
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: functions differ between % and %', v_source_schema, v_target_schema;
  END IF;

  IF EXISTS (
    WITH src AS (
      SELECT
        t.tgname,
        c.relname AS table_name,
        replace(
          replace(pg_get_triggerdef(t.oid, true), quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.'),
          v_source_schema || '.',
          v_target_schema || '.'
        ) AS trigger_def
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_source_schema
        AND NOT t.tgisinternal
    ),
    dst AS (
      SELECT
        t.tgname,
        c.relname AS table_name,
        pg_get_triggerdef(t.oid, true) AS trigger_def
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_target_schema
        AND NOT t.tgisinternal
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: triggers differ between % and %', v_source_schema, v_target_schema;
  END IF;

  IF EXISTS (
    WITH src AS (
      SELECT
        policyname,
        tablename,
        permissive,
        roles,
        cmd,
        COALESCE(
          replace(replace(qual, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.'), v_source_schema || '.', v_target_schema || '.'),
          ''
        ) AS qual,
        COALESCE(
          replace(replace(with_check, quote_ident(v_source_schema) || '.', quote_ident(v_target_schema) || '.'), v_source_schema || '.', v_target_schema || '.'),
          ''
        ) AS with_check
      FROM pg_policies
      WHERE schemaname = v_source_schema
    ),
    dst AS (
      SELECT
        policyname,
        tablename,
        permissive,
        roles,
        cmd,
        COALESCE(qual, '') AS qual,
        COALESCE(with_check, '') AS with_check
      FROM pg_policies
      WHERE schemaname = v_target_schema
    )
    SELECT * FROM src EXCEPT SELECT * FROM dst
    UNION ALL
    SELECT * FROM dst EXCEPT SELECT * FROM src
  ) THEN
    RAISE EXCEPTION 'Structure validation failed: policies differ between % and %', v_source_schema, v_target_schema;
  END IF;

  RAISE NOTICE 'Created tenant schema % from %', v_target_schema, v_source_schema;
  RAISE NOTICE 'tenant_id=%', v_new_tenant_id;
  RAISE NOTICE 'tables=%, sequences=%, constraints=%, indexes=%, foreign_keys=%, views=%, matviews=%, matview_indexes=%, functions=%, triggers=%, policies=%, reference_tables_copied=%',
    v_tables_created,
    v_sequences_created,
    v_table_constraints_created,
    v_indexes_created,
    v_foreign_keys_created,
    v_views_created,
    v_matviews_created,
    v_matview_indexes_created,
    v_functions_created,
    v_triggers_created,
    v_policies_created,
    v_reference_tables_copied;
END $$;

COMMIT;

-- Verification examples. Replace novo_cliente with the configured schema:
--
-- SELECT schema_name
-- FROM information_schema.schemata
-- WHERE schema_name = 'novo_cliente';
--
-- SELECT table_schema, count(*) AS tables
-- FROM information_schema.tables
-- WHERE table_schema IN ('okilao', 'novo_cliente')
--   AND table_type = 'BASE TABLE'
-- GROUP BY table_schema
-- ORDER BY table_schema;
--
-- SELECT *
-- FROM public.tenants
-- WHERE supabase_schema = 'novo_cliente';
