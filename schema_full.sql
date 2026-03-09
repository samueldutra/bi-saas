--
-- PostgreSQL database dump
--

\restrict 1SawDsH8ffVdBdz8k0pXSQ4HM6E81SWsjZlI4LYr3VcbCE2r9qK0LLfMpD7gOVO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: system_module; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.system_module AS ENUM (
    'dashboard',
    'dashboard_tempo_real',
    'dre_gerencial',
    'dre_comparativo',
    'metas_mensal',
    'metas_setor',
    'relatorios_previsao_ruptura',
    'relatorios_ruptura_abcd',
    'relatorios_venda_curva',
    'relatorios_ruptura_60d',
    'relatorios_perdas',
    'relatorios_produtos_sem_vendas'
);


--
-- Name: TYPE system_module; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.system_module IS 'Enum de módulos do sistema BI SaaS.
Valores atuais:
- dashboard: Dashboard 360 principal
- dashboard_tempo_real: Dashboard Tempo Real
- dre_gerencial: DRE Gerencial
- dre_comparativo: DRE Comparativo
- metas_mensal: Metas mensais por filial
- metas_setor: Metas por setor
- relatorios_previsao_ruptura: Previsão de Ruptura
- relatorios_ruptura_abcd: Relatório de Ruptura ABCD
- relatorios_venda_curva: Relatório de Venda por Curva
- relatorios_ruptura_60d: Relatório de Ruptura 60 dias (Dias sem Giro)
- relatorios_perdas: Relatório de Perdas
- relatorios_produtos_sem_vendas: Produtos sem Vendas (adicionado em 2026-01-14)';


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: atualizar_curva_abcd(text, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_curva_abcd(p_schema_name text, p_filiais_ids bigint[]) RETURNS void
    LANGUAGE plpgsql
    AS $_$
DECLARE
    dyn_sql text;
    start_time timestamptz := clock_timestamp();
    -- Variável para construir a cláusula de filtro das filiais
    filial_filter_clause text := '';
BEGIN
    -- Bloco IF para construir o filtro dinamicamente
    IF p_filiais_ids IS NOT NULL AND array_length(p_filiais_ids, 1) > 0 THEN
        filial_filter_clause := format('AND p.filial_id = ANY(%L)', p_filiais_ids);
    END IF;

    dyn_sql := format($f$
        CREATE TEMP TABLE temp_curva_final (
            id_produto bigint,
            filial_id bigint,
            curva_final text
        ) ON COMMIT DROP;

        WITH
        calculo_base AS (
            SELECT
                p.filial_id,
                p.departamento_id,
                p.id as id_produto,
                COALESCE(SUM(v.valor_vendas), 0) as total_valor_produto,
                SUM(COALESCE(SUM(v.valor_vendas), 0)) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_departamento,
                ROW_NUMBER() OVER (PARTITION BY p.filial_id, p.departamento_id ORDER BY COALESCE(SUM(v.valor_vendas), 0) DESC) as ranking,
                COUNT(*) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_produtos_no_grupo
            FROM
                %1$I.produtos p
            LEFT JOIN
                %1$I.vendas v ON p.id = v.id_produto
                                AND p.filial_id = v.filial_id
                                AND v.data_venda >= (CURRENT_DATE - INTERVAL '60 days') -- << Período de 60 dias
                                AND v.data_venda < CURRENT_DATE
                                AND v.valor_vendas > 0
            WHERE
                p.ativo = true
                -- A cláusula de filtro é inserida aqui
                %2$s
            GROUP BY
                p.filial_id, p.departamento_id, p.id
        ),
        calculo_curva_inicial AS (
            SELECT
                *,
                SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as acumulado,
                CASE
                    WHEN total_valor_produto = 0 THEN 'SV'
                    WHEN (total_valor_produto / NULLIF(total_departamento, 0)) > 0.50 THEN 'A'
                    WHEN (SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_departamento, 0)) <= 0.51 THEN 'A'
                    WHEN (SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_departamento, 0)) <= 0.81 THEN 'B'
                    WHEN (SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_departamento, 0)) <= 0.91 THEN 'C'
                    ELSE 'D'
                END AS curva_inicial
            FROM
                calculo_base
        ),
        analise_de_presenca AS (
            SELECT
                *,
                BOOL_OR(curva_inicial = 'A') OVER (PARTITION BY filial_id, departamento_id) as tem_A,
                BOOL_OR(curva_inicial = 'B') OVER (PARTITION BY filial_id, departamento_id) as tem_B,
                BOOL_OR(curva_inicial = 'C') OVER (PARTITION BY filial_id, departamento_id) as tem_C
            FROM
                calculo_curva_inicial
        )
        INSERT INTO temp_curva_final (id_produto, filial_id, curva_final)
        SELECT
            id_produto,
            filial_id,
            CASE
                WHEN curva_inicial = 'SV' THEN 'SV'
                WHEN total_produtos_no_grupo = 1 THEN 'A'
                WHEN tem_A = false AND ranking = 1 THEN 'A'
                WHEN tem_B = false AND ranking = 2 AND total_produtos_no_grupo >= 2 THEN 'B'
                WHEN tem_C = false AND ranking = 3 AND total_produtos_no_grupo >= 3 THEN 'C'
                ELSE curva_inicial
            END AS curva_final
        FROM
            analise_de_presenca;

        UPDATE %1$I.produtos p
        SET curva_abcd = tcf.curva_final
        FROM temp_curva_final tcf
        WHERE p.id = tcf.id_produto AND p.filial_id = tcf.filial_id;

    $f$, p_schema_name, filial_filter_clause);

    EXECUTE dyn_sql;

    PERFORM public.log_job('atualizar_curva_abcd', p_schema_name, 'SUCCESS', 'Filiais: ' || COALESCE(p_filiais_ids::text, 'TODAS'), start_time);

EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_job('atualizar_curva_abcd', p_schema_name, 'ERROR', SQLERRM, start_time);
        RAISE;
END;
$_$;


--
-- Name: atualizar_curva_abcd_30d(text, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_curva_abcd_30d(p_schema_name text, p_filiais_ids bigint[]) RETURNS void
    LANGUAGE plpgsql
    AS $_$
DECLARE
    dyn_sql text;
    start_time timestamptz := clock_timestamp();
    -- << NOVO >> Variável para construir a cláusula de filtro das filiais
    filial_filter_clause text := '';
BEGIN
    -- << NOVO >> Bloco IF para construir o filtro dinamicamente
    -- Se o array não for nulo e tiver elementos, cria a cláusula WHERE
    IF p_filiais_ids IS NOT NULL AND array_length(p_filiais_ids, 1) > 0 THEN
        filial_filter_clause := format('AND p.filial_id = ANY(%L)', p_filiais_ids);
    END IF;

    dyn_sql := format($f$
        CREATE TEMP TABLE temp_curva_final (
            id_produto bigint,
            filial_id bigint,
            curva_final text
        ) ON COMMIT DROP;

        WITH
        calculo_base AS (
            SELECT
                p.filial_id,
                p.departamento_id,
                p.id as id_produto,
                COALESCE(SUM(v.valor_vendas), 0) as total_valor_produto,
                SUM(COALESCE(SUM(v.valor_vendas), 0)) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_departamento,
                ROW_NUMBER() OVER (PARTITION BY p.filial_id, p.departamento_id ORDER BY COALESCE(SUM(v.valor_vendas), 0) DESC) as ranking,
                COUNT(*) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_produtos_no_grupo
            FROM
                %1$I.produtos p
            LEFT JOIN
                %1$I.vendas v ON p.id = v.id_produto
                                AND p.filial_id = v.filial_id
                                AND v.data_venda >= (CURRENT_DATE - INTERVAL '30 days')
                                AND v.data_venda < CURRENT_DATE
                                AND v.valor_vendas > 0
            WHERE
                p.ativo = true
                -- << NOVO >> A cláusula de filtro é inserida aqui. Se estiver vazia, nada acontece.
                %2$s
            GROUP BY
                p.filial_id, p.departamento_id, p.id
        ),
        calculo_curva_inicial AS (
            -- (O restante da lógica das CTEs continua exatamente o mesmo...)
            SELECT
                *,
                SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as acumulado,
                CASE
                    WHEN total_valor_produto = 0 THEN 'SV'
                    WHEN (total_valor_produto / NULLIF(total_departamento, 0)) > 0.50 THEN 'A'
                    WHEN (SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_departamento, 0)) <= 0.51 THEN 'A'
                    WHEN (SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_departamento, 0)) <= 0.81 THEN 'B'
                    WHEN (SUM(total_valor_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_departamento, 0)) <= 0.91 THEN 'C'
                    ELSE 'D'
                END AS curva_inicial
            FROM
                calculo_base
        ),
        analise_de_presenca AS (
            SELECT
                *,
                BOOL_OR(curva_inicial = 'A') OVER (PARTITION BY filial_id, departamento_id) as tem_A,
                BOOL_OR(curva_inicial = 'B') OVER (PARTITION BY filial_id, departamento_id) as tem_B,
                BOOL_OR(curva_inicial = 'C') OVER (PARTITION BY filial_id, departamento_id) as tem_C
            FROM
                calculo_curva_inicial
        )
        INSERT INTO temp_curva_final (id_produto, filial_id, curva_final)
        SELECT
            id_produto,
            filial_id,
            CASE
                WHEN curva_inicial = 'SV' THEN 'SV'
                WHEN total_produtos_no_grupo = 1 THEN 'A'
                WHEN tem_A = false AND ranking = 1 THEN 'A'
                WHEN tem_B = false AND ranking = 2 AND total_produtos_no_grupo >= 2 THEN 'B'
                WHEN tem_C = false AND ranking = 3 AND total_produtos_no_grupo >= 3 THEN 'C'
                ELSE curva_inicial
            END AS curva_final
        FROM
            analise_de_presenca;

        UPDATE %1$I.produtos p
        SET curva_abcd = tcf.curva_final
        FROM temp_curva_final tcf
        WHERE p.id = tcf.id_produto AND p.filial_id = tcf.filial_id;

    -- << MUDANÇA >> Passa os parâmetros na ordem correta para o format()
    $f$, p_schema_name, filial_filter_clause);

    EXECUTE dyn_sql;

    PERFORM public.log_job('atualizar_curva_abcd_30d', p_schema_name, 'SUCCESS', 'Filiais: ' || COALESCE(p_filiais_ids::text, 'TODAS'), start_time);

EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_job('atualizar_curva_abcd_30d', p_schema_name, 'ERROR', SQLERRM, start_time);
        RAISE;
END;
$_$;


--
-- Name: atualizar_curva_lucro(text, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_curva_lucro(p_schema_name text, p_filiais_ids bigint[]) RETURNS void
    LANGUAGE plpgsql
    AS $_$
DECLARE
    dyn_sql text;
    start_time timestamptz := clock_timestamp();
    filial_filter_clause text := '';
BEGIN
    IF p_filiais_ids IS NOT NULL AND array_length(p_filiais_ids, 1) > 0 THEN
        filial_filter_clause := format('AND p.filial_id = ANY(%L)', p_filiais_ids);
    END IF;

    dyn_sql := format($f$
        CREATE TEMP TABLE temp_curva_lucro_final (
            id_produto bigint,
            filial_id bigint,
            curva_final varchar(2)
        ) ON COMMIT DROP;

        WITH
        -- << ALTERADO >> Esta CTE foi reescrita para calcular o lucro dinamicamente
        calculo_base AS (
            SELECT
                p.filial_id,
                p.departamento_id,
                p.id as id_produto,
                -- Cálculo dinâmico do lucro a partir das tabelas base
                COALESCE(SUM(v.valor_vendas - (v.quantidade * p.custo_medio)), 0) as total_lucro_produto,
                SUM(COALESCE(SUM(v.valor_vendas - (v.quantidade * p.custo_medio)), 0)) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_lucro_departamento,
                ROW_NUMBER() OVER (PARTITION BY p.filial_id, p.departamento_id ORDER BY COALESCE(SUM(v.valor_vendas - (v.quantidade * p.custo_medio)), 0) DESC) as ranking,
                COUNT(*) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_produtos_no_grupo
            FROM
                %1$I.produtos p
            LEFT JOIN
                -- Join com a tabela de vendas, não mais com a de agregados
                %1$I.vendas v ON p.id = v.id_produto
                                AND p.filial_id = v.filial_id
                                AND v.data_venda >= (CURRENT_DATE - INTERVAL '30 days')
                                AND v.data_venda < CURRENT_DATE
            WHERE
                p.ativo = true
                %2$s
            GROUP BY
                -- Group by para agregar as vendas por produto
                p.filial_id, p.departamento_id, p.id
        ),
        -- Nenhuma alteração necessária daqui para baixo
        calculo_curva_inicial AS (
            SELECT
                *,
                SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as acumulado,
                CASE
                    WHEN total_lucro_produto <= 0 THEN 'SL'
                    WHEN (total_lucro_produto / NULLIF(total_lucro_departamento, 0)) > 0.50 THEN 'A'
                    WHEN (SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_lucro_departamento, 0)) <= 0.51 THEN 'A'
                    WHEN (SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_lucro_departamento, 0)) <= 0.81 THEN 'B'
                    WHEN (SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_lucro_departamento, 0)) <= 0.91 THEN 'C'
                    ELSE 'D'
                END AS curva_inicial
            FROM
                calculo_base
        ),
        analise_de_presenca AS (
            SELECT
                *,
                BOOL_OR(curva_inicial = 'A') OVER (PARTITION BY filial_id, departamento_id) as tem_A,
                BOOL_OR(curva_inicial = 'B') OVER (PARTITION BY filial_id, departamento_id) as tem_B,
                BOOL_OR(curva_inicial = 'C') OVER (PARTITION BY filial_id, departamento_id) as tem_C
            FROM
                calculo_curva_inicial
        )
        INSERT INTO temp_curva_lucro_final (id_produto, filial_id, curva_final)
        SELECT
            id_produto,
            filial_id,
            CASE
                WHEN curva_inicial = 'SL' THEN 'SL'
                WHEN total_produtos_no_grupo = 1 THEN 'A'
                WHEN tem_A = false AND ranking = 1 THEN 'A'
                WHEN tem_B = false AND ranking = 2 AND total_produtos_no_grupo >= 2 THEN 'B'
                WHEN tem_C = false AND ranking = 3 AND total_produtos_no_grupo >= 3 THEN 'C'
                ELSE curva_inicial
            END AS curva_final
        FROM
            analise_de_presenca;

        UPDATE %1$I.produtos p
        SET curva_lucro = tcf.curva_final
        FROM temp_curva_lucro_final tcf
        WHERE p.id = tcf.id_produto AND p.filial_id = tcf.filial_id;

    $f$, p_schema_name, filial_filter_clause);

    EXECUTE dyn_sql;

    PERFORM public.log_job('atualizar_curva_lucro', p_schema_name, 'SUCCESS', 'Filiais: ' || COALESCE(p_filiais_ids::text, 'TODAS'), start_time);

EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_job('atualizar_curva_lucro', p_schema_name, 'ERROR', SQLERRM, start_time);
        RAISE;
END;
$_$;


--
-- Name: atualizar_curva_lucro_30d(text, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_curva_lucro_30d(p_schema_name text, p_filiais_ids bigint[]) RETURNS void
    LANGUAGE plpgsql
    AS $_$
DECLARE
    dyn_sql text;
    start_time timestamptz := clock_timestamp();
    filial_filter_clause text := '';
BEGIN
    IF p_filiais_ids IS NOT NULL AND array_length(p_filiais_ids, 1) > 0 THEN
        filial_filter_clause := format('AND p.filial_id = ANY(%L)', p_filiais_ids);
    END IF;

    dyn_sql := format($f$
        CREATE TEMP TABLE temp_curva_lucro_final (
            id_produto bigint,
            filial_id bigint,
            curva_final varchar(2)
        ) ON COMMIT DROP;

        WITH
        calculo_base AS (
            SELECT
                p.filial_id,
                p.departamento_id,
                p.id as id_produto,
                -- Cálculo dinâmico do lucro
                COALESCE(SUM(v.valor_vendas - (v.quantidade * p.custo_medio)), 0) as total_lucro_produto,
                SUM(COALESCE(SUM(v.valor_vendas - (v.quantidade * p.custo_medio)), 0)) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_lucro_departamento,
                ROW_NUMBER() OVER (PARTITION BY p.filial_id, p.departamento_id ORDER BY COALESCE(SUM(v.valor_vendas - (v.quantidade * p.custo_medio)), 0) DESC) as ranking,
                COUNT(*) OVER (PARTITION BY p.filial_id, p.departamento_id) as total_produtos_no_grupo
            FROM
                %1$I.produtos p
            LEFT JOIN
                %1$I.vendas v ON p.id = v.id_produto
                                AND p.filial_id = v.filial_id
                                AND v.data_venda >= (CURRENT_DATE - INTERVAL '30 days')
                                AND v.data_venda < CURRENT_DATE
            WHERE
                p.ativo = true
                %2$s
            GROUP BY
                p.filial_id, p.departamento_id, p.id
        ),
        calculo_curva_inicial AS (
            SELECT
                *,
                SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as acumulado,
                CASE
                    WHEN total_lucro_produto <= 0 THEN 'SL'
                    WHEN (total_lucro_produto / NULLIF(total_lucro_departamento, 0)) > 0.50 THEN 'A'
                    WHEN (SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_lucro_departamento, 0)) <= 0.51 THEN 'A'
                    WHEN (SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_lucro_departamento, 0)) <= 0.81 THEN 'B'
                    WHEN (SUM(total_lucro_produto) OVER (PARTITION BY filial_id, departamento_id ORDER BY ranking ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / NULLIF(total_lucro_departamento, 0)) <= 0.91 THEN 'C'
                    ELSE 'D'
                END AS curva_inicial
            FROM
                calculo_base
        ),
        analise_de_presenca AS (
            SELECT
                *,
                BOOL_OR(curva_inicial = 'A') OVER (PARTITION BY filial_id, departamento_id) as tem_A,
                BOOL_OR(curva_inicial = 'B') OVER (PARTITION BY filial_id, departamento_id) as tem_B,
                BOOL_OR(curva_inicial = 'C') OVER (PARTITION BY filial_id, departamento_id) as tem_C
            FROM
                calculo_curva_inicial
        )
        INSERT INTO temp_curva_lucro_final (id_produto, filial_id, curva_final)
        SELECT
            id_produto,
            filial_id,
            CASE
                WHEN curva_inicial = 'SL' THEN 'SL'
                WHEN total_produtos_no_grupo = 1 THEN 'A'
                WHEN tem_A = false AND ranking = 1 THEN 'A'
                WHEN tem_B = false AND ranking = 2 AND total_produtos_no_grupo >= 2 THEN 'B'
                WHEN tem_C = false AND ranking = 3 AND total_produtos_no_grupo >= 3 THEN 'C'
                ELSE curva_inicial
            END AS curva_final
        FROM
            analise_de_presenca;

        UPDATE %1$I.produtos p
        SET curva_lucro = tcf.curva_final
        FROM temp_curva_lucro_final tcf
        WHERE p.id = tcf.id_produto AND p.filial_id = tcf.filial_id;

    $f$, p_schema_name, filial_filter_clause);

    EXECUTE dyn_sql;

    PERFORM public.log_job('atualizar_curva_lucro_30d', p_schema_name, 'SUCCESS', 'Filiais: ' || COALESCE(p_filiais_ids::text, 'TODAS'), start_time);

EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_job('atualizar_curva_lucro_30d', p_schema_name, 'ERROR', SQLERRM, start_time);
        RAISE;
END;
$_$;


--
-- Name: atualizar_despesas_diarias(text, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_despesas_diarias(p_schema_name text, p_data_inicial date, p_data_final date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    -- ETAPA 1: DELETA todos os registros do período
    EXECUTE format('
        DELETE FROM %I.despesas_diarias_por_filial
        WHERE data_referencia BETWEEN $1 AND $2
    ', p_schema_name)
    USING p_data_inicial, p_data_final;

    -- ETAPA 2: INSERE todos os dados recalculados (SEM ON CONFLICT)
    EXECUTE format('
        INSERT INTO %I.despesas_diarias_por_filial (
            filial_id, 
            data_referencia, 
            total_valor, 
            quantidade_lancamentos, 
            updated_at
        )
        SELECT
            d.filial_id,
            d.data_despesa,
            SUM(d.valor),
            COUNT(*),
            NOW()
        FROM %I.despesas d
        WHERE d.data_despesa BETWEEN $1 AND $2
        GROUP BY d.filial_id, d.data_despesa
    ', p_schema_name, p_schema_name)
    USING p_data_inicial, p_data_final;
END;
$_$;


--
-- Name: atualizar_dias_com_venda_60d(text, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_dias_com_venda_60d(schema_name text, p_filiais integer[] DEFAULT NULL::integer[]) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  start_time timestamptz := clock_timestamp();
  v_filiais_msg text;
BEGIN
  SET statement_timeout = '600s';
  
  v_filiais_msg := COALESCE(p_filiais::text, 'TODAS');
  
  EXECUTE format('
    WITH produtos_ativos AS (
      SELECT id, filial_id
      FROM %I.produtos
      WHERE venda_media_diaria_60d > 0
        AND ($1 IS NULL OR filial_id = ANY($1))
    ),
    -- CORRETO: 60 dias ANTES dos últimos 3 (dia -63 até dia -4)
    calculo_dias_60d AS (
      SELECT
        v.id_produto,
        v.filial_id,
        COUNT(DISTINCT v.data_venda) AS total_dias_60d
      FROM %I.vendas v
      JOIN produtos_ativos pa ON v.id_produto = pa.id AND v.filial_id = pa.filial_id
      WHERE
        v.data_venda >= (CURRENT_DATE - INTERVAL ''63 days'')
        AND v.data_venda < (CURRENT_DATE - INTERVAL ''3 days'')
        AND ($1 IS NULL OR v.filial_id = ANY($1))
      GROUP BY v.id_produto, v.filial_id
    ),
    -- CORRETO: Últimos 3 dias (dia -3 até dia -1, não incluindo hoje)
    calculo_dias_3d AS (
      SELECT
        v.id_produto,
        v.filial_id,
        COUNT(DISTINCT v.data_venda) AS total_dias_3d
      FROM %I.vendas v
      JOIN produtos_ativos pa ON v.id_produto = pa.id AND v.filial_id = pa.filial_id
      WHERE
        v.data_venda >= (CURRENT_DATE - INTERVAL ''3 days'')
        AND v.data_venda < CURRENT_DATE
        AND ($1 IS NULL OR v.filial_id = ANY($1))
      GROUP BY v.id_produto, v.filial_id
    )
    UPDATE %I.produtos p
    SET
      dias_com_venda_60d = COALESCE(cd60.total_dias_60d, 0),
      dias_com_venda_ultimos_3d = COALESCE(cd3.total_dias_3d, 0)
    FROM produtos_ativos pa
    LEFT JOIN calculo_dias_60d cd60 ON pa.id = cd60.id_produto AND pa.filial_id = cd60.filial_id
    LEFT JOIN calculo_dias_3d cd3 ON pa.id = cd3.id_produto AND pa.filial_id = cd3.filial_id
    WHERE
      p.id = pa.id 
      AND p.filial_id = pa.filial_id
      AND ($1 IS NULL OR p.filial_id = ANY($1));
    
    -- Zerar produtos sem venda média
    UPDATE %I.produtos
    SET 
      dias_com_venda_60d = 0,
      dias_com_venda_ultimos_3d = 0
    WHERE COALESCE(venda_media_diaria_60d, 0) <= 0
      AND ($1 IS NULL OR filial_id = ANY($1));
  ', schema_name, schema_name, schema_name, schema_name, schema_name) USING p_filiais;
  
  PERFORM public.log_job(
      'atualizar_dias_com_venda_60d',
      schema_name,
      'SUCCESS',
      'Dias com venda (60d e 3d) atualizados. Filiais: ' || v_filiais_msg,
      start_time
  );
  
  RETURN 'Contagem de dias com venda concluída para ' || schema_name || ' - Filiais: ' || v_filiais_msg;
         
EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_job(
            'atualizar_dias_com_venda_60d',
            schema_name,
            'ERROR',
            SQLERRM || ' - Filiais: ' || v_filiais_msg,
            start_time
        );
        RAISE;
END;
$_$;


--
-- Name: FUNCTION atualizar_dias_com_venda_60d(schema_name text, p_filiais integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.atualizar_dias_com_venda_60d(schema_name text, p_filiais integer[]) IS 'Atualiza dias_com_venda_60d (dia -63 a -4) e dias_com_venda_ultimos_3d (dia -3 a -1). Total: 63 dias sem sobreposição.';


--
-- Name: atualizar_dias_com_venda_60d_batch(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_dias_com_venda_60d_batch(schema_name text) RETURNS text
    LANGUAGE plpgsql
    AS $_$
DECLARE
  start_time timestamptz := clock_timestamp();
  batch_size INT := 5000;
  offset_val INT := 0;
  total_produtos INT;
  rows_affected INT;
  data_inicio DATE := CURRENT_DATE - INTERVAL '59 days';
BEGIN
  SET statement_timeout = '600s';
  
  EXECUTE format('SELECT COUNT(*) FROM %I.produtos WHERE venda_media_diaria_60d > 0', schema_name) 
  INTO total_produtos;
  
  RAISE NOTICE 'Total de produtos a processar: %', total_produtos;
  
  LOOP
    EXECUTE format('
      WITH produtos_batch AS (
        SELECT id, filial_id
        FROM %I.produtos
        WHERE venda_media_diaria_60d > 0
        ORDER BY id, filial_id
        LIMIT $1 OFFSET $2
      ),
      calculo_dias AS (
        SELECT
          v.id_produto,
          v.filial_id,
          COUNT(DISTINCT DATE(v.data_venda)) AS total_dias
        FROM %I.vendas v
        INNER JOIN produtos_batch pb 
          ON v.id_produto = pb.id 
          AND v.filial_id = pb.filial_id
        WHERE v.data_venda >= $3 
          AND v.data_venda < CURRENT_DATE
        GROUP BY v.id_produto, v.filial_id
      )
      UPDATE %I.produtos p
      SET dias_com_venda_60d = COALESCE(cd.total_dias, 0),
          updated_at = NOW()
      FROM produtos_batch pb
      LEFT JOIN calculo_dias cd 
        ON pb.id = cd.id_produto 
        AND pb.filial_id = cd.filial_id
      WHERE p.id = pb.id 
        AND p.filial_id = pb.filial_id
    ', schema_name, schema_name, schema_name)
    USING batch_size, offset_val, data_inicio;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    EXIT WHEN rows_affected = 0;
    
    offset_val := offset_val + batch_size;
    RAISE NOTICE 'Processados: %/%', offset_val, total_produtos;
    
    -- Commit parcial
    COMMIT;
  END LOOP;
  
  -- Zerar inativos
  EXECUTE format('
    UPDATE %I.produtos
    SET dias_com_venda_60d = 0, updated_at = NOW()
    WHERE COALESCE(venda_media_diaria_60d, 0) <= 0
      AND COALESCE(dias_com_venda_60d, 0) != 0
  ', schema_name);
  
  RETURN format('Concluído: %s produtos em %s', 
    total_produtos, 
    clock_timestamp() - start_time
  );
END;
$_$;


--
-- Name: atualizar_dias_de_estoque(text, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_dias_de_estoque(schema_name text, p_filiais integer[] DEFAULT NULL::integer[]) RETURNS text
    LANGUAGE plpgsql
    AS $_$
DECLARE
  start_time timestamptz := clock_timestamp();
  rows_updated INT;
  v_filiais_msg text;
BEGIN
  SET LOCAL statement_timeout = '300s';
  SET LOCAL work_mem = '512MB';
  
  -- Mensagem informativa sobre quais filiais estão sendo processadas
  v_filiais_msg := COALESCE(p_filiais::text, 'TODAS');
  
  -- UPDATE único e direto (o índice vai acelerar)
  EXECUTE format('
    UPDATE %I.produtos
    SET dias_de_estoque = estoque_atual / venda_media_diaria_60d
    WHERE venda_media_diaria_60d > 0
      AND COALESCE(estoque_atual, 0) > 0
      AND ($1 IS NULL OR filial_id = ANY($1))
  ', schema_name) USING p_filiais;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Zera os que não têm condições
  EXECUTE format('
    UPDATE %I.produtos
    SET dias_de_estoque = 0
    WHERE venda_media_diaria_60d > 0
      AND (estoque_atual IS NULL OR estoque_atual <= 0)
      AND ($1 IS NULL OR filial_id = ANY($1))
  ', schema_name) USING p_filiais;
  
  PERFORM public.log_job(
      'atualizar_dias_de_estoque',
      schema_name,
      'SUCCESS',
      format('%s produtos atualizados - Filiais: %s', rows_updated, v_filiais_msg),
      start_time
  );
  
  RETURN format('%s produtos atualizados em %s segundos - Filiais: %s', 
                rows_updated, 
                EXTRACT(EPOCH FROM (clock_timestamp() - start_time))::INT,
                v_filiais_msg);
                
EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_job(
            'atualizar_dias_de_estoque', 
            schema_name, 
            'ERROR', 
            SQLERRM || ' - Filiais: ' || v_filiais_msg, 
            start_time
        );
        RAISE;
END;
$_$;


--
-- Name: atualizar_metricas_dias_com_venda_60d(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_metricas_dias_com_venda_60d(schema_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  start_time timestamptz := clock_timestamp();
BEGIN
  SET statement_timeout = '900s'; -- 15 minutos

  -- Este comando usa o índice único que você criou para atualizar a MV sem travar leituras
  EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I.metricas_dias_com_vendas_60d;', schema_name);

  PERFORM public.log_job(
      'atualizar_metricas_dias_com_venda_60d', schema_name, 'SUCCESS',
      'Materialized View de dias com venda (60d) foi atualizada.', start_time
  );
  RETURN 'Materialized View atualizada para o schema ' || schema_name;

EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_job(
            'atualizar_metricas_dias_com_venda_60d', schema_name, 'ERROR',
            SQLERRM, start_time
        );
        RAISE;
END;
$$;


--
-- Name: atualizar_metricas_por_filial(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_metricas_por_filial(schema_name text, p_filial_id bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '600s'
    AS $_$
BEGIN
  EXECUTE format('UPDATE %I.produtos SET venda_media_diaria_60d = 0, dias_de_estoque = NULL, dias_com_venda_60d = 0 WHERE filial_id = $1;', schema_name) USING p_filial_id;
  EXECUTE format('WITH vendas_recentes AS (SELECT v.id_produto, v.filial_id, SUM(v.quantidade) AS total_vendido_60d, COUNT(DISTINCT v.data_venda) AS dias_com_venda FROM %I.vendas AS v WHERE v.data_venda >= (CURRENT_DATE - INTERVAL ''60 days'') AND v.filial_id = $1 GROUP BY v.id_produto, v.filial_id) UPDATE %I.produtos AS p SET dias_com_venda_60d = vr.dias_com_venda, venda_media_diaria_60d = vr.total_vendido_60d / 60.0, dias_de_estoque = CASE WHEN vr.total_vendido_60d > 0 THEN p.estoque_atual / (vr.total_vendido_60d / 60.0) ELSE NULL END FROM vendas_recentes AS vr WHERE p.id = vr.id_produto AND p.filial_id = vr.filial_id;', schema_name, schema_name) USING p_filial_id;
  RETURN 'Métricas de produto atualizadas para o schema ' || schema_name || ' e filial ' || p_filial_id;
END;
$_$;


--
-- Name: atualizar_produtos_com_dias_de_venda(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_produtos_com_dias_de_venda(schema_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  start_time timestamptz := clock_timestamp();
BEGIN
  -- Esta função é rápida, pois lê de uma Materialized View,
  -- então um timeout menor é suficiente.
  SET statement_timeout = '300s'; -- 5 minutos

  EXECUTE format('
    -- Passo 1: Atualiza os produtos que tiveram vendas.
    -- Ele busca o valor já calculado na sua Materialized View.
    UPDATE
        %I.produtos p
    SET
        dias_com_venda_60d = mv.dias_com_venda_60d
    FROM
        %I.metricas_dias_com_vendas_60d mv
    WHERE
        p.id = mv.id_produto
        AND p.filial_id = mv.filial_id;

    -- Passo 2: Zera a contagem para os produtos que não tiveram vendas.
    -- (aqueles que não foram encontrados na Materialized View).
    UPDATE
        %I.produtos
    SET
        dias_com_venda_60d = 0
    WHERE
        dias_com_venda_60d IS NULL;

  ', schema_name, schema_name, schema_name);

  -- Log de sucesso
  PERFORM public.log_job(
      'atualizar_produtos_com_dias_de_venda', schema_name, 'SUCCESS',
      'Coluna dias_com_venda_60d foi sincronizada na tabela de produtos.', start_time
  );
  RETURN 'Coluna dias_com_venda_60d na tabela de produtos foi atualizada para o schema ' || schema_name;

EXCEPTION
    -- Log de erro
    WHEN OTHERS THEN
        PERFORM public.log_job(
            'atualizar_produtos_com_dias_de_venda', schema_name, 'ERROR',
            SQLERRM, start_time
        );
        RAISE;
END;
$$;


--
-- Name: atualizar_resumo_vendas_caixa(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_resumo_vendas_caixa(p_schema_name text, p_data date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    EXECUTE format('
        INSERT INTO %I.resumo_vendas_caixa (filial_id, caixa, data, qtde_cupons, qtde_produtos, valor_total_vendas, valor_total_vendas_canceladas, valor_total_produtos_cancelados, updated_at)
        WITH cupons_resumo AS (
            SELECT
                filial_id,
                caixa,
                cupom,
                cancelada,
                valor_total
            FROM %I.vendas_hoje
        ),
        itens_resumo AS (
            SELECT
                filial_id,
                cupom,
                SUM(CASE WHEN NOT cancelado THEN quantidade_vendida ELSE 0 END) AS qtde_produtos,
                SUM(CASE WHEN cancelado THEN quantidade_vendida * preco_venda ELSE 0 END) AS valor_produtos_cancelados
            FROM %I.vendas_hoje_itens
            GROUP BY filial_id, cupom
        )
        SELECT
            c.filial_id,
            c.caixa,
            $1 AS data,
            COUNT(DISTINCT c.cupom)::INTEGER AS qtde_cupons,
            COALESCE(SUM(CASE WHEN NOT c.cancelada THEN i.qtde_produtos ELSE 0 END), 0)::INTEGER AS qtde_produtos,
            COALESCE(SUM(CASE WHEN NOT c.cancelada THEN c.valor_total ELSE 0 END), 0) AS valor_total_vendas,
            COALESCE(SUM(CASE WHEN c.cancelada THEN c.valor_total ELSE 0 END), 0) AS valor_total_vendas_canceladas,
            COALESCE(SUM(CASE WHEN NOT c.cancelada THEN i.valor_produtos_cancelados ELSE 0 END), 0) AS valor_total_produtos_cancelados,
            NOW()
        FROM cupons_resumo c
        LEFT JOIN itens_resumo i ON c.filial_id = i.filial_id AND c.cupom = i.cupom
        GROUP BY c.filial_id, c.caixa
        ON CONFLICT (filial_id, caixa, data) DO UPDATE SET
            qtde_cupons = EXCLUDED.qtde_cupons,
            qtde_produtos = EXCLUDED.qtde_produtos,
            valor_total_vendas = EXCLUDED.valor_total_vendas,
            valor_total_vendas_canceladas = EXCLUDED.valor_total_vendas_canceladas,
            valor_total_produtos_cancelados = EXCLUDED.valor_total_produtos_cancelados,
            updated_at = NOW()
    ', p_schema_name, p_schema_name, p_schema_name) USING p_data;
END;
$_$;


--
-- Name: atualizar_valores_realizados_metas(text, integer, integer, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_valores_realizados_metas(p_schema text, p_mes integer, p_ano integer, p_filial_id bigint DEFAULT NULL::bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_data_inicio date;
  v_data_fim date;
  v_rows_updated integer := 0;
  v_message text;
BEGIN
  -- Calcular primeiro e ultimo dia do mes
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;

  -- Atualizar valores realizados das metas
  IF p_filial_id IS NULL THEN
    -- Atualizar para todas as filiais
    EXECUTE format('
      UPDATE %I.metas_mensais mm
      SET
        valor_realizado = (
          COALESCE((
            SELECT SUM(v.valor_vendas)
            FROM %I.vendas v
            WHERE v.data_venda = mm.data
              AND v.filial_id = mm.filial_id
          ), 0) - COALESCE((
            SELECT SUM(d.valor_desconto)
            FROM %I.descontos_venda d
            WHERE d.data_desconto = mm.data
              AND d.filial_id = mm.filial_id
          ), 0)
        ),
        custo_realizado = COALESCE((
          SELECT SUM(v.quantidade * v.custo_compra)
          FROM %I.vendas v
          WHERE v.data_venda = mm.data
            AND v.filial_id = mm.filial_id
        ), 0),
        lucro_realizado = (
          COALESCE((
            SELECT SUM(v.valor_vendas)
            FROM %I.vendas v
            WHERE v.data_venda = mm.data
              AND v.filial_id = mm.filial_id
          ), 0) - COALESCE((
            SELECT SUM(d.valor_desconto)
            FROM %I.descontos_venda d
            WHERE d.data_desconto = mm.data
              AND d.filial_id = mm.filial_id
          ), 0)
        ) - COALESCE((
          SELECT SUM(v.quantidade * v.custo_compra)
          FROM %I.vendas v
          WHERE v.data_venda = mm.data
            AND v.filial_id = mm.filial_id
        ), 0),
        diferenca = (
          (COALESCE((
            SELECT SUM(v.valor_vendas)
            FROM %I.vendas v
            WHERE v.data_venda = mm.data
              AND v.filial_id = mm.filial_id
          ), 0) - COALESCE((
            SELECT SUM(d.valor_desconto)
            FROM %I.descontos_venda d
            WHERE d.data_desconto = mm.data
              AND d.filial_id = mm.filial_id
          ), 0)) - mm.valor_meta
        ),
        diferenca_percentual = CASE
          WHEN mm.valor_meta > 0 THEN
            ((((COALESCE((
              SELECT SUM(v.valor_vendas)
              FROM %I.vendas v
              WHERE v.data_venda = mm.data
                AND v.filial_id = mm.filial_id
            ), 0) - COALESCE((
              SELECT SUM(d.valor_desconto)
              FROM %I.descontos_venda d
              WHERE d.data_desconto = mm.data
                AND d.filial_id = mm.filial_id
            ), 0)) - mm.valor_meta) / mm.valor_meta) * 100)
          ELSE 0
        END,
        updated_at = NOW()
      WHERE mm.data >= $1
        AND mm.data <= $2
    ', p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema)
    USING v_data_inicio, v_data_fim;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    v_message := format('Valores atualizados com sucesso para %s metas', v_rows_updated);
  ELSE
    -- Atualizar para filial especifica
    EXECUTE format('
      UPDATE %I.metas_mensais mm
      SET
        valor_realizado = (
          COALESCE((
            SELECT SUM(v.valor_vendas)
            FROM %I.vendas v
            WHERE v.data_venda = mm.data
              AND v.filial_id = mm.filial_id
          ), 0) - COALESCE((
            SELECT SUM(d.valor_desconto)
            FROM %I.descontos_venda d
            WHERE d.data_desconto = mm.data
              AND d.filial_id = mm.filial_id
          ), 0)
        ),
        custo_realizado = COALESCE((
          SELECT SUM(v.quantidade * v.custo_compra)
          FROM %I.vendas v
          WHERE v.data_venda = mm.data
            AND v.filial_id = mm.filial_id
        ), 0),
        lucro_realizado = (
          COALESCE((
            SELECT SUM(v.valor_vendas)
            FROM %I.vendas v
            WHERE v.data_venda = mm.data
              AND v.filial_id = mm.filial_id
          ), 0) - COALESCE((
            SELECT SUM(d.valor_desconto)
            FROM %I.descontos_venda d
            WHERE d.data_desconto = mm.data
              AND d.filial_id = mm.filial_id
          ), 0)
        ) - COALESCE((
          SELECT SUM(v.quantidade * v.custo_compra)
          FROM %I.vendas v
          WHERE v.data_venda = mm.data
            AND v.filial_id = mm.filial_id
        ), 0),
        diferenca = (
          (COALESCE((
            SELECT SUM(v.valor_vendas)
            FROM %I.vendas v
            WHERE v.data_venda = mm.data
              AND v.filial_id = mm.filial_id
          ), 0) - COALESCE((
            SELECT SUM(d.valor_desconto)
            FROM %I.descontos_venda d
            WHERE d.data_desconto = mm.data
              AND d.filial_id = mm.filial_id
          ), 0)) - mm.valor_meta
        ),
        diferenca_percentual = CASE
          WHEN mm.valor_meta > 0 THEN
            ((((COALESCE((
              SELECT SUM(v.valor_vendas)
              FROM %I.vendas v
              WHERE v.data_venda = mm.data
                AND v.filial_id = mm.filial_id
            ), 0) - COALESCE((
              SELECT SUM(d.valor_desconto)
              FROM %I.descontos_venda d
              WHERE d.data_desconto = mm.data
                AND d.filial_id = mm.filial_id
            ), 0)) - mm.valor_meta) / mm.valor_meta) * 100)
          ELSE 0
        END,
        updated_at = NOW()
      WHERE mm.data >= $1
        AND mm.data <= $2
        AND mm.filial_id = $3
    ', p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema, p_schema)
    USING v_data_inicio, v_data_fim, p_filial_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    v_message := format('Valores atualizados com sucesso para %s metas da filial %s', v_rows_updated, p_filial_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', v_message,
    'rows_updated', v_rows_updated,
    'periodo', jsonb_build_object(
      'mes', p_mes,
      'ano', p_ano,
      'data_inicio', v_data_inicio,
      'data_fim', v_data_fim
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Erro ao atualizar valores: ' || SQLERRM,
      'rows_updated', 0
    );
END;
$_$;


--
-- Name: FUNCTION atualizar_valores_realizados_metas(p_schema text, p_mes integer, p_ano integer, p_filial_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.atualizar_valores_realizados_metas(p_schema text, p_mes integer, p_ano integer, p_filial_id bigint) IS 'Atualiza os valores realizados das metas mensais com base nas vendas e descontos. Nota: Esta função NÃO suporta múltiplas filiais via string separada por vírgulas.';


--
-- Name: atualizar_valores_realizados_metas_setor(text, bigint, integer, integer, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_valores_realizados_metas_setor(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_id bigint DEFAULT NULL::bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '90s'
    SET work_mem TO '256MB'
    AS $_$
DECLARE
  v_departamento_nivel INT;
  v_departamento_ids BIGINT[];
  v_coluna_pai TEXT;
  v_sql TEXT;
  v_rows_updated INT;
  v_schema_quoted TEXT;
  v_date_start DATE;
  v_date_end DATE;
  v_query_start TIMESTAMP;
  v_query_duration INTERVAL;
BEGIN
  v_query_start := clock_timestamp();

  -- Validar parametros
  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RETURN jsonb_build_object(
      'error', true,
      'message', 'Schema, setor_id, mes e ano sao obrigatorios'
    );
  END IF;

  v_schema_quoted := quote_ident(p_schema);

  -- Calcular range de datas UMA VEZ
  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := v_date_start + INTERVAL '1 month' - INTERVAL '1 day';

  -- 1. Buscar configuracao do setor
  EXECUTE format('
    SELECT departamento_nivel, departamento_ids
    FROM %I.setores
    WHERE id = $1 AND ativo = true
  ', p_schema)
  INTO v_departamento_nivel, v_departamento_ids
  USING p_setor_id;

  IF v_departamento_nivel IS NULL THEN
    RETURN jsonb_build_object(
      'error', true,
      'message', format('Setor %s nao encontrado ou inativo', p_setor_id)
    );
  END IF;

  IF v_departamento_ids IS NULL OR array_length(v_departamento_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'error', true,
      'message', format('Setor %s nao tem departamentos configurados', p_setor_id),
      'rows_updated', 0,
      'setor_id', p_setor_id
    );
  END IF;

  -- 2. Construir nome da coluna pai dinamicamente
  v_coluna_pai := format('pai_level_%s_id', v_departamento_nivel);

  RAISE NOTICE 'Processando setor %: nivel=%, departamentos=%, coluna=%',
    p_setor_id, v_departamento_nivel, array_length(v_departamento_ids, 1), v_coluna_pai;
  RAISE NOTICE 'Periodo: % a %', v_date_start, v_date_end;

  -- 3. QUERY OTIMIZADA: Range query + covering index + custo/lucro
  v_sql := format('
    WITH vendas_por_data_filial AS (
      SELECT
        v.data_venda,
        v.filial_id,
        SUM(v.valor_vendas) - COALESCE(SUM(d.valor_desconto), 0) AS total_vendas,
        SUM(v.quantidade * v.custo_compra) AS total_custo,
        (SUM(v.valor_vendas) - COALESCE(SUM(d.valor_desconto), 0)) - SUM(v.quantidade * v.custo_compra) AS total_lucro
      FROM %I.vendas v
      INNER JOIN %I.produtos p
        ON p.id = v.id_produto
        AND p.filial_id = v.filial_id
      INNER JOIN %I.departments_level_1 dl1
        ON dl1.departamento_id = p.departamento_id
        AND dl1.%I = ANY($1)
      LEFT JOIN %I.descontos_venda d
        ON d.data_desconto = v.data_venda
        AND d.filial_id = v.filial_id
      WHERE
        v.data_venda >= $2
        AND v.data_venda <= $3
        AND ($4 IS NULL OR v.filial_id = $4)
      GROUP BY v.data_venda, v.filial_id
    )
    UPDATE %I.metas_setor ms
    SET
      valor_realizado = COALESCE(vpd.total_vendas, 0),
      custo_realizado = COALESCE(vpd.total_custo, 0),
      lucro_realizado = COALESCE(vpd.total_lucro, 0),
      diferenca = COALESCE(vpd.total_vendas, 0) - ms.valor_meta,
      diferenca_percentual = CASE
        WHEN ms.valor_meta > 0 THEN
          ((COALESCE(vpd.total_vendas, 0) / ms.valor_meta) - 1) * 100
        ELSE 0
      END,
      updated_at = NOW()
    FROM vendas_por_data_filial vpd
    WHERE
      ms.setor_id = $5
      AND ms.data = vpd.data_venda
      AND ms.filial_id = vpd.filial_id
      AND (
        ms.valor_realizado IS DISTINCT FROM COALESCE(vpd.total_vendas, 0)
        OR ms.custo_realizado IS DISTINCT FROM COALESCE(vpd.total_custo, 0)
        OR ms.lucro_realizado IS DISTINCT FROM COALESCE(vpd.total_lucro, 0)
      )
  ',
    p_schema,         -- FROM vendas
    p_schema,         -- JOIN produtos
    p_schema,         -- JOIN departments_level_1
    v_coluna_pai,     -- coluna pai dinamica
    p_schema,         -- LEFT JOIN descontos_venda
    p_schema          -- UPDATE metas_setor
  );

  -- Executar o UPDATE
  EXECUTE v_sql
  USING v_departamento_ids, v_date_start, v_date_end, p_filial_id, p_setor_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  v_query_duration := clock_timestamp() - v_query_start;

  RAISE NOTICE 'Setor % atualizado: % linhas em %', p_setor_id, v_rows_updated, v_query_duration;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'rows_updated', v_rows_updated,
    'setor_id', p_setor_id,
    'mes', p_mes,
    'ano', p_ano,
    'filial_id', p_filial_id,
    'duration_ms', EXTRACT(EPOCH FROM v_query_duration) * 1000
  );

EXCEPTION
  WHEN query_canceled THEN
    RETURN jsonb_build_object(
      'error', true,
      'message', 'Timeout ao atualizar valores (>90s). Verifique se os indices foram criados.',
      'setor_id', p_setor_id,
      'timeout', true
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', true,
      'message', SQLERRM,
      'detail', SQLSTATE,
      'setor_id', p_setor_id
    );
END;
$_$;


--
-- Name: FUNCTION atualizar_valores_realizados_metas_setor(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.atualizar_valores_realizados_metas_setor(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_id bigint) IS 'Atualiza os valores realizados de um setor específico para um mês/ano (VERSÃO OTIMIZADA).

OTIMIZAÇÕES APLICADAS:
- Range query (data >= X AND data <= Y) ao invés de EXTRACT()
- Usa índice covering idx_vendas_data_covering
- Usa índices idx_dept_pai_level_X para JOINs dinâmicos
- work_mem aumentado para 256MB
- Timeout aumentado para 90s

PERFORMANCE:
- Tempo médio: 5-10 segundos (antes: 45-60s)
- Taxa de timeout: <5% (antes: ~30%)
- Usa índices: Index Scan + Covering Index (antes: Seq Scan)

LÓGICA:
1. Busca configuração do setor (departamento_nivel + departamento_ids)
2. Constrói nome da coluna dinâmica: pai_level_X_id
3. JOIN com departments_level_1 usando coluna dinâmica
4. Filtra vendas por produtos que pertencem aos departamentos deste setor
5. Calcula: SUM(valor_vendas) - SUM(descontos)
6. Atualiza metas_setor apenas para linhas que mudaram (IS DISTINCT FROM)

PARÂMETROS:
- p_schema: Nome do schema do tenant (ex: ''okilao'')
- p_setor_id: ID do setor
- p_mes: Mês (1-12)
- p_ano: Ano (ex: 2025)
- p_filial_id: ID da filial (opcional, NULL = todas)

RETORNO:
JSONB com:
- rows_updated: número de linhas atualizadas
- setor_id: ID do setor processado
- mes, ano, filial_id: parâmetros usados
- duration_ms: tempo de execução em milissegundos
- error: true se houver erro (com message e detail)

EXEMPLO:
SELECT public.atualizar_valores_realizados_metas_setor(
  ''okilao'',  -- schema
  1,           -- setor_id
  11,          -- mês
  2025,        -- ano
  NULL         -- todas filiais
);

RESULTADO ESPERADO:
{
  "rows_updated": 150,
  "setor_id": 1,
  "mes": 11,
  "ano": 2025,
  "filial_id": null,
  "duration_ms": 5432.12
}';


--
-- Name: atualizar_valores_realizados_todos_setores(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_valores_realizados_todos_setores(p_schema text, p_mes integer, p_ano integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '180s'
    SET work_mem TO '512MB'
    AS $_$
  DECLARE
    v_date_start DATE;
    v_date_end DATE;
    v_query_start TIMESTAMP;
    v_query_duration INTERVAL;
    v_total_rows INT := 0;
    v_total_setores INT := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_update_sql TEXT;
  BEGIN
    v_query_start := clock_timestamp();

    IF p_schema IS NULL OR p_mes IS NULL OR p_ano IS
  NULL THEN
      RAISE EXCEPTION 'Schema, mes e ano sao
  obrigatorios';
    END IF;

    IF p_mes < 1 OR p_mes > 12 THEN
      RAISE EXCEPTION 'Mes invalido: %', p_mes;
    END IF;

    v_date_start := make_date(p_ano, p_mes, 1);
    v_date_end := v_date_start + INTERVAL '1 month'
  - INTERVAL '1 day';

    RAISE NOTICE 'Processando valores realizados
  para: schema=%, mes=%, ano=%',
      p_schema, p_mes, p_ano;
    RAISE NOTICE 'Periodo: % a %', v_date_start,
  v_date_end;
    RAISE NOTICE '';
    RAISE NOTICE 'ESTRATEGIA: UNION ALL (processa
  todos setores de uma vez) SEM DESCONTO';
    RAISE NOTICE '';

    v_update_sql := format('
      WITH setores_ativos AS (
        SELECT
          id AS setor_id,
          nome AS setor_nome,
          departamento_nivel,
          departamento_ids
        FROM %I.setores
        WHERE ativo = true
      ),
      vendas_por_setor AS (
        -- NIVEL 2
        SELECT
          sa.setor_id,
          v.data_venda,
          v.filial_id,
          SUM(v.valor_vendas) AS total_vendas,
          SUM(v.quantidade * v.custo_compra) AS
  total_custo,
          SUM(v.valor_vendas) - SUM(v.quantidade *
  v.custo_compra) AS total_lucro
        FROM setores_ativos sa
        INNER JOIN %I.departments_level_1 dl1
          ON dl1.pai_level_2_id =
  ANY(sa.departamento_ids)
          AND sa.departamento_nivel = 2
        INNER JOIN %I.produtos p
          ON p.departamento_id = dl1.departamento_id
        INNER JOIN %I.vendas v
          ON v.id_produto = p.id
          AND v.filial_id = p.filial_id
          AND v.data_venda >= $1
          AND v.data_venda <= $2
        WHERE sa.departamento_nivel = 2
        GROUP BY sa.setor_id, v.data_venda,
  v.filial_id

        UNION ALL

        -- NIVEL 3
        SELECT
          sa.setor_id,
          v.data_venda,
          v.filial_id,
          SUM(v.valor_vendas) AS total_vendas,
          SUM(v.quantidade * v.custo_compra) AS
  total_custo,
          SUM(v.valor_vendas) - SUM(v.quantidade *
  v.custo_compra) AS total_lucro
        FROM setores_ativos sa
        INNER JOIN %I.departments_level_1 dl1
          ON dl1.pai_level_3_id =
  ANY(sa.departamento_ids)
          AND sa.departamento_nivel = 3
        INNER JOIN %I.produtos p
          ON p.departamento_id = dl1.departamento_id
        INNER JOIN %I.vendas v
          ON v.id_produto = p.id
          AND v.filial_id = p.filial_id
          AND v.data_venda >= $1
          AND v.data_venda <= $2
        WHERE sa.departamento_nivel = 3
        GROUP BY sa.setor_id, v.data_venda,
  v.filial_id

        UNION ALL

        -- NIVEL 4
        SELECT
          sa.setor_id,
          v.data_venda,
          v.filial_id,
          SUM(v.valor_vendas) AS total_vendas,
          SUM(v.quantidade * v.custo_compra) AS
  total_custo,
          SUM(v.valor_vendas) - SUM(v.quantidade *
  v.custo_compra) AS total_lucro
        FROM setores_ativos sa
        INNER JOIN %I.departments_level_1 dl1
          ON dl1.pai_level_4_id =
  ANY(sa.departamento_ids)
          AND sa.departamento_nivel = 4
        INNER JOIN %I.produtos p
          ON p.departamento_id = dl1.departamento_id
        INNER JOIN %I.vendas v
          ON v.id_produto = p.id
          AND v.filial_id = p.filial_id
          AND v.data_venda >= $1
          AND v.data_venda <= $2
        WHERE sa.departamento_nivel = 4
        GROUP BY sa.setor_id, v.data_venda,
  v.filial_id

        UNION ALL

        -- NIVEL 5
        SELECT
          sa.setor_id,
          v.data_venda,
          v.filial_id,
          SUM(v.valor_vendas) AS total_vendas,
          SUM(v.quantidade * v.custo_compra) AS
  total_custo,
          SUM(v.valor_vendas) - SUM(v.quantidade *
  v.custo_compra) AS total_lucro
        FROM setores_ativos sa
        INNER JOIN %I.departments_level_1 dl1
          ON dl1.pai_level_5_id =
  ANY(sa.departamento_ids)
          AND sa.departamento_nivel = 5
        INNER JOIN %I.produtos p
          ON p.departamento_id = dl1.departamento_id
        INNER JOIN %I.vendas v
          ON v.id_produto = p.id
          AND v.filial_id = p.filial_id
          AND v.data_venda >= $1
          AND v.data_venda <= $2
        WHERE sa.departamento_nivel = 5
        GROUP BY sa.setor_id, v.data_venda,
  v.filial_id

        UNION ALL

        -- NIVEL 6
        SELECT
          sa.setor_id,
          v.data_venda,
          v.filial_id,
          SUM(v.valor_vendas) AS total_vendas,
          SUM(v.quantidade * v.custo_compra) AS
  total_custo,
          SUM(v.valor_vendas) - SUM(v.quantidade *
  v.custo_compra) AS total_lucro
        FROM setores_ativos sa
        INNER JOIN %I.departments_level_1 dl1
          ON dl1.pai_level_6_id =
  ANY(sa.departamento_ids)
          AND sa.departamento_nivel = 6
        INNER JOIN %I.produtos p
          ON p.departamento_id = dl1.departamento_id
        INNER JOIN %I.vendas v
          ON v.id_produto = p.id
          AND v.filial_id = p.filial_id
          AND v.data_venda >= $1
          AND v.data_venda <= $2
        WHERE sa.departamento_nivel = 6
        GROUP BY sa.setor_id, v.data_venda,
  v.filial_id
      ),
      setores_contados AS (
        SELECT COUNT(DISTINCT id) AS total
        FROM %I.setores
        WHERE ativo = true
      )
      UPDATE %I.metas_setor ms
      SET
        valor_realizado = COALESCE(vps.total_vendas,
  0),
        custo_realizado = COALESCE(vps.total_custo,
  0),
        lucro_realizado = COALESCE(vps.total_lucro,
  0),
        diferenca = COALESCE(vps.total_vendas, 0) -
  ms.valor_meta,
        diferenca_percentual = CASE
          WHEN ms.valor_meta > 0 THEN
            ((COALESCE(vps.total_vendas, 0) /
  ms.valor_meta) - 1) * 100
          ELSE 0
        END,
        updated_at = NOW()
      FROM vendas_por_setor vps
      WHERE
        ms.setor_id = vps.setor_id
        AND ms.data = vps.data_venda
        AND ms.filial_id = vps.filial_id
        AND (
          ms.valor_realizado IS DISTINCT FROM
  COALESCE(vps.total_vendas, 0)
          OR ms.custo_realizado IS DISTINCT FROM
  COALESCE(vps.total_custo, 0)
          OR ms.lucro_realizado IS DISTINCT FROM
  COALESCE(vps.total_lucro, 0)
        )
      RETURNING (SELECT total FROM setores_contados)
    ',
      p_schema,
      p_schema, p_schema, p_schema,
      p_schema, p_schema, p_schema,
      p_schema, p_schema, p_schema,
      p_schema, p_schema, p_schema,
      p_schema, p_schema, p_schema,
      p_schema, p_schema, p_schema,
      p_schema,
      p_schema
    );

    BEGIN
      EXECUTE v_update_sql
      USING v_date_start, v_date_end
      INTO v_total_setores;

      GET DIAGNOSTICS v_total_rows = ROW_COUNT;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors,
  format('Erro no UPDATE em massa: %s', SQLERRM));
      RAISE WARNING 'Erro ao processar UPDATE em
  massa: %', SQLERRM;
    END;

    v_query_duration := clock_timestamp() -
  v_query_start;

    RAISE NOTICE '';
    RAISE NOTICE 'Processamento concluido em %',
  v_query_duration;
    RAISE NOTICE '   - Setores processados: %',
  COALESCE(v_total_setores, 0);
    RAISE NOTICE '   - Metas atualizadas: %',
  v_total_rows;
    RAISE NOTICE '';

    RETURN json_build_object(
      'success', true,
      'message', format('Processados %s setores, %s
  metas atualizadas (sem desconto)',
  COALESCE(v_total_setores, 0), v_total_rows),
      'rows_updated', v_total_rows,
      'setores_processados',
  COALESCE(v_total_setores, 0),
      'errors', v_errors,
      'timestamp', NOW(),
      'duration_ms', EXTRACT(EPOCH FROM
  v_query_duration) * 1000,
      'strategy', 'UNION ALL (batch update) sem
  desconto'
    );

  EXCEPTION
    WHEN query_canceled THEN
      RAISE EXCEPTION 'Timeout ao atualizar valores
  (>180s). Considere executar em horario de baixo
  trafego.';
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Erro ao atualizar valores: %
  (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  $_$;


--
-- Name: FUNCTION atualizar_valores_realizados_todos_setores(p_schema text, p_mes integer, p_ano integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.atualizar_valores_realizados_todos_setores(p_schema text, p_mes integer, p_ano integer) IS 'Atualiza os valores realizados de TODOS os setores de uma vez (VERSAO COM CUSTO/LUCRO).

NOVIDADE (2025-12-16):
- Agora calcula e atualiza custo_realizado e lucro_realizado
- total_custo = SUM(quantidade * custo_compra)
- total_lucro = total_vendas - total_custo

ESTRATEGIA: UNION ALL
- Processa TODOS os setores em UMA UNICA QUERY
- Faz UMA UNICA varredura na tabela vendas
- Atualiza todas as metas_setor em um unico UPDATE em massa

PARAMETROS:
- p_schema: Nome do schema do tenant (ex: ''okilao'')
- p_mes: Mes (1-12)
- p_ano: Ano (ex: 2025)

RETORNO:
JSON com:
- success: boolean
- rows_updated: numero de linhas atualizadas
- setores_processados: quantidade de setores processados
- errors: array de erros (se houver)
- timestamp: timestamp da execucao
- duration_ms: tempo de execucao em milissegundos
- strategy: "UNION ALL (batch update) + custo/lucro"';


--
-- Name: atualizar_vendas_diarias(text, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_vendas_diarias(p_schema_name text, p_data_inicial date, p_data_final date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    -- ETAPA 1: DELETA todos os registros do período
    EXECUTE format('
        DELETE FROM %I.vendas_diarias_por_filial
        WHERE data_venda BETWEEN $1 AND $2
    ', p_schema_name)
    USING p_data_inicial, p_data_final;

    -- ETAPA 2: INSERE todos os dados recalculados (SEM ON CONFLICT)
    EXECUTE format('
        INSERT INTO %I.vendas_diarias_por_filial (
            filial_id,
            data_venda,
            valor_total,
            quantidade_total,
            total_transacoes,
            custo_total,
            total_lucro
        )
        SELECT
            v.filial_id,
            v.data_venda,
            SUM(v.valor_vendas) AS valor_total,
            SUM(v.quantidade) AS quantidade_total,
            COUNT(*) AS total_transacoes,
            SUM(v.quantidade * v.custo_compra) AS custo_total,
            SUM(v.valor_vendas) - SUM(v.quantidade * v.custo_compra) AS total_lucro
        FROM %I.vendas v
        WHERE v.data_venda BETWEEN $1 AND $2
        GROUP BY v.filial_id, v.data_venda
    ', p_schema_name, p_schema_name)
    USING p_data_inicial, p_data_final;
END;
$_$;


--
-- Name: atualizar_vendas_por_departamento(text, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_vendas_por_departamento(p_schema text, p_data_inicio date, p_data_fim date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_rows_inserted INTEGER := 0;
  v_nivel INT;
BEGIN
  EXECUTE format('DELETE FROM %I.vendas_por_departamento WHERE data BETWEEN $1 AND $2', p_schema)
  USING p_data_inicio, p_data_fim;
  
  FOR v_nivel IN 1..6 LOOP
    EXECUTE format('
      INSERT INTO %I.vendas_por_departamento 
        (data, filial_id, departamento_nivel, departamento_id, valor_total, quantidade_vendas)
      SELECT 
        DATE(v.data_venda),
        v.filial_id,
        %s,
        p.departamento_%s_id,
        SUM(v.valor_vendas),
        COUNT(*)
      FROM %I.vendas v
      INNER JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.data_venda BETWEEN $1 AND $2
        AND p.departamento_%s_id IS NOT NULL
      GROUP BY DATE(v.data_venda), v.filial_id, p.departamento_%s_id
      ON CONFLICT (data, filial_id, departamento_nivel, departamento_id)
      DO UPDATE SET
        valor_total = EXCLUDED.valor_total,
        quantidade_vendas = EXCLUDED.quantidade_vendas,
        updated_at = NOW()
    ', p_schema, v_nivel, v_nivel, p_schema, p_schema, v_nivel, v_nivel)
    USING p_data_inicio, p_data_fim;
  END LOOP;
  
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  
  RETURN json_build_object('success', true, 'rows_processed', v_rows_inserted);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$_$;


--
-- Name: atualizar_vendas_produto_mes(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_vendas_produto_mes(p_schema_name text, p_data_inicial text, p_data_final text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    mes_inicio DATE;
    mes_fim DATE;
    filial_rec RECORD;
    total_inserido INT := 0;
BEGIN
    SET LOCAL statement_timeout = '900s';
    SET LOCAL work_mem = '256MB'; -- Aumenta memória para agregações
    
    mes_inicio := date_trunc('month', p_data_inicial::DATE)::DATE;
    mes_fim := (date_trunc('month', p_data_final::DATE) + INTERVAL '1 month - 1 day')::DATE;

    RAISE NOTICE 'Processando período: % a %', mes_inicio, mes_fim;

    -- ETAPA 1: DELETE rápido do período
    EXECUTE format('
        DELETE FROM %I.vendas_produto_mes
        WHERE mes_referencia >= %L AND mes_referencia <= %L
    ', p_schema_name, mes_inicio, mes_fim);

    -- ETAPA 2: Processa cada filial separadamente
    FOR filial_rec IN 
        EXECUTE format('
            SELECT DISTINCT filial_id 
            FROM %I.vendas 
            WHERE data_venda BETWEEN %L AND %L 
            ORDER BY filial_id
        ', p_schema_name, mes_inicio, mes_fim)
    LOOP
        EXECUTE format('
            INSERT INTO %I.vendas_produto_mes (
                mes_referencia, filial_id, id_produto,
                quantidade_total, valor_total, ticket_medio,
                custo_total, lucro_total
            )
            SELECT
                date_trunc(''month'', v.data_venda)::date,
                v.filial_id,
                v.id_produto,
                SUM(v.quantidade),
                SUM(v.valor_vendas),
                SUM(v.valor_vendas) / NULLIF(SUM(v.quantidade), 0),
                SUM(v.quantidade * COALESCE(v.custo_compra, 0)),
                SUM(v.valor_vendas) - SUM(v.quantidade * COALESCE(v.custo_compra, 0))
            FROM %I.vendas v
            WHERE v.data_venda BETWEEN %L AND %L
              AND v.filial_id = %L
            GROUP BY date_trunc(''month'', v.data_venda), v.filial_id, v.id_produto
        ', p_schema_name, p_schema_name, mes_inicio, mes_fim, filial_rec.filial_id);
        
        GET DIAGNOSTICS total_inserido = ROW_COUNT;
        RAISE NOTICE 'Filial %: % registros inseridos', filial_rec.filial_id, total_inserido;
    END LOOP;
END;
$$;


--
-- Name: buscar_produtos_criticos(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_produtos_criticos(schema_name text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '300s'
    AS $$
DECLARE result_json JSON;
BEGIN
  EXECUTE format('
    SELECT COALESCE(json_agg(resultado), ''[]''::json)
    FROM (
      SELECT
        p.filial_id, d.descricao AS nome_departamento, p.id AS codigo_produto, 
        p.descricao AS nome_produto, p.curva_abc, p.venda_media_diaria_60d, p.estoque_atual,
        p.dias_de_estoque, p.dias_com_venda_60d
      FROM 
        %I.produtos AS p
      LEFT JOIN %I.departamentos AS d 
        ON p.departamento_id = d.id AND p.departamento_nivel = d.nivel
      WHERE
        p.curva_abc = ''A'' AND p.estoque_atual > 0
        AND NOT EXISTS (
          SELECT 1 FROM %I.vendas AS v
          WHERE v.id_produto = p.id AND v.filial_id = p.filial_id
            AND v.data_venda >= (CURRENT_DATE - INTERVAL ''6 days'')
        )
      ORDER BY p.filial_id, d.descricao, p.descricao
    ) AS resultado;
  ', schema_name, schema_name, schema_name) INTO result_json;
  RETURN result_json;
END;
$$;


--
-- Name: buscar_produtos_desacelerados(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_produtos_desacelerados(schema_name text, p_data_alvo text) RETURNS TABLE(filial_id bigint, segmento text, codigo_produto bigint, nome_produto text, estoque_atual numeric, dias_com_venda_60d bigint, dias_de_estoque numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Continuamos setando o timeout, na esperança de que ajude em algum nível
    SET LOCAL statement_timeout = '600s';

    -- Força a materialização dos cálculos pesados em uma tabela temporária em memória.
    -- A tabela é automaticamente descartada no final da transação.
    EXECUTE format('
        CREATE TEMP TABLE sales_metrics_temp AS
        SELECT
            v.filial_id,
            v.id_produto,
            COUNT(DISTINCT v.data_venda) AS dias_com_venda,
            SUM(v.quantidade) / 60.0 AS media_diaria_vendas
        FROM
            %I.vendas v
        WHERE
            v.data_venda BETWEEN (%L::DATE - INTERVAL ''59 days'') AND %L::DATE
        GROUP BY
            v.filial_id,
            v.id_produto
        HAVING
            COUNT(DISTINCT v.data_venda) >= 50;
    ', schema_name, p_data_alvo, p_data_alvo);

    -- Cria um índice na tabela temporária para acelerar o JOIN
    CREATE INDEX ON sales_metrics_temp (id_produto, filial_id);

    -- Executa a consulta final, que agora é muito mais leve
    RETURN QUERY EXECUTE format('
        WITH vendas_no_dia_alvo AS (
            SELECT DISTINCT v.filial_id, v.id_produto
            FROM %I.vendas v
            WHERE v.data_venda = %L::DATE
        )
        SELECT
            p.filial_id,
            COALESCE(d.description, ''Sem Segmento'') AS segmento,
            p.id AS codigo_produto,
            p.descricao AS nome_produto,
            p.estoque_atual,
            sm.dias_com_venda::BIGINT AS dias_com_venda_60d,
            CASE
                WHEN COALESCE(p.estoque_atual, 0) > 0 AND sm.media_diaria_vendas > 0 THEN
                    p.estoque_atual / sm.media_diaria_vendas
                ELSE 0
            END AS dias_de_estoque
        FROM
            %I.produtos p
        LEFT JOIN
            %I.departments d ON p.departamento_id = d.id
        JOIN
            sales_metrics_temp sm ON p.id = sm.id_produto AND p.filial_id = sm.filial_id
        LEFT JOIN
            vendas_no_dia_alvo vda ON p.id = vda.id_produto AND p.filial_id = vda.filial_id
        WHERE
            p.curva_abc IN (''A'', ''B'')
            AND p.ativo = TRUE
            AND vda.id_produto IS NULL;
    ', schema_name, p_data_alvo, schema_name, schema_name);
END;
$$;


--
-- Name: buscar_produtos_ruptura_curva_a(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_produtos_ruptura_curva_a(schema_name text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '600s'
    AS $$
DECLARE result_json JSON;
BEGIN
  EXECUTE format('
    SELECT COALESCE(json_agg(resultado), ''[]''::json)
    FROM (
      SELECT
        p_ruptura.filial_id, d.descricao AS nome_departamento, p_ruptura.id AS codigo_produto,
        p_ruptura.descricao AS nome_produto, p_ruptura.curva_abc, p_ruptura.venda_media_diaria_60d, p_ruptura.estoque_atual,
        p_ruptura.dias_de_estoque, p_ruptura.dias_com_venda_60d,
        fonte.filial_sugerida, fonte.estoque_sugerido, fonte.dias_estoque_sugerido
      FROM 
        %I.produtos AS p_ruptura
      LEFT JOIN %I.departamentos AS d 
        ON p_ruptura.departamento_id = d.id AND p_ruptura.departamento_nivel = d.nivel
      LEFT JOIN LATERAL (
        SELECT f.filial_id AS filial_sugerida, f.estoque_atual AS estoque_sugerido, f.dias_de_estoque AS dias_estoque_sugerido
        FROM %I.produtos AS f
        WHERE f.id = p_ruptura.id AND f.filial_id != p_ruptura.filial_id
          AND f.estoque_atual > 0 AND f.dias_de_estoque > 5
        ORDER BY f.dias_de_estoque DESC LIMIT 1
      ) AS fonte ON true
      WHERE
        p_ruptura.curva_abc = ''A'' AND (p_ruptura.estoque_atual IS NULL OR p_ruptura.estoque_atual <= 0)
      ORDER BY
        p_ruptura.filial_id, d.descricao, p_ruptura.descricao
    ) AS resultado;
  ', schema_name, schema_name, schema_name) INTO result_json;
  RETURN result_json;
END;
$$;


--
-- Name: buscar_resumo_vendas_curva(text, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buscar_resumo_vendas_curva(p_schema_name text, p_data_alvo text, p_filial_id bigint DEFAULT NULL::bigint) RETURNS TABLE(filial_id bigint, segmento text, codigo_produto bigint, nome_produto text, quantidade_vendida numeric, valor_vendido numeric, curva text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '300s'
    AS $$
DECLARE
    data_inicio DATE;
    data_fim DATE;
BEGIN
    data_inicio := to_date(p_data_alvo, 'YYYY-MM');
    data_fim := (data_inicio + INTERVAL '1 month - 1 day')::DATE;

    RETURN QUERY EXECUTE format('
        WITH depto_nivel_5 AS MATERIALIZED (
            SELECT DISTINCT ON (d1.id)
                d1.id,
                COALESCE(d5.descricao, d4.descricao, d3.descricao, d2.descricao, d1.descricao) as nome_segmento -- Alterado para d5
            FROM %I.departamentos d1
            LEFT JOIN %I.departamentos d2 ON d1.parent_id = d2.id
            LEFT JOIN %I.departamentos d3 ON d2.parent_id = d3.id
            LEFT JOIN %I.departamentos d4 ON d3.parent_id = d4.id
            LEFT JOIN %I.departamentos d5 ON d4.parent_id = d5.id -- <<< --- ALTERAÇÃO: Adicionado Nível 5
        ),
        vendas_mensais AS (
            SELECT
                v.filial_id,
                v.id_produto,
                SUM(v.quantidade) AS total_quantidade,
                SUM(v.valor_vendas) AS total_valor
            FROM %I.vendas v
            WHERE v.data_venda BETWEEN %L AND %L
              AND (%L IS NULL OR v.filial_id = %L)
            GROUP BY v.filial_id, v.id_produto
        )
        SELECT DISTINCT ON (vm.filial_id, p.id)
            vm.filial_id,
            dn5.nome_segmento AS segmento,
            p.id AS codigo_produto,
            p.descricao AS nome_produto,
            vm.total_quantidade AS quantidade_vendida,
            vm.total_valor AS valor_vendido,
            p.curva_abc::TEXT AS curva
        FROM vendas_mensais vm
        JOIN %I.produtos p ON vm.id_produto = p.id
        LEFT JOIN depto_nivel_5 dn5 ON p.departamento_id = dn5.id
        ORDER BY vm.filial_id, p.id, vm.total_valor DESC;
    ', 
    p_schema_name, p_schema_name, p_schema_name, p_schema_name, p_schema_name, -- 5 schemas para os 5 joins de departamentos
    p_schema_name, -- para vendas
    data_inicio, data_fim,
    p_filial_id, p_filial_id,
    p_schema_name -- para produtos
    );
END;
$$;


--
-- Name: calcular_venda_media_diaria_60d(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_venda_media_diaria_60d(schema_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
     DECLARE
       start_time timestamptz := clock_timestamp();
       v_dias_periodo integer;
       v_rows_updated integer;
     BEGIN
       SET statement_timeout = '120s';
     
       -- Calcular dias do período
       v_dias_periodo := (
         (date_trunc('month', CURRENT_DATE) - INTERVAL '1 
   day')::date
         -
         (date_trunc('month', CURRENT_DATE) - INTERVAL '2 
   months')::date
         + 1
       )::integer;
     
       RAISE NOTICE 'Calculando venda media diaria para schema % com
    periodo de % dias', schema_name, v_dias_periodo;
     
       -- ⚠️ REMOVIDA A VALIDAÇÃO QUE FALHAVA
       -- Executa direto - se MV não existir, dará erro mais claro
     
       EXECUTE format('
         UPDATE %I.produtos AS p
         SET
           venda_media_diaria_60d = mv.total_quantidade_produto / 
   $1::numeric
         FROM
           %I.vendas_agregadas_60d AS mv
         WHERE
           p.id = mv.id_produto
           AND p.filial_id = mv.filial_id;
       ', schema_name, schema_name)
       USING v_dias_periodo;
     
       GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
     
       PERFORM public.log_job(
           'calcular_venda_media_diaria_60d',
           schema_name,
           'SUCCESS',
           format('Calculo de QUANTIDADE media diaria (2 meses 
   fechados = %s dias) concluido. %s produtos atualizados.', 
   v_dias_periodo, v_rows_updated),
           start_time
       );
     
       RETURN format('Calculo concluido para %s: %s produtos 
   atualizados (periodo: %s dias)',
                     schema_name, v_rows_updated, v_dias_periodo);
     
     EXCEPTION
         WHEN OTHERS THEN
             PERFORM public.log_job(
                 'calcular_venda_media_diaria_60d',
                 schema_name,
                 'ERROR',
                 SQLERRM,
                 start_time
             );
             RAISE;
     END;
     $_$;


--
-- Name: carga_inicial_departamentos(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.carga_inicial_departamentos(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    EXECUTE format('
        INSERT INTO %I.departments (id, source_level, description, parent_source_id, parent_source_level)
        SELECT
            (d->>''id'')::integer, (d->>''source_level'')::integer, d->>''description'',
            (d->>''parent_source_id'')::integer, (d->>''parent_source_level'')::integer
        FROM jsonb_array_elements(%L) AS d
        ON CONFLICT (id) DO UPDATE SET
            source_level = EXCLUDED.source_level, description = EXCLUDED.description,
            parent_source_id = EXCLUDED.parent_source_id, parent_source_level = EXCLUDED.parent_source_level,
            parent_id = NULL; -- Garante que parent_id comece nulo
    ', schema_name, data_json);
END;
$$;


--
-- Name: clone_schema_for_tenant(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clone_schema_for_tenant(p_target_schema text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
    v_source_schema TEXT := 'okilao';  -- Sempre clona de okilao
    v_tables_created INT := 0;
    v_indexes_created INT := 0;
    v_pks_created INT := 0;
    v_unique_created INT := 0;
    v_fks_created INT := 0;
    v_mvs_created INT := 0;
    v_functions_created INT := 0;
    v_triggers_created INT := 0;
    r RECORD;
    v_pk_columns TEXT;
    v_unique_columns TEXT;
    v_new_constraint_name TEXT;
    v_new_indexname TEXT;
    v_new_indexdef TEXT;
    v_new_definition TEXT;
    v_func_def TEXT;
    v_trigger_sql TEXT;
BEGIN
    -- ========================================================================
    -- VERIFICAÇÕES DE SEGURANÇA
    -- ========================================================================

    -- 1. Verificar se schema destino já existe (PROTEÇÃO CRÍTICA)
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = p_target_schema) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Schema já existe: ' || p_target_schema || '. Não é possível sobrescrever schemas existentes.'
        );
    END IF;

    -- 2. Verificar se schema origem existe
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = v_source_schema) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Schema de origem não encontrado: ' || v_source_schema
        );
    END IF;

    -- 3. Validar nome do schema (apenas letras minúsculas, números e underscore)
    IF p_target_schema !~ '^[a-z][a-z0-9_]*$' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Nome do schema inválido. Use apenas letras minúsculas, números e underscore, começando com letra.'
        );
    END IF;

    -- ========================================================================
    -- CRIAR SCHEMA
    -- ========================================================================
    EXECUTE format('CREATE SCHEMA %I', p_target_schema);
    RAISE NOTICE 'Schema criado: %', p_target_schema;

    -- ========================================================================
    -- CRIAR TABELAS (estrutura vazia)
    -- ========================================================================
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = v_source_schema
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        BEGIN
            EXECUTE format(
                'CREATE TABLE %I.%I AS SELECT * FROM %I.%I WHERE 1=0',
                p_target_schema, r.table_name, v_source_schema, r.table_name
            );
            v_tables_created := v_tables_created + 1;
            RAISE NOTICE 'Tabela criada: %', r.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao criar tabela %: %', r.table_name, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- ADICIONAR PRIMARY KEYS
    -- ========================================================================
    FOR r IN
        SELECT DISTINCT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = v_source_schema
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY tc.table_name
    LOOP
        SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
        INTO v_pk_columns
        FROM information_schema.key_column_usage kcu
        WHERE kcu.constraint_name = r.constraint_name
          AND kcu.table_schema = v_source_schema;

        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.%I ADD PRIMARY KEY (%s)',
                p_target_schema, r.table_name, v_pk_columns
            );
            v_pks_created := v_pks_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'PK erro em %: %', r.table_name, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- ADICIONAR UNIQUE CONSTRAINTS
    -- ========================================================================
    FOR r IN
        SELECT DISTINCT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = v_source_schema
          AND tc.constraint_type = 'UNIQUE'
        ORDER BY tc.table_name
    LOOP
        SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
        INTO v_unique_columns
        FROM information_schema.key_column_usage kcu
        WHERE kcu.constraint_name = r.constraint_name
          AND kcu.table_schema = v_source_schema;

        v_new_constraint_name := REPLACE(r.constraint_name, v_source_schema, p_target_schema);

        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE (%s)',
                p_target_schema, r.table_name, v_new_constraint_name, v_unique_columns
            );
            v_unique_created := v_unique_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'UNIQUE erro em %: %', r.table_name, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- CRIAR ÍNDICES
    -- ========================================================================
    FOR r IN
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = v_source_schema
          AND indexname NOT LIKE '%_pkey'
        ORDER BY tablename, indexname
    LOOP
        v_new_indexname := REPLACE(r.indexname, v_source_schema, p_target_schema);
        v_new_indexdef := REPLACE(r.indexdef, v_source_schema || '.', p_target_schema || '.');
        v_new_indexdef := REPLACE(v_new_indexdef, 'INDEX ' || r.indexname, 'INDEX ' || v_new_indexname);

        BEGIN
            EXECUTE v_new_indexdef;
            v_indexes_created := v_indexes_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Índice erro em %: %', v_new_indexname, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- CRIAR FOREIGN KEYS (apenas FKs simples - 1 coluna)
    -- ========================================================================
    FOR r IN
        SELECT
            tc.table_name,
            tc.constraint_name,
            kcu.column_name AS fk_column,
            ccu.table_name AS ref_table,
            ccu.column_name AS ref_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = v_source_schema
            AND tc.constraint_type = 'FOREIGN KEY'
            AND (SELECT COUNT(*) FROM information_schema.key_column_usage k
                 WHERE k.constraint_name = tc.constraint_name
                   AND k.table_schema = tc.table_schema) = 1
        ORDER BY tc.table_name
    LOOP
        v_new_constraint_name := REPLACE(r.constraint_name, v_source_schema, p_target_schema);

        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I)',
                p_target_schema, r.table_name, v_new_constraint_name,
                r.fk_column, p_target_schema, r.ref_table, r.ref_column
            );
            v_fks_created := v_fks_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'FK erro em %: %', r.table_name, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- CRIAR MATERIALIZED VIEWS
    -- ========================================================================
    FOR r IN
        SELECT matviewname, definition
        FROM pg_matviews
        WHERE schemaname = v_source_schema
        ORDER BY matviewname
    LOOP
        v_new_definition := REPLACE(r.definition, v_source_schema || '.', p_target_schema || '.');

        BEGIN
            EXECUTE format(
                'CREATE MATERIALIZED VIEW %I.%I AS %s',
                p_target_schema, r.matviewname, v_new_definition
            );
            v_mvs_created := v_mvs_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'MV erro em %: %', r.matviewname, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- CRIAR FUNCTIONS
    -- ========================================================================
    FOR r IN
        SELECT p.oid, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = v_source_schema
        ORDER BY p.proname
    LOOP
        v_func_def := pg_get_functiondef(r.oid);
        v_func_def := REPLACE(v_func_def, v_source_schema || '.', p_target_schema || '.');
        v_func_def := REPLACE(v_func_def, 'CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');

        BEGIN
            EXECUTE v_func_def;
            v_functions_created := v_functions_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Function erro em %: %', r.proname, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- CRIAR TRIGGERS
    -- ========================================================================
    FOR r IN
        SELECT trigger_name, event_manipulation, event_object_table,
               action_timing, action_orientation, action_statement
        FROM information_schema.triggers
        WHERE trigger_schema = v_source_schema
        ORDER BY event_object_table, trigger_name
    LOOP
        v_trigger_sql := format(
            'CREATE TRIGGER %I %s %s ON %I.%I FOR EACH %s %s',
            r.trigger_name,
            r.action_timing,
            r.event_manipulation,
            p_target_schema,
            r.event_object_table,
            r.action_orientation,
            REPLACE(r.action_statement, v_source_schema || '.', p_target_schema || '.')
        );

        BEGIN
            EXECUTE v_trigger_sql;
            v_triggers_created := v_triggers_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Trigger erro em %: %', r.trigger_name, SQLERRM;
        END;
    END LOOP;

    -- ========================================================================
    -- CONFIGURAR PERMISSÕES (GRANTS)
    -- ========================================================================
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon, authenticated, service_role', p_target_schema);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO anon, authenticated, service_role', p_target_schema);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO authenticated, service_role', p_target_schema);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO anon, authenticated, service_role', p_target_schema);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO authenticated, service_role', p_target_schema);

    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO anon, authenticated, service_role', p_target_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role', p_target_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role', p_target_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role', p_target_schema);

    RAISE NOTICE 'Permissões configuradas para schema %', p_target_schema;

    -- ========================================================================
    -- COPIAR DADOS DE REFERÊNCIA
    -- ========================================================================
    BEGIN
        EXECUTE format('INSERT INTO %I.departments_level_6 SELECT * FROM %I.departments_level_6 ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.departments_level_5 SELECT * FROM %I.departments_level_5 ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.departments_level_4 SELECT * FROM %I.departments_level_4 ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.departments_level_3 SELECT * FROM %I.departments_level_3 ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.departments_level_2 SELECT * FROM %I.departments_level_2 ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.departments_level_1 SELECT * FROM %I.departments_level_1 ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.departamentos_nivel1 SELECT * FROM %I.departamentos_nivel1 ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.tipos_despesa SELECT * FROM %I.tipos_despesa ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        EXECUTE format('INSERT INTO %I.motivos_perda SELECT * FROM %I.motivos_perda ON CONFLICT DO NOTHING', p_target_schema, v_source_schema);
        RAISE NOTICE 'Dados de referência copiados';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao copiar dados de referência: %', SQLERRM;
    END;

    -- ========================================================================
    -- ANALYZE TABELAS
    -- ========================================================================
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = p_target_schema
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ANALYZE %I.%I', p_target_schema, r.table_name);
    END LOOP;
    RAISE NOTICE 'ANALYZE completo';

    -- ========================================================================
    -- RETORNAR SUCESSO
    -- ========================================================================
    RETURN json_build_object(
        'success', true,
        'schema', p_target_schema,
        'tables_created', v_tables_created,
        'indexes_created', v_indexes_created,
        'primary_keys_created', v_pks_created,
        'unique_constraints_created', v_unique_created,
        'foreign_keys_created', v_fks_created,
        'materialized_views_created', v_mvs_created,
        'functions_created', v_functions_created,
        'triggers_created', v_triggers_created
    );

EXCEPTION WHEN OTHERS THEN
    -- Rollback: dropar schema se criado parcialmente (APENAS O NOVO!)
    -- Verifica se o schema foi criado antes de tentar dropar
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = p_target_schema) THEN
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', p_target_schema);
        RAISE NOTICE 'Schema % removido devido a erro', p_target_schema;
    END IF;

    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$_$;


--
-- Name: FUNCTION clone_schema_for_tenant(p_target_schema text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.clone_schema_for_tenant(p_target_schema text) IS 'Clona a estrutura completa do schema okilao para criar um novo tenant.
Usado pelo sistema quando um superadmin cria uma nova empresa.
ATENÇÃO: Após criar o schema, é necessário adicioná-lo manualmente aos
"Exposed schemas" no Supabase Dashboard (Settings → API).';


--
-- Name: consultar_vendas_diarias(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consultar_vendas_diarias(schema_name text, data_filtro date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  result_json JSON;
BEGIN
  -- Este comando constrói a query dinamicamente e de forma segura
  EXECUTE format('
    SELECT json_agg(t) 
    FROM (
      SELECT * FROM %I.vendas_diarias_por_filial WHERE data_venda = $1
    ) t
  ', schema_name)
  INTO result_json
  USING data_filtro;
  
  RETURN COALESCE(result_json, '[]'); -- Retorna um array vazio '[]' se não encontrar nada
END;
$_$;


--
-- Name: create_descontos_venda_table(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_descontos_venda_table(schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.descontos_venda (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      filial_id integer NOT NULL,
      data_desconto date NOT NULL,
      valor_desconto numeric(10, 2) NOT NULL,
      observacao text NULL,
      created_at timestamp with time zone NULL DEFAULT now(),
      updated_at timestamp with time zone NULL DEFAULT now(),
      created_by uuid NULL,
      CONSTRAINT descontos_venda_pkey PRIMARY KEY (id),
      CONSTRAINT descontos_venda_filial_id_data_desconto_key UNIQUE (filial_id, data_desconto),
      CONSTRAINT descontos_venda_valor_desconto_check CHECK (valor_desconto >= 0)
    )
  ', schema_name);

  -- Criar índices
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_descontos_venda_filial 
    ON %I.descontos_venda USING btree (filial_id)
  ', schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_descontos_venda_data 
    ON %I.descontos_venda USING btree (data_desconto)
  ', schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_descontos_venda_filial_data 
    ON %I.descontos_venda USING btree (filial_id, data_desconto)
  ', schema_name);

  -- Criar trigger para atualizar updated_at
  EXECUTE format('
    CREATE TRIGGER on_descontos_venda_update
    BEFORE UPDATE ON %I.descontos_venda
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at()
  ', schema_name);

  RAISE NOTICE 'Tabela descontos_venda criada no schema %', schema_name;
END;
$$;


--
-- Name: FUNCTION create_descontos_venda_table(schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_descontos_venda_table(schema_name text) IS 'Cria tabela descontos_venda em um schema específico com índices e constraints';


--
-- Name: create_metas_table_for_tenant(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_metas_table_for_tenant(schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.metas_mensais (
      id bigserial PRIMARY KEY,
      filial_id bigint NOT NULL,
      data date NOT NULL,
      dia_semana text NOT NULL,
      meta_percentual numeric(5, 2) NOT NULL DEFAULT 0,
      data_referencia date NOT NULL,
      valor_referencia numeric(15, 2) DEFAULT 0,
      valor_meta numeric(15, 2) DEFAULT 0,
      valor_realizado numeric(15, 2) DEFAULT 0,
      diferenca numeric(15, 2) DEFAULT 0,
      diferenca_percentual numeric(5, 2) DEFAULT 0,
      situacao text DEFAULT ''pendente'',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT metas_mensais_unique_filial_data UNIQUE (filial_id, data)
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_metas_mensais_filial_data 
      ON %I.metas_mensais(filial_id, data);
    
    CREATE INDEX IF NOT EXISTS idx_metas_mensais_data 
      ON %I.metas_mensais(data);
    
    -- Create trigger for updated_at
    CREATE TRIGGER on_metas_mensais_update 
      BEFORE UPDATE ON %I.metas_mensais
      FOR EACH ROW 
      EXECUTE FUNCTION handle_updated_at();
  ', schema_name, schema_name, schema_name, schema_name);
END;
$$;


--
-- Name: create_venda_curva_indexes(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_venda_curva_indexes(p_schema text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE NOTICE 'Creating indexes for schema: %', p_schema;
  
  -- Index para filtro por data e filial
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_vendas_data_filial_valor 
    ON %I.vendas (data_venda, filial_id) 
    WHERE valor_vendas > 0
  ', p_schema);
  RAISE NOTICE '  ✓ Created idx_vendas_data_filial_valor';

  -- Index para join com produtos
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_vendas_produto_filial 
    ON %I.vendas (id_produto, filial_id)
  ', p_schema);
  RAISE NOTICE '  ✓ Created idx_vendas_produto_filial';

  -- Index em produtos
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_produtos_ativo_dept 
    ON %I.produtos (departamento_id, ativo, curva_abcd) 
    WHERE ativo = true
  ', p_schema);
  RAISE NOTICE '  ✓ Created idx_produtos_ativo_dept';

  -- Index em departments_level_1
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_dept1_pais 
    ON %I.departments_level_1 (pai_level_2_id, pai_level_3_id)
  ', p_schema);
  RAISE NOTICE '  ✓ Created idx_dept1_pais';

  -- Index em departments_level_2
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_dept2_departamento 
    ON %I.departments_level_2 (departamento_id)
  ', p_schema);
  RAISE NOTICE '  ✓ Created idx_dept2_departamento';

  -- Index em departments_level_3
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_dept3_departamento 
    ON %I.departments_level_3 (departamento_id)
  ', p_schema);
  RAISE NOTICE '  ✓ Created idx_dept3_departamento';

  -- Analyze tables
  RAISE NOTICE 'Analyzing tables...';
  EXECUTE format('ANALYZE %I.vendas', p_schema);
  EXECUTE format('ANALYZE %I.produtos', p_schema);
  EXECUTE format('ANALYZE %I.departments_level_1', p_schema);
  EXECUTE format('ANALYZE %I.departments_level_2', p_schema);
  EXECUTE format('ANALYZE %I.departments_level_3', p_schema);
  
  RAISE NOTICE '✓ Indexes created and statistics updated for schema: %', p_schema;
END;
$$;


--
-- Name: delete_desconto_venda(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_desconto_venda(p_schema text, p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_affected integer;
BEGIN
  EXECUTE format(
    'DELETE FROM %I.descontos_venda WHERE id = $1',
    p_schema
  ) USING p_id;
  
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  
  RETURN v_affected > 0;
END;
$_$;


--
-- Name: FUNCTION delete_desconto_venda(p_schema text, p_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_desconto_venda(p_schema text, p_id uuid) IS 'Deleta um desconto_venda de um schema específico';


--
-- Name: drop_mview(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.drop_mview(p_schema_name text, p_view_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Validação básica para evitar comandos indesejados
    IF p_view_name IS NULL OR p_view_name = '' THEN
        RAISE EXCEPTION 'O nome da view não pode ser nulo ou vazio.';
    END IF;

    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I;', p_schema_name, p_view_name);
    
    RETURN 'View ' || p_schema_name || '.' || p_view_name || ' removida com sucesso.';
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Erro ao tentar remover a view ' || p_schema_name || '.' || p_view_name || '. Detalhes: ' || SQLERRM;
END;
$$;


--
-- Name: enrich_level_1_hierarchy(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enrich_level_1_hierarchy(schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE format('
    UPDATE
      %I.departments_level_1 AS l1
    SET
      -- CORREÇÃO: Agora estamos pegando o `departamento_id` de cada tabela pai
      pai_level_3_id = L3.departamento_id,
      pai_level_4_id = L4.departamento_id,
      pai_level_5_id = L5.departamento_id,
      pai_level_6_id = L6.departamento_id
    FROM
      %I.departments_level_2 AS L2
      LEFT JOIN %I.departments_level_3 AS L3 ON L2.pai_level_3_id = L3.departamento_id
      LEFT JOIN %I.departments_level_4 AS L4 ON L3.pai_level_4_id = L4.departamento_id
      LEFT JOIN %I.departments_level_5 AS L5 ON L4.pai_level_5_id = L5.departamento_id
      LEFT JOIN %I.departments_level_6 AS L6 ON L5.pai_level_6_id = L6.departamento_id
    WHERE
      l1.pai_level_2_id = L2.departamento_id;
  ',
  schema_name, -- para UPDATE %I.departments_level_1
  schema_name, -- para FROM %I.departments_level_2
  schema_name, -- para LEFT JOIN %I.departments_level_3
  schema_name, -- para LEFT JOIN %I.departments_level_4
  schema_name, -- para LEFT JOIN %I.departments_level_5
  schema_name  -- para LEFT JOIN %I.departments_level_6
  );
END;
$$;


--
-- Name: ensure_superadmin_can_switch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_superadmin_can_switch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.role = 'superadmin' THEN
    NEW.can_switch_tenants = true;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: executar_sincronizacao_com_logs(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.executar_sincronizacao_com_logs(tenant_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_erro TEXT;
    categoria INT;
BEGIN
    -- Etapa 1
    BEGIN
        PERFORM public.refresh_vendas_agregadas_30d(tenant_id);
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'refresh_vendas_agregadas_30d', 'SUCESSO', 'OK');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'refresh_vendas_agregadas_30d', 'ERRO', v_erro);
    END;

    -- Etapa 2
    BEGIN
        PERFORM public.calcular_venda_media_diaria_60d(tenant_id);
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'calcular_venda_media_diaria_60d', 'SUCESSO', 'OK');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'calcular_venda_media_diaria_60d', 'ERRO', v_erro);
    END;

    -- Etapa 3
    BEGIN
        PERFORM public.atualizar_dias_com_venda_60d(tenant_id);
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'atualizar_dias_com_venda_60d', 'SUCESSO', 'OK');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'atualizar_dias_com_venda_60d', 'ERRO', v_erro);
    END;

    -- Etapa 4
    BEGIN
        PERFORM public.atualizar_dias_de_estoque(tenant_id);
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'atualizar_dias_de_estoque', 'SUCESSO', 'OK');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'atualizar_dias_de_estoque', 'ERRO', v_erro);
    END;

    -- Curva ABCD
    FOREACH categoria IN ARRAY ARRAY[1, 4, 6, 7, 9] LOOP
        BEGIN
            PERFORM public.atualizar_curva_abcd_30d(tenant_id, ARRAY[categoria]);
            INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
            VALUES (tenant_id, format('atualizar_curva_abcd_30d[%s]', categoria), 'SUCESSO', 'OK');
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
            INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
            VALUES (tenant_id, format('atualizar_curva_abcd_30d[%s]', categoria), 'ERRO', v_erro);
        END;
    END LOOP;

    -- Curva Lucro
    FOREACH categoria IN ARRAY ARRAY[1, 4, 6, 7, 9] LOOP
        BEGIN
            PERFORM public.atualizar_curva_lucro(tenant_id, ARRAY[categoria]);
            INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
            VALUES (tenant_id, format('atualizar_curva_lucro[%s]', categoria), 'SUCESSO', 'OK');
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
            INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
            VALUES (tenant_id, format('atualizar_curva_lucro[%s]', categoria), 'ERRO', v_erro);
        END;
    END LOOP;

    -- Etapa Final
    BEGIN
        PERFORM public.refresh_report_curva_abcd(tenant_id);
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'refresh_report_curva_abcd', 'SUCESSO', 'OK');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        INSERT INTO logs_sincronizacao (tenant_id, etapa, status, mensagem)
        VALUES (tenant_id, 'refresh_report_curva_abcd', 'ERRO', v_erro);
    END;

END;
$$;


--
-- Name: executar_sincronizacao_completa(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.executar_sincronizacao_completa(tenant_id text) RETURNS TABLE(etapa text, status text, mensagem text, executado_em timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_inicio TIMESTAMP;
    v_erro TEXT;
    categoria INT;
BEGIN
    v_inicio := NOW();
    
    -- Etapa 1: Refresh vendas agregadas
    BEGIN
        PERFORM public.refresh_vendas_agregadas_30d(tenant_id);
        RETURN QUERY SELECT 
            'refresh_vendas_agregadas_30d'::TEXT,
            'SUCESSO'::TEXT,
            'Executado com sucesso'::TEXT,
            NOW()::TIMESTAMP;  -- Corrigido aqui
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        RETURN QUERY SELECT 
            'refresh_vendas_agregadas_30d'::TEXT,
            'ERRO'::TEXT,
            v_erro::TEXT,
            NOW()::TIMESTAMP;  -- Corrigido aqui
        RAISE NOTICE 'Erro em refresh_vendas_agregadas_30d: %', v_erro;
    END;

    -- Etapa 2: Calcular venda média diária
    BEGIN
        PERFORM public.calcular_venda_media_diaria_60d(tenant_id);
        RETURN QUERY SELECT 
            'calcular_venda_media_diaria_60d'::TEXT,
            'SUCESSO'::TEXT,
            'Executado com sucesso'::TEXT,
            NOW()::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        RETURN QUERY SELECT 
            'calcular_venda_media_diaria_60d'::TEXT,
            'ERRO'::TEXT,
            v_erro::TEXT,
            NOW()::TIMESTAMP;
    END;

    -- Etapa 3: Atualizar dias com venda
    BEGIN
        PERFORM public.atualizar_dias_com_venda_60d(tenant_id);
        RETURN QUERY SELECT 
            'atualizar_dias_com_venda_60d'::TEXT,
            'SUCESSO'::TEXT,
            'Executado com sucesso'::TEXT,
            NOW()::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        RETURN QUERY SELECT 
            'atualizar_dias_com_venda_60d'::TEXT,
            'ERRO'::TEXT,
            v_erro::TEXT,
            NOW()::TIMESTAMP;
    END;

    -- Etapa 4: Atualizar dias de estoque
    BEGIN
        PERFORM public.atualizar_dias_de_estoque(tenant_id);
        RETURN QUERY SELECT 
            'atualizar_dias_de_estoque'::TEXT,
            'SUCESSO'::TEXT,
            'Executado com sucesso'::TEXT,
            NOW()::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        RETURN QUERY SELECT 
            'atualizar_dias_de_estoque'::TEXT,
            'ERRO'::TEXT,
            v_erro::TEXT,
            NOW()::TIMESTAMP;
    END;

    -- Etapas 5-9: Curva ABCD por categoria
    FOREACH categoria IN ARRAY ARRAY[1, 4, 6, 7, 9] LOOP
        BEGIN
            PERFORM public.atualizar_curva_abcd_30d(tenant_id, ARRAY[categoria]);
            RETURN QUERY SELECT 
                format('atualizar_curva_abcd_30d[%s]', categoria)::TEXT,
                'SUCESSO'::TEXT,
                'Executado com sucesso'::TEXT,
                NOW()::TIMESTAMP;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
            RETURN QUERY SELECT 
                format('atualizar_curva_abcd_30d[%s]', categoria)::TEXT,
                'ERRO'::TEXT,
                v_erro::TEXT,
                NOW()::TIMESTAMP;
        END;
    END LOOP;

    -- Etapas 10-14: Curva Lucro por categoria
    FOREACH categoria IN ARRAY ARRAY[1, 4, 6, 7, 9] LOOP
        BEGIN
            PERFORM public.atualizar_curva_lucro(tenant_id, ARRAY[categoria]);
            RETURN QUERY SELECT 
                format('atualizar_curva_lucro[%s]', categoria)::TEXT,
                'SUCESSO'::TEXT,
                'Executado com sucesso'::TEXT,
                NOW()::TIMESTAMP;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
            RETURN QUERY SELECT 
                format('atualizar_curva_lucro[%s]', categoria)::TEXT,
                'ERRO'::TEXT,
                v_erro::TEXT,
                NOW()::TIMESTAMP;
        END;
    END LOOP;

    -- Etapa Final: Refresh report
    BEGIN
        PERFORM public.refresh_report_curva_abcd(tenant_id);
        RETURN QUERY SELECT 
            'refresh_report_curva_abcd'::TEXT,
            'SUCESSO'::TEXT,
            'Executado com sucesso'::TEXT,
            NOW()::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
        RETURN QUERY SELECT 
            'refresh_report_curva_abcd'::TEXT,
            'ERRO'::TEXT,
            v_erro::TEXT,
            NOW()::TIMESTAMP;
    END;

END;
$$;


--
-- Name: expand_departamento_hierarchy(text, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expand_departamento_hierarchy(p_schema text, p_nivel5_ids bigint[]) RETURNS bigint[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_all_ids BIGINT[];
BEGIN
  EXECUTE format('
    SELECT ARRAY_AGG(DISTINCT dept_id)
    FROM (
      -- Próprios IDs (nível 5)
      SELECT unnest($1::bigint[]) as dept_id
      
      UNION
      
      -- Nível 4
      SELECT d4.departamento_id
      FROM %I.departments_level_4 d4
      WHERE d4.pai_level_5_id = ANY($1)
      
      UNION
      
      -- Nível 3
      SELECT d3.departamento_id
      FROM %I.departments_level_3 d3
      INNER JOIN %I.departments_level_4 d4 ON d3.pai_level_4_id = d4.departamento_id
      WHERE d4.pai_level_5_id = ANY($1)
      
      UNION
      
      -- Nível 2
      SELECT d2.departamento_id
      FROM %I.departments_level_2 d2
      INNER JOIN %I.departments_level_3 d3 ON d2.pai_level_3_id = d3.departamento_id
      INNER JOIN %I.departments_level_4 d4 ON d3.pai_level_4_id = d4.departamento_id
      WHERE d4.pai_level_5_id = ANY($1)
      
      UNION
      
      -- Nível 1
      SELECT d1.departamento_id
      FROM %I.departments_level_1 d1
      INNER JOIN %I.departments_level_2 d2 ON d1.pai_level_2_id = d2.departamento_id
      INNER JOIN %I.departments_level_3 d3 ON d2.pai_level_3_id = d3.departamento_id
      INNER JOIN %I.departments_level_4 d4 ON d3.pai_level_4_id = d4.departamento_id
      WHERE d4.pai_level_5_id = ANY($1)
    ) all_depts
  ', p_schema, p_schema, p_schema, p_schema, p_schema, p_schema,
     p_schema, p_schema, p_schema, p_schema)
  INTO v_all_ids
  USING p_nivel5_ids;
  
  RETURN COALESCE(v_all_ids, ARRAY[]::bigint[]);
END;
$_$;


--
-- Name: finalizar_carga_produtos(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalizar_carga_produtos(p_filial_id integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    batch_size INTEGER := 10000; -- Processa 10.000 produtos por lote
    offset_val INTEGER := 0;
    rows_processed INTEGER;
    total_rows_processed INTEGER := 0;
    staging_ids BIGINT[];
BEGIN
    -- Adiciona o statement timeout que você pediu.
    SET LOCAL statement_timeout = '600s'; -- 10 minutos

    -- Otimização CRÍTICA: Calcula a hierarquia UMA VEZ e guarda numa tabela temporária.
    -- A tabela temporária é automaticamente apagada no final da transação.
    CREATE TEMP TABLE temp_hierarquia_map ON COMMIT DROP AS
    WITH RECURSIVE department_paths AS (
        SELECT id AS original_id, id, parent_id, nivel FROM paraiso.departamentos
        UNION ALL
        SELECT p.original_id, d.id, d.parent_id, d.nivel FROM paraiso.departamentos d
        JOIN department_paths p ON p.parent_id = d.id
    )
    SELECT
        original_id,
        MAX(CASE WHEN nivel = 1 THEN id END) as dep_nivel_1_id,
        MAX(CASE WHEN nivel = 2 THEN id END) as dep_nivel_2_id,
        MAX(CASE WHEN nivel = 3 THEN id END) as dep_nivel_3_id,
        MAX(CASE WHEN nivel = 4 THEN id END) as dep_nivel_4_id,
        MAX(CASE WHEN nivel = 5 THEN id END) as dep_nivel_5_id,
        MAX(CASE WHEN nivel = 6 THEN id END) as dep_nivel_6_id
    FROM department_paths
    GROUP BY original_id;

    -- Cria um índice na tabela temporária para acelerar os JOINs dentro do loop.
    CREATE INDEX ON temp_hierarquia_map(original_id);

    -- Loop para processar a staging_produtos em lotes
    LOOP
        -- Seleciona o próximo lote de IDs de produtos da staging
        SELECT ARRAY(
            SELECT id FROM paraiso.staging_produtos
            WHERE filial_id = p_filial_id
            ORDER BY id
            LIMIT batch_size OFFSET offset_val
        ) INTO staging_ids;

        -- Sai do loop se não houver mais produtos para processar
        IF array_length(staging_ids, 1) IS NULL THEN
            EXIT;
        END IF;

        -- Insere/Atualiza o lote atual. O JOIN com a tabela temporária é MUITO mais rápido.
        INSERT INTO paraiso.produtos (
            id, filial_id, descricao, ativo, balanca, unidade_de_medida, curva_abc, ultimo_fornecedor, 
            preco_de_venda_1, preco_de_venda_2, preco_de_custo, custo_real, custo_fiscal, custo_com_encargos, 
            custo_medio, estoque_atual, qtde_por_embalagem_ultima_entrada, data_cadastro, data_alteracao_preco,
            data_alteracao_custo, data_alteracao_cadastro, marca_id, classe_id, agrupamento_id, departamento_id,
            dep_nivel_1_id, dep_nivel_2_id, dep_nivel_3_id, dep_nivel_4_id, dep_nivel_5_id, dep_nivel_6_id
        )
        SELECT 
            s.id, s.filial_id, s.descricao, s.ativo, s.balanca, s.unidade_de_medida, s.curva_abc, s.ultimo_fornecedor,
            s.preco_de_venda_1, s.preco_de_venda_2, s.preco_de_custo, s.custo_real, s.custo_fiscal, s.custo_com_encargos,
            s.custo_medio, s.estoque_atual, s.qtde_por_embalagem_ultima_entrada, s.data_cadastro, s.data_alteracao_preco,
            s.data_alteracao_custo, s.data_alteracao_cadastro, s.marca_id, s.classe_id, s.agrupamento_id, s.departamento_id,
            h.dep_nivel_1_id, h.dep_nivel_2_id, h.dep_nivel_3_id, h.dep_nivel_4_id, h.dep_nivel_5_id, h.dep_nivel_6_id
        FROM paraiso.staging_produtos s
        LEFT JOIN temp_hierarquia_map h ON s.departamento_id = h.original_id
        WHERE s.id = ANY(staging_ids)
        ON CONFLICT (id, filial_id) DO UPDATE SET
            descricao = EXCLUDED.descricao, ativo = EXCLUDED.ativo, balanca = EXCLUDED.balanca, unidade_de_medida = EXCLUDED.unidade_de_medida,
            curva_abc = EXCLUDED.curva_abc, ultimo_fornecedor = EXCLUDED.ultimo_fornecedor, preco_de_venda_1 = EXCLUDED.preco_de_venda_1,
            preco_de_venda_2 = EXCLUDED.preco_de_venda_2, preco_de_custo = EXCLUDED.preco_de_custo, custo_real = EXCLUDED.custo_real,
            custo_fiscal = EXCLUDED.custo_fiscal, custo_com_encargos = EXCLUDED.custo_com_encargos, custo_medio = EXCLUDED.custo_medio,
            estoque_atual = EXCLUDED.estoque_atual, qtde_por_embalagem_ultima_entrada = EXCLUDED.qtde_por_embalagem_ultima_entrada,
            data_cadastro = EXCLUDED.data_cadastro, data_alteracao_preco = EXCLUDED.data_alteracao_preco,
            data_alteracao_custo = EXCLUDED.data_alteracao_custo, data_alteracao_cadastro = EXCLUDED.data_alteracao_cadastro,
            marca_id = EXCLUDED.marca_id, classe_id = EXCLUDED.classe_id, agrupamento_id = EXCLUDED.agrupamento_id,
            departamento_id = EXCLUDED.departamento_id, dep_nivel_1_id = EXCLUDED.dep_nivel_1_id,
            dep_nivel_2_id = EXCLUDED.dep_nivel_2_id, dep_nivel_3_id = EXCLUDED.dep_nivel_3_id,
            dep_nivel_4_id = EXCLUDED.dep_nivel_4_id, dep_nivel_5_id = EXCLUDED.dep_nivel_5_id,
            dep_nivel_6_id = EXCLUDED.dep_nivel_6_id, updated_at = NOW();

        GET DIAGNOSTICS rows_processed = ROW_COUNT;
        total_rows_processed := total_rows_processed + rows_processed;

        offset_val := offset_val + batch_size;
    END LOOP;

    RETURN 'Processados ' || total_rows_processed || ' produtos em lotes.';
END;
$$;


--
-- Name: generate_metas_mensais(text, bigint, integer, integer, numeric, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_metas_mensais(p_schema text, p_filial_id bigint, p_mes integer, p_ano integer, p_meta_percentual numeric, p_data_referencia_inicial date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_data_meta date;
  v_data_referencia date;
  v_dia_semana text;
  v_valor_referencia numeric(15, 2);
  v_desconto_referencia numeric(15, 2);
  v_valor_meta numeric(15, 2);
  v_valor_realizado numeric(15, 2);
  v_desconto_realizado numeric(15, 2);
  v_diferenca numeric(15, 2);
  v_diferenca_percentual numeric(5, 2);
  v_records_created integer := 0;
  v_first_day date;
  v_last_day date;
BEGIN
  -- Calcular primeiro e último dia do mês
  v_first_day := make_date(p_ano, p_mes, 1);
  v_last_day := (v_first_day + interval '1 month - 1 day')::date;

  -- Deletar metas existentes para o período e filial
  EXECUTE format('
    DELETE FROM %I.metas_mensais
    WHERE filial_id = $1
      AND EXTRACT(YEAR FROM data) = $2
      AND EXTRACT(MONTH FROM data) = $3
  ', p_schema)
  USING p_filial_id, p_ano, p_mes;

  -- Inicializar data de referência
  v_data_referencia := p_data_referencia_inicial;

  -- Loop para cada dia do mês
  FOR v_data_meta IN
    SELECT generate_series(v_first_day, v_last_day, '1 day'::interval)::date
  LOOP
    -- Obter dia da semana em português
    v_dia_semana := CASE EXTRACT(DOW FROM v_data_meta)
      WHEN 0 THEN 'Domingo'
      WHEN 1 THEN 'Segunda-Feira'
      WHEN 2 THEN 'Terça-Feira'
      WHEN 3 THEN 'Quarta-Feira'
      WHEN 4 THEN 'Quinta-Feira'
      WHEN 5 THEN 'Sexta-Feira'
      WHEN 6 THEN 'Sábado'
    END;

    -- Buscar valor de referência (vendas da data de referência)
    EXECUTE format('
      SELECT COALESCE(valor_total, 0)
      FROM %I.vendas_diarias_por_filial
      WHERE filial_id = $1 AND data_venda = $2
    ', p_schema)
    INTO v_valor_referencia
    USING p_filial_id, v_data_referencia;

    -- Buscar descontos da data de referência
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE filial_id = $1 AND data_desconto = $2
    ', p_schema)
    INTO v_desconto_referencia
    USING p_filial_id, v_data_referencia;

    -- Calcular valor de referência LÍQUIDO (vendas - descontos)
    v_valor_referencia := v_valor_referencia - v_desconto_referencia;

    -- Calcular valor da meta
    v_valor_meta := v_valor_referencia * (1 + (p_meta_percentual / 100));

    -- Buscar valor realizado (vendas da data da meta)
    EXECUTE format('
      SELECT COALESCE(valor_total, 0)
      FROM %I.vendas_diarias_por_filial
      WHERE filial_id = $1 AND data_venda = $2
    ', p_schema)
    INTO v_valor_realizado
    USING p_filial_id, v_data_meta;

    -- Buscar descontos da data da meta
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE filial_id = $1 AND data_desconto = $2
    ', p_schema)
    INTO v_desconto_realizado
    USING p_filial_id, v_data_meta;

    -- Calcular valor realizado LÍQUIDO (vendas - descontos)
    v_valor_realizado := v_valor_realizado - v_desconto_realizado;

    -- Calcular diferença
    v_diferenca := v_valor_realizado - v_valor_meta;

    -- Calcular diferença percentual
    IF v_valor_meta > 0 THEN
      v_diferenca_percentual := (v_diferenca / v_valor_meta) * 100;
    ELSE
      v_diferenca_percentual := 0;
    END IF;

    -- Inserir meta
    EXECUTE format('
      INSERT INTO %I.metas_mensais (
        filial_id, data, dia_semana, meta_percentual,
        data_referencia, valor_referencia, valor_meta,
        valor_realizado, diferenca, diferenca_percentual
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ', p_schema)
    USING
      p_filial_id, v_data_meta, v_dia_semana, p_meta_percentual,
      v_data_referencia, v_valor_referencia, v_valor_meta,
      v_valor_realizado, v_diferenca, v_diferenca_percentual;

    v_records_created := v_records_created + 1;

    -- Avançar data de referência para o próximo dia
    v_data_referencia := v_data_referencia + interval '1 day';
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'records_created', v_records_created,
    'filial_id', p_filial_id,
    'mes', p_mes,
    'ano', p_ano
  );
END;
$_$;


--
-- Name: FUNCTION generate_metas_mensais(p_schema text, p_filial_id bigint, p_mes integer, p_ano integer, p_meta_percentual numeric, p_data_referencia_inicial date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_metas_mensais(p_schema text, p_filial_id bigint, p_mes integer, p_ano integer, p_meta_percentual numeric, p_data_referencia_inicial date) IS 'Gera metas mensais com valores LÍQUIDOS (vendas - descontos) tanto para referência quanto realizado';


--
-- Name: generate_metas_setor(text, bigint, integer, integer, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_metas_setor(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_ids bigint[] DEFAULT NULL::bigint[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '30s'
    SET work_mem TO '64MB'
    AS $_$
DECLARE
  v_result JSONB;
  v_date_start DATE;
  v_date_end DATE;
  v_rows_inserted INT;
  v_existing_rows INT;
  v_filiais_filter TEXT;
  v_query_start TIMESTAMP;
  v_query_duration INTERVAL;
BEGIN
  v_query_start := clock_timestamp();

  -- Validar parâmetros
  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mês e ano são obrigatórios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês inválido: % (deve ser 1-12)', p_mes;
  END IF;

  -- ✅ OTIMIZAÇÃO: Calcular range de datas UMA VEZ
  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := v_date_start + INTERVAL '1 month' - INTERVAL '1 day';

  RAISE NOTICE 'Gerando metas: schema=%, setor=%, período=% a %',
    p_schema, p_setor_id, v_date_start, v_date_end;

  -- Verificar se setor existe e está ativo
  EXECUTE format('
    SELECT EXISTS(
      SELECT 1 FROM %I.setores
      WHERE id = $1 AND ativo = true
    )
  ', p_schema)
  INTO v_result
  USING p_setor_id;

  IF NOT (v_result::text::boolean) THEN
    RAISE EXCEPTION 'Setor % não encontrado ou inativo', p_setor_id;
  END IF;

  -- Verificar se já existem metas para este período
  EXECUTE format('
    SELECT COUNT(*)
    FROM %I.metas_setor
    WHERE setor_id = $1
      AND data >= $2
      AND data <= $3
      AND ($4::bigint[] IS NULL OR filial_id = ANY($4))
  ', p_schema)
  INTO v_existing_rows
  USING p_setor_id, v_date_start, v_date_end, p_filial_ids;

  IF v_existing_rows > 0 THEN
    RAISE NOTICE 'Já existem % metas para este período. Deletando...', v_existing_rows;

    -- Deletar metas existentes
    EXECUTE format('
      DELETE FROM %I.metas_setor
      WHERE setor_id = $1
        AND data >= $2
        AND data <= $3
        AND ($4::bigint[] IS NULL OR filial_id = ANY($4))
    ', p_schema)
    USING p_setor_id, v_date_start, v_date_end, p_filial_ids;
  END IF;

  -- ✅ BATCH INSERT: Gerar todas as metas de uma vez
  RAISE NOTICE 'Inserindo metas em lote (batch INSERT)...';

  EXECUTE format('
    INSERT INTO %I.metas_setor (
      setor_id,
      filial_id,
      data,
      valor_meta,
      valor_realizado,
      diferenca,
      diferenca_percentual,
      created_at,
      updated_at
    )
    SELECT
      $1,                    -- setor_id
      f.id,                  -- filial_id
      d.dia::DATE,           -- data (cada dia do mês)
      0,                     -- valor_meta (inicializado em 0)
      0,                     -- valor_realizado (inicializado em 0)
      0,                     -- diferenca
      0,                     -- diferenca_percentual
      NOW(),                 -- created_at
      NOW()                  -- updated_at
    FROM %I.filiais f
    CROSS JOIN generate_series(
      $2::DATE,              -- data inicial
      $3::DATE,              -- data final
      INTERVAL ''1 day''
    ) AS d(dia)
    WHERE ($4::bigint[] IS NULL OR f.id = ANY($4))
      AND f.ativo = true
    ORDER BY f.id, d.dia
  ', p_schema, p_schema)
  USING p_setor_id, v_date_start, v_date_end, p_filial_ids;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  v_query_duration := clock_timestamp() - v_query_start;

  RAISE NOTICE '✅ Geradas % metas em %', v_rows_inserted, v_query_duration;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'rows_inserted', v_rows_inserted,
    'rows_deleted', v_existing_rows,
    'setor_id', p_setor_id,
    'mes', p_mes,
    'ano', p_ano,
    'filial_ids', COALESCE(p_filial_ids, ARRAY[]::bigint[]),
    'duration_ms', EXTRACT(EPOCH FROM v_query_duration) * 1000,
    'message', format('%s metas geradas com sucesso', v_rows_inserted)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', true,
      'message', SQLERRM,
      'detail', SQLSTATE,
      'setor_id', p_setor_id
    );
END;
$_$;


--
-- Name: generate_metas_setor(text, bigint, bigint, integer, integer, numeric, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_metas_setor(p_schema text, p_setor_id bigint, p_filial_id bigint, p_mes integer, p_ano integer, p_meta_percentual numeric, p_data_referencia_inicial date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_setor RECORD;
  v_dias_no_mes INT;
  v_current_date DATE;
  v_data_referencia DATE;
  v_dia_semana TEXT;
  v_dia_semana_ref TEXT;
  v_valor_referencia NUMERIC;
  v_valor_meta NUMERIC;
  v_valor_realizado NUMERIC;
  v_diferenca NUMERIC;
  v_diferenca_percentual NUMERIC;
  v_rows_inserted INT := 0;
  v_dept_ids_level_1 BIGINT[];
BEGIN
  EXECUTE format('SELECT departamento_nivel, departamento_ids FROM %I.setores WHERE id = $1 AND (ativo IS NULL OR ativo = true)', p_schema) 
  INTO v_setor USING p_setor_id;

  IF v_setor.departamento_ids IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Setor não encontrado');
  END IF;

  -- Buscar IDs de nível 1 baseados na hierarquia
  v_dept_ids_level_1 := public.get_departamentos_hierarquia_simples(p_schema, v_setor.departamento_nivel, v_setor.departamento_ids);
  
  IF v_dept_ids_level_1 IS NULL OR array_length(v_dept_ids_level_1, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Nenhum departamento encontrado na hierarquia');
  END IF;

  v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(p_ano, p_mes, 1)) + INTERVAL '1 month' - INTERVAL '1 day'));

  EXECUTE format('DELETE FROM %I.metas_setor WHERE setor_id = $1 AND filial_id = $2 AND EXTRACT(MONTH FROM data) = $3 AND EXTRACT(YEAR FROM data) = $4', p_schema)
  USING p_setor_id, p_filial_id, p_mes, p_ano;

  FOR i IN 1..v_dias_no_mes LOOP
    v_current_date := MAKE_DATE(p_ano, p_mes, i);
    v_data_referencia := p_data_referencia_inicial + (i - 1);
    
    v_dia_semana := CASE EXTRACT(DOW FROM v_current_date) WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda-Feira' WHEN 2 THEN 'Terça-Feira' WHEN 3 THEN 'Quarta-Feira' WHEN 4 THEN 'Quinta-Feira' WHEN 5 THEN 'Sexta-Feira' WHEN 6 THEN 'Sábado' END;
    v_dia_semana_ref := CASE EXTRACT(DOW FROM v_data_referencia) WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda-Feira' WHEN 2 THEN 'Terça-Feira' WHEN 3 THEN 'Quarta-Feira' WHEN 4 THEN 'Quinta-Feira' WHEN 5 THEN 'Sexta-Feira' WHEN 6 THEN 'Sábado' END;

    -- Buscar vendas de produtos com departamento_id de nível 1
    EXECUTE format('
      SELECT COALESCE(SUM(v.valor_vendas), 0)
      FROM %I.vendas v
      JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.filial_id = $1
        AND v.data_venda = $2
        AND p.departamento_id = ANY($3)
    ', p_schema, p_schema)
    INTO v_valor_referencia
    USING p_filial_id, v_data_referencia, v_dept_ids_level_1;

    v_valor_meta := CASE WHEN v_valor_referencia > 0 THEN v_valor_referencia * (1 + (p_meta_percentual / 100)) ELSE NULL END;

    EXECUTE format('
      SELECT COALESCE(SUM(v.valor_vendas), 0)
      FROM %I.vendas v
      JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.filial_id = $1
        AND v.data_venda = $2
        AND p.departamento_id = ANY($3)
    ', p_schema, p_schema)
    INTO v_valor_realizado
    USING p_filial_id, v_current_date, v_dept_ids_level_1;

    v_diferenca := CASE WHEN v_valor_meta IS NOT NULL THEN v_valor_realizado - v_valor_meta ELSE NULL END;
    v_diferenca_percentual := CASE WHEN v_valor_meta > 0 THEN (v_diferenca / v_valor_meta) * 100 ELSE 0 END;

    EXECUTE format('INSERT INTO %I.metas_setor (setor_id, filial_id, data, dia_semana, meta_percentual, data_referencia, dia_semana_ref, valor_referencia, valor_meta, valor_realizado, diferenca, diferenca_percentual) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)', p_schema)
    USING p_setor_id, p_filial_id, v_current_date, v_dia_semana, p_meta_percentual, v_data_referencia, v_dia_semana_ref, v_valor_referencia, v_valor_meta, v_valor_realizado, v_diferenca, v_diferenca_percentual;

    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'rows_inserted', v_rows_inserted, 
    'message', format('Metas geradas: %s linhas', v_rows_inserted),
    'debug', json_build_object(
      'nivel', v_setor.departamento_nivel,
      'dept_ids_config', v_setor.departamento_ids,
      'dept_ids_level_1', v_dept_ids_level_1
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$_$;


--
-- Name: generate_metas_setores(text, bigint, bigint, integer, integer, numeric, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_metas_setores(p_schema text, p_setor_id bigint, p_filial_id bigint, p_mes integer, p_ano integer, p_meta_percentual numeric, p_data_referencia_inicial date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_result jsonb;
  v_dias_no_mes integer;
  v_data_atual date;
  v_data_referencia date;
  v_dia_semana text;
  v_valor_referencia numeric;
  v_valor_meta numeric;
  v_valor_realizado numeric;
  v_diferenca numeric;
  v_diferenca_percentual numeric;
  v_departamento_ids bigint[];
  v_departamento_nivel smallint;
  v_count integer := 0;
BEGIN
  -- Get setor configuration
  EXECUTE format('
    SELECT departamento_ids, departamento_nivel
    FROM %I.setores
    WHERE id = $1 AND ativo = true
  ', p_schema)
  INTO v_departamento_ids, v_departamento_nivel
  USING p_setor_id;

  IF v_departamento_ids IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Setor não encontrado ou inativo');
  END IF;

  -- Get number of days in month
  v_dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'));

  -- Delete existing metas for this setor/filial/month
  EXECUTE format('
    DELETE FROM %I.metas_setores
    WHERE setor_id = $1 
      AND filial_id = $2
      AND EXTRACT(MONTH FROM data) = $3
      AND EXTRACT(YEAR FROM data) = $4
  ', p_schema)
  USING p_setor_id, p_filial_id, p_mes, p_ano;

  -- Generate goals for each day
  FOR i IN 1..v_dias_no_mes LOOP
    v_data_atual := make_date(p_ano, p_mes, i);
    v_data_referencia := p_data_referencia_inicial + (i - 1);
    
    -- Get day of week in Portuguese
    v_dia_semana := CASE EXTRACT(DOW FROM v_data_atual)
      WHEN 0 THEN 'Domingo'
      WHEN 1 THEN 'Segunda-Feira'
      WHEN 2 THEN 'Terça-Feira'
      WHEN 3 THEN 'Quarta-Feira'
      WHEN 4 THEN 'Quinta-Feira'
      WHEN 5 THEN 'Sexta-Feira'
      WHEN 6 THEN 'Sábado'
    END;

    -- Get reference value (sum of sales for products in the sector's departments)
    EXECUTE format('
      SELECT COALESCE(SUM(v.valor_vendas), 0)
      FROM %I.vendas v
      INNER JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.filial_id = $1
        AND v.data_venda = $2
        AND p.departamento_id = ANY($3)
        AND p.departamento_nivel = $4
    ', p_schema, p_schema)
    INTO v_valor_referencia
    USING p_filial_id, v_data_referencia, v_departamento_ids, v_departamento_nivel;

    -- Calculate goal value
    IF v_valor_referencia > 0 THEN
      v_valor_meta := v_valor_referencia * (1 + p_meta_percentual / 100);
    ELSE
      v_valor_meta := NULL;
    END IF;

    -- Get actual value
    EXECUTE format('
      SELECT COALESCE(SUM(v.valor_vendas), 0)
      FROM %I.vendas v
      INNER JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.filial_id = $1
        AND v.data_venda = $2
        AND p.departamento_id = ANY($3)
        AND p.departamento_nivel = $4
    ', p_schema, p_schema)
    INTO v_valor_realizado
    USING p_filial_id, v_data_atual, v_departamento_ids, v_departamento_nivel;

    -- Calculate difference
    IF v_valor_meta IS NOT NULL AND v_valor_realizado IS NOT NULL THEN
      v_diferenca := v_valor_realizado - v_valor_meta;
      IF v_valor_meta > 0 THEN
        v_diferenca_percentual := (v_diferenca / v_valor_meta) * 100;
      ELSE
        v_diferenca_percentual := 0;
      END IF;
    ELSE
      v_diferenca := NULL;
      v_diferenca_percentual := NULL;
    END IF;

    -- Insert goal
    EXECUTE format('
      INSERT INTO %I.metas_setores (
        setor_id, filial_id, data, dia_semana, meta_percentual,
        data_referencia, valor_referencia, valor_meta,
        valor_realizado, diferenca, diferenca_percentual
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (setor_id, filial_id, data) 
      DO UPDATE SET
        dia_semana = EXCLUDED.dia_semana,
        meta_percentual = EXCLUDED.meta_percentual,
        data_referencia = EXCLUDED.data_referencia,
        valor_referencia = EXCLUDED.valor_referencia,
        valor_meta = EXCLUDED.valor_meta,
        valor_realizado = EXCLUDED.valor_realizado,
        diferenca = EXCLUDED.diferenca,
        diferenca_percentual = EXCLUDED.diferenca_percentual,
        updated_at = now()
    ', p_schema)
    USING p_setor_id, p_filial_id, v_data_atual, v_dia_semana, p_meta_percentual,
          v_data_referencia, v_valor_referencia, v_valor_meta,
          v_valor_realizado, v_diferenca, v_diferenca_percentual;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'metas_geradas', v_count,
    'mes', p_mes,
    'ano', p_ano,
    'setor_id', p_setor_id,
    'filial_id', p_filial_id
  );
END;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cnpj character varying(18),
    phone character varying(15),
    supabase_schema character varying(100),
    tenant_type character varying(20) DEFAULT 'company'::character varying,
    parent_tenant_id uuid
);


--
-- Name: COLUMN tenants.cnpj; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.cnpj IS 'CNPJ da empresa (formato: 00.000.000/0000-00)';


--
-- Name: COLUMN tenants.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.phone IS 'Telefone da empresa com DDD (formato: (11) 98765-4321)';


--
-- Name: COLUMN tenants.supabase_schema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.supabase_schema IS 'Nome do schema Supabase onde estão os dados financeiros desta empresa';


--
-- Name: COLUMN tenants.tenant_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.tenant_type IS 'Tipo do tenant: company (matriz) ou branch (filial)';


--
-- Name: COLUMN tenants.parent_tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.parent_tenant_id IS 'ID da empresa matriz (para filiais). NULL para matrizes.';


--
-- Name: get_accessible_tenants(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_accessible_tenants(user_id uuid) RETURNS SETOF public.tenants
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Se for superadmin, retorna TODOS os tenants ativos
  IF is_superadmin(user_id) THEN
    RETURN QUERY
    SELECT t.* FROM tenants t
    WHERE t.is_active = true
    ORDER BY t.name;
  ELSE
    -- Senão, retorna apenas o tenant do usuário
    RETURN QUERY
    SELECT t.* FROM tenants t
    INNER JOIN user_profiles up ON up.tenant_id = t.id
    WHERE up.id = user_id
    AND t.is_active = true;
  END IF;
END;
$$;


--
-- Name: FUNCTION get_accessible_tenants(user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_accessible_tenants(user_id uuid) IS 'Retorna todos os tenants ativos para superadmins, ou apenas o tenant do usuário normal';


--
-- Name: get_dashboard_data(text, date, date, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_data(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[] DEFAULT NULL::text[]) RETURNS TABLE(total_vendas numeric, total_lucro numeric, ticket_medio numeric, margem_lucro numeric, pa_vendas numeric, pa_lucro numeric, pa_ticket_medio numeric, pa_margem_lucro numeric, variacao_vendas_mes numeric, variacao_lucro_mes numeric, variacao_ticket_mes numeric, variacao_margem_mes numeric, variacao_vendas_ano numeric, variacao_lucro_ano numeric, variacao_ticket_ano numeric, variacao_margem_ano numeric, ytd_vendas numeric, ytd_vendas_ano_anterior numeric, ytd_variacao_percent numeric, grafico_vendas json, reserved text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_total_vendas NUMERIC := 0;
  v_total_lucro NUMERIC := 0;
  v_total_transacoes NUMERIC := 0;
  v_ticket_medio NUMERIC := 0;
  v_margem_lucro NUMERIC := 0;

  v_pa_vendas NUMERIC := 0;
  v_pa_lucro NUMERIC := 0;
  v_pa_transacoes NUMERIC := 0;
  v_pa_ticket_medio NUMERIC := 0;
  v_pa_margem_lucro NUMERIC := 0;

  v_paa_vendas NUMERIC := 0;
  v_paa_lucro NUMERIC := 0;
  v_paa_transacoes NUMERIC := 0;
  v_paa_ticket_medio NUMERIC := 0;
  v_paa_margem_lucro NUMERIC := 0;

  v_ytd_vendas NUMERIC := 0;
  v_ytd_vendas_ano_anterior NUMERIC := 0;
  v_ytd_variacao_percent NUMERIC := 0;

  v_variacao_vendas_mes NUMERIC := 0;
  v_variacao_lucro_mes NUMERIC := 0;
  v_variacao_ticket_mes NUMERIC := 0;
  v_variacao_margem_mes NUMERIC := 0;

  v_variacao_vendas_ano NUMERIC := 0;
  v_variacao_lucro_ano NUMERIC := 0;
  v_variacao_ticket_ano NUMERIC := 0;
  v_variacao_margem_ano NUMERIC := 0;

  v_grafico_vendas JSON := '[]'::JSON;

  v_data_inicio_pa DATE;
  v_data_fim_pa DATE;
  v_data_inicio_paa DATE;
  v_data_fim_paa DATE;
  v_data_inicio_ytd DATE;
  v_data_fim_ytd DATE;
  v_data_inicio_ytd_ano_anterior DATE;
  v_data_fim_ytd_ano_anterior DATE;

  v_descontos_periodo NUMERIC := 0;
  v_descontos_pa NUMERIC := 0;
  v_descontos_paa NUMERIC := 0;
  v_descontos_ytd NUMERIC := 0;
  v_descontos_ytd_ano_anterior NUMERIC := 0;

  v_table_exists BOOLEAN;
BEGIN
  -- Calculate PAM (Período Anterior Mesmo) dates
  v_data_inicio_pa := (p_data_inicio - INTERVAL '1 month')::DATE;
  v_data_fim_pa := (p_data_fim - INTERVAL '1 month')::DATE;

  -- Calculate PAA (Período Anterior Acumulado / Ano anterior) dates
  v_data_inicio_paa := (p_data_inicio - INTERVAL '1 year')::DATE;
  v_data_fim_paa := (p_data_fim - INTERVAL '1 year')::DATE;

  -- Calculate YTD dates
  v_data_inicio_ytd := DATE_TRUNC('year', p_data_inicio)::DATE;
  v_data_fim_ytd := p_data_fim;
  v_data_inicio_ytd_ano_anterior := (v_data_inicio_ytd - INTERVAL '1 year')::DATE;
  v_data_fim_ytd_ano_anterior := (v_data_fim_ytd - INTERVAL '1 year')::DATE;

  -- Check if descontos_venda table exists
  EXECUTE format('
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = %L AND table_name = ''descontos_venda''
    )', schema_name) INTO v_table_exists;

  -- Get current period data
  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0),
      COALESCE(SUM(total_lucro), 0),
      COALESCE(SUM(total_transacoes), 0)
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING p_data_inicio, p_data_fim, p_filiais_ids
  INTO v_total_vendas, v_total_lucro, v_total_transacoes;

  -- Get discounts for current period if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING p_data_inicio, p_data_fim, p_filiais_ids
    INTO v_descontos_periodo;

    v_total_vendas := v_total_vendas - v_descontos_periodo;
    v_total_lucro := v_total_lucro - v_descontos_periodo;
  END IF;

  -- Calculate current period metrics
  IF v_total_transacoes > 0 THEN
    v_ticket_medio := v_total_vendas / v_total_transacoes;
  END IF;

  IF v_total_vendas > 0 THEN
    v_margem_lucro := (v_total_lucro / v_total_vendas) * 100;
  END IF;

  -- Get PAM data
  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0),
      COALESCE(SUM(total_lucro), 0),
      COALESCE(SUM(total_transacoes), 0)
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_pa, v_data_fim_pa, p_filiais_ids
  INTO v_pa_vendas, v_pa_lucro, v_pa_transacoes;

  -- Get discounts for PAM if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_pa, v_data_fim_pa, p_filiais_ids
    INTO v_descontos_pa;

    v_pa_vendas := v_pa_vendas - v_descontos_pa;
    v_pa_lucro := v_pa_lucro - v_descontos_pa;
  END IF;

  -- Calculate PAM metrics
  IF v_pa_transacoes > 0 THEN
    v_pa_ticket_medio := v_pa_vendas / v_pa_transacoes;
  END IF;

  IF v_pa_vendas > 0 THEN
    v_pa_margem_lucro := (v_pa_lucro / v_pa_vendas) * 100;
  END IF;

  -- Get PAA data
  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0),
      COALESCE(SUM(total_lucro), 0),
      COALESCE(SUM(total_transacoes), 0)
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_paa, v_data_fim_paa, p_filiais_ids
  INTO v_paa_vendas, v_paa_lucro, v_paa_transacoes;

  -- Get discounts for PAA if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_paa, v_data_fim_paa, p_filiais_ids
    INTO v_descontos_paa;

    v_paa_vendas := v_paa_vendas - v_descontos_paa;
    v_paa_lucro := v_paa_lucro - v_descontos_paa;
  END IF;

  -- Calculate PAA metrics
  IF v_paa_transacoes > 0 THEN
    v_paa_ticket_medio := v_paa_vendas / v_paa_transacoes;
  END IF;

  IF v_paa_vendas > 0 THEN
    v_paa_margem_lucro := (v_paa_lucro / v_paa_vendas) * 100;
  END IF;

  -- Calculate month-over-month variations
  IF v_pa_vendas > 0 THEN
    v_variacao_vendas_mes := ((v_total_vendas - v_pa_vendas) / v_pa_vendas) * 100;
  END IF;

  IF v_pa_lucro > 0 THEN
    v_variacao_lucro_mes := ((v_total_lucro - v_pa_lucro) / v_pa_lucro) * 100;
  END IF;

  IF v_pa_ticket_medio > 0 THEN
    v_variacao_ticket_mes := ((v_ticket_medio - v_pa_ticket_medio) / v_pa_ticket_medio) * 100;
  END IF;

  v_variacao_margem_mes := v_margem_lucro - v_pa_margem_lucro;

  -- Calculate year-over-year variations
  IF v_paa_vendas > 0 THEN
    v_variacao_vendas_ano := ((v_total_vendas - v_paa_vendas) / v_paa_vendas) * 100;
  END IF;

  IF v_paa_lucro > 0 THEN
    v_variacao_lucro_ano := ((v_total_lucro - v_paa_lucro) / v_paa_lucro) * 100;
  END IF;

  IF v_paa_ticket_medio > 0 THEN
    v_variacao_ticket_ano := ((v_ticket_medio - v_paa_ticket_medio) / v_paa_ticket_medio) * 100;
  END IF;

  v_variacao_margem_ano := v_margem_lucro - v_paa_margem_lucro;

  -- Get YTD data
  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0)
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
  INTO v_ytd_vendas;

  -- Get discounts for YTD if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
    INTO v_descontos_ytd;

    v_ytd_vendas := v_ytd_vendas - v_descontos_ytd;
  END IF;

  -- Get YTD data for previous year
  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0)
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
  INTO v_ytd_vendas_ano_anterior;

  -- Get discounts for YTD previous year if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
    INTO v_descontos_ytd_ano_anterior;

    v_ytd_vendas_ano_anterior := v_ytd_vendas_ano_anterior - v_descontos_ytd_ano_anterior;
  END IF;

  -- Calculate YTD variation
  IF v_ytd_vendas_ano_anterior > 0 THEN
    v_ytd_variacao_percent := ((v_ytd_vendas - v_ytd_vendas_ano_anterior) / v_ytd_vendas_ano_anterior) * 100;
  END IF;

  -- Generate chart data (daily comparison)
  EXECUTE format('
    SELECT COALESCE(
      json_agg(
        json_build_object(
          ''mes'', TO_CHAR(data_venda, ''DD/MM''),
          ''ano_atual'', vendas_atual,
          ''ano_anterior'', vendas_anterior
        ) ORDER BY data_venda
      ),
      ''[]''::JSON
    )
    FROM (
      SELECT
        v1.data_venda,
        COALESCE(SUM(v1.valor_total), 0) as vendas_atual,
        COALESCE(SUM(v2.valor_total), 0) as vendas_anterior
      FROM %I.vendas_diarias_por_filial v1
      LEFT JOIN %I.vendas_diarias_por_filial v2
        ON v2.data_venda = (v1.data_venda - INTERVAL ''1 year'')::DATE
        AND ($3 IS NULL OR v2.filial_id = ANY($3::INTEGER[]))
      WHERE v1.data_venda BETWEEN $1 AND $2
        AND ($3 IS NULL OR v1.filial_id = ANY($3::INTEGER[]))
      GROUP BY v1.data_venda
    ) dados
  ', schema_name, schema_name)
  USING p_data_inicio, p_data_fim, p_filiais_ids
  INTO v_grafico_vendas;

  -- Return all metrics
  RETURN QUERY SELECT
    v_total_vendas,
    v_total_lucro,
    v_ticket_medio,
    v_margem_lucro,
    v_pa_vendas,
    v_pa_lucro,
    v_pa_ticket_medio,
    v_pa_margem_lucro,
    v_variacao_vendas_mes,
    v_variacao_lucro_mes,
    v_variacao_ticket_mes,
    v_variacao_margem_mes,
    v_variacao_vendas_ano,
    v_variacao_lucro_ano,
    v_variacao_ticket_ano,
    v_variacao_margem_ano,
    v_ytd_vendas,
    v_ytd_vendas_ano_anterior,
    v_ytd_variacao_percent,
    v_grafico_vendas,
    NULL::TEXT;
END;
$_$;


--
-- Name: FUNCTION get_dashboard_data(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_dashboard_data(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]) IS 'Dashboard data with both comparisons always returned:
- pa_* fields: always PAM (previous month comparison)
- variacao_*_mes: variation compared to PAM
- variacao_*_ano: variation compared to PAA (previous year)
Frontend controls date ranges based on filter type (month/year/custom)';


--
-- Name: get_dashboard_data_test(text, date, date, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_data_test(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[] DEFAULT NULL::text[]) RETURNS TABLE(total_vendas numeric, total_lucro numeric, ticket_medio numeric, margem_lucro numeric, pa_vendas numeric, pa_lucro numeric, pa_ticket_medio numeric, pa_margem_lucro numeric, variacao_vendas_mes numeric, variacao_lucro_mes numeric, variacao_ticket_mes numeric, variacao_margem_mes numeric, variacao_vendas_ano numeric, variacao_lucro_ano numeric, variacao_ticket_ano numeric, variacao_margem_ano numeric, ytd_vendas numeric, ytd_vendas_ano_anterior numeric, ytd_variacao_percent numeric, grafico_vendas jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    periodo_dias INT := p_data_fim - p_data_inicio;
    data_inicio_mes_ant DATE := p_data_inicio - interval '1 month';
    data_fim_mes_ant DATE := data_inicio_mes_ant + periodo_dias;
    data_inicio_ano_ant DATE := p_data_inicio - interval '1 year';
    data_fim_ano_ant DATE := data_inicio_ano_ant + periodo_dias;

    data_inicio_ytd DATE := date_trunc('year', CURRENT_DATE)::DATE;
    data_fim_ytd DATE := CURRENT_DATE;
    data_inicio_ytd_ant DATE := date_trunc('year', CURRENT_DATE - interval '1 year')::DATE;
    data_fim_ytd_ant DATE := data_inicio_ytd_ant + (data_fim_ytd - data_inicio_ytd);

    v_vendas_atual NUMERIC; v_lucro_atual NUMERIC; v_transacoes_atual BIGINT;
    v_ticket_medio_atual NUMERIC; v_margem_lucro_atual NUMERIC;
    v_vendas_mes_ant NUMERIC; v_lucro_mes_ant NUMERIC; v_transacoes_mes_ant BIGINT;
    v_ticket_medio_mes_ant NUMERIC; v_margem_lucro_mes_ant NUMERIC;
    v_vendas_ano_ant NUMERIC; v_lucro_ano_ant NUMERIC; v_transacoes_ano_ant BIGINT;
    v_ticket_medio_ano_ant NUMERIC; v_margem_lucro_ano_ant NUMERIC;

    v_descontos_atual NUMERIC := 0;
    v_descontos_mes_ant NUMERIC := 0;
    v_descontos_ano_ant NUMERIC := 0;
    v_descontos_ytd NUMERIC := 0;
    v_descontos_ytd_ant NUMERIC := 0;

    v_ytd_vendas NUMERIC;
    v_ytd_vendas_ant NUMERIC;
    v_ytd_variacao NUMERIC;

    v_grafico_vendas JSONB;

    filter_clause TEXT;
BEGIN
    IF p_filiais_ids IS NOT NULL AND array_length(p_filiais_ids, 1) > 0 THEN
        filter_clause := format('AND filial_id::TEXT = ANY(%L)', p_filiais_ids);
    ELSE
        filter_clause := '';
    END IF;

    -- Vendas brutas
    EXECUTE format('SELECT COALESCE(SUM(valor_total),0), COALESCE(SUM(total_lucro),0), COALESCE(SUM(total_transacoes),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, p_data_inicio, p_data_fim, filter_clause) INTO v_vendas_atual, v_lucro_atual, v_transacoes_atual;
    EXECUTE format('SELECT COALESCE(SUM(valor_total),0), COALESCE(SUM(total_lucro),0), COALESCE(SUM(total_transacoes),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_mes_ant, data_fim_mes_ant, filter_clause) INTO v_vendas_mes_ant, v_lucro_mes_ant, v_transacoes_mes_ant;
    EXECUTE format('SELECT COALESCE(SUM(valor_total),0), COALESCE(SUM(total_lucro),0), COALESCE(SUM(total_transacoes),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_ano_ant, data_fim_ano_ant, filter_clause) INTO v_vendas_ano_ant, v_lucro_ano_ant, v_transacoes_ano_ant;

    -- YTD
    EXECUTE format('SELECT COALESCE(SUM(valor_total),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_ytd, data_fim_ytd, filter_clause) INTO v_ytd_vendas;
    EXECUTE format('SELECT COALESCE(SUM(valor_total),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_ytd_ant, data_fim_ytd_ant, filter_clause) INTO v_ytd_vendas_ant;

    -- BUSCAR DESCONTOS
    EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, p_data_inicio, p_data_fim, filter_clause) INTO v_descontos_atual;
    EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_mes_ant, data_fim_mes_ant, filter_clause) INTO v_descontos_mes_ant;
    EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_ano_ant, data_fim_ano_ant, filter_clause) INTO v_descontos_ano_ant;
    EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_ytd, data_fim_ytd, filter_clause) INTO v_descontos_ytd;
    EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_ytd_ant, data_fim_ytd_ant, filter_clause) INTO v_descontos_ytd_ant;

    -- APLICAR DESCONTOS
    v_vendas_atual := v_vendas_atual - v_descontos_atual;
    v_lucro_atual := v_lucro_atual - v_descontos_atual;
    v_vendas_mes_ant := v_vendas_mes_ant - v_descontos_mes_ant;
    v_lucro_mes_ant := v_lucro_mes_ant - v_descontos_mes_ant;
    v_vendas_ano_ant := v_vendas_ano_ant - v_descontos_ano_ant;
    v_lucro_ano_ant := v_lucro_ano_ant - v_descontos_ano_ant;
    v_ytd_vendas := v_ytd_vendas - v_descontos_ytd;
    v_ytd_vendas_ant := v_ytd_vendas_ant - v_descontos_ytd_ant;

    -- Métricas
    v_ticket_medio_atual := CASE WHEN v_transacoes_atual > 0 THEN v_vendas_atual / v_transacoes_atual ELSE 0 END;
    v_margem_lucro_atual := CASE WHEN v_vendas_atual > 0 THEN (v_lucro_atual / v_vendas_atual) * 100 ELSE 0 END;
    v_ticket_medio_mes_ant := CASE WHEN v_transacoes_mes_ant > 0 THEN v_vendas_mes_ant / v_transacoes_mes_ant ELSE 0 END;
    v_margem_lucro_mes_ant := CASE WHEN v_vendas_mes_ant > 0 THEN (v_lucro_mes_ant / v_vendas_mes_ant) * 100 ELSE 0 END;
    v_ticket_medio_ano_ant := CASE WHEN v_transacoes_ano_ant > 0 THEN v_vendas_ano_ant / v_transacoes_ano_ant ELSE 0 END;
    v_margem_lucro_ano_ant := CASE WHEN v_vendas_ano_ant > 0 THEN (v_lucro_ano_ant / v_vendas_ano_ant) * 100 ELSE 0 END;

    v_ytd_variacao := CASE WHEN v_ytd_vendas_ant > 0 THEN ((v_ytd_vendas - v_ytd_vendas_ant) / v_ytd_vendas_ant) * 100 ELSE 0 END;

    -- Retorno
    total_vendas := v_vendas_atual;
    total_lucro := v_lucro_atual;
    ticket_medio := v_ticket_medio_atual;
    margem_lucro := v_margem_lucro_atual;

    pa_vendas := v_vendas_mes_ant;
    pa_lucro := v_lucro_mes_ant;
    pa_ticket_medio := v_ticket_medio_mes_ant;
    pa_margem_lucro := v_margem_lucro_mes_ant;

    variacao_vendas_mes := CASE WHEN v_vendas_mes_ant > 0 THEN ((v_vendas_atual - v_vendas_mes_ant) / v_vendas_mes_ant) * 100 ELSE 0 END;
    variacao_lucro_mes := CASE WHEN v_lucro_mes_ant > 0 THEN ((v_lucro_atual - v_lucro_mes_ant) / v_lucro_mes_ant) * 100 ELSE 0 END;
    variacao_ticket_mes := CASE WHEN v_ticket_medio_mes_ant > 0 THEN ((v_ticket_medio_atual - v_ticket_medio_mes_ant) / v_ticket_medio_mes_ant) * 100 ELSE 0 END;
    variacao_margem_mes := v_margem_lucro_atual - v_margem_lucro_mes_ant;
    variacao_vendas_ano := CASE WHEN v_vendas_ano_ant > 0 THEN ((v_vendas_atual - v_vendas_ano_ant) / v_vendas_ano_ant) * 100 ELSE 0 END;
    variacao_lucro_ano := CASE WHEN v_lucro_ano_ant > 0 THEN ((v_lucro_atual - v_lucro_ano_ant) / v_lucro_ano_ant) * 100 ELSE 0 END;
    variacao_ticket_ano := CASE WHEN v_ticket_medio_ano_ant > 0 THEN ((v_ticket_medio_atual - v_ticket_medio_ano_ant) / v_ticket_medio_ano_ant) * 100 ELSE 0 END;
    variacao_margem_ano := v_margem_lucro_atual - v_margem_lucro_ano_ant;

    ytd_vendas := v_ytd_vendas;
    ytd_vendas_ano_anterior := v_ytd_vendas_ant;
    ytd_variacao_percent := v_ytd_variacao;

    grafico_vendas := '[]'::jsonb; -- Simplificado para teste

    RETURN NEXT;
END;
$$;


--
-- Name: get_dashboard_mtd_metrics(text, date, date, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_mtd_metrics(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[] DEFAULT NULL::text[]) RETURNS TABLE(mtd_vendas numeric, mtd_lucro numeric, mtd_margem numeric, mtd_mes_anterior_vendas numeric, mtd_mes_anterior_lucro numeric, mtd_mes_anterior_margem numeric, mtd_variacao_mes_anterior_vendas_percent numeric, mtd_variacao_mes_anterior_lucro_percent numeric, mtd_variacao_mes_anterior_margem numeric, mtd_ano_anterior_vendas numeric, mtd_ano_anterior_lucro numeric, mtd_ano_anterior_margem numeric, mtd_variacao_ano_anterior_vendas_percent numeric, mtd_variacao_ano_anterior_lucro_percent numeric, mtd_variacao_ano_anterior_margem numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  -- Reference day for MTD calculation
  v_reference_day INTEGER;
  v_mtd_end_day INTEGER;
  v_is_full_past_month BOOLEAN;

  -- MTD date ranges
  v_data_inicio_mtd DATE;
  v_data_fim_mtd DATE;
  v_data_inicio_mtd_mes_anterior DATE;
  v_data_fim_mtd_mes_anterior DATE;
  v_data_inicio_mtd_ano_anterior DATE;
  v_data_fim_mtd_ano_anterior DATE;

  -- Current MTD metrics
  v_mtd_vendas NUMERIC := 0;
  v_mtd_lucro NUMERIC := 0;
  v_mtd_margem NUMERIC := 0;

  -- Previous month MTD metrics
  v_mtd_mes_anterior_vendas NUMERIC := 0;
  v_mtd_mes_anterior_lucro NUMERIC := 0;
  v_mtd_mes_anterior_margem NUMERIC := 0;

  -- Previous year MTD metrics
  v_mtd_ano_anterior_vendas NUMERIC := 0;
  v_mtd_ano_anterior_lucro NUMERIC := 0;
  v_mtd_ano_anterior_margem NUMERIC := 0;

  -- Variations
  v_mtd_variacao_mes_anterior_vendas_percent NUMERIC := 0;
  v_mtd_variacao_mes_anterior_lucro_percent NUMERIC := 0;
  v_mtd_variacao_mes_anterior_margem NUMERIC := 0;
  v_mtd_variacao_ano_anterior_vendas_percent NUMERIC := 0;
  v_mtd_variacao_ano_anterior_lucro_percent NUMERIC := 0;
  v_mtd_variacao_ano_anterior_margem NUMERIC := 0;

  -- Discounts
  v_descontos_mtd NUMERIC := 0;
  v_descontos_mtd_mes_anterior NUMERIC := 0;
  v_descontos_mtd_ano_anterior NUMERIC := 0;
  v_table_exists BOOLEAN;

  -- Helper for last day of month
  v_last_day_mes_anterior INTEGER;
  v_last_day_ano_anterior INTEGER;
  v_is_first_day_of_month BOOLEAN;
  v_last_day_of_filter_month INTEGER;
  v_is_last_day_of_month BOOLEAN;
  v_is_past_month BOOLEAN;
BEGIN
  -- ==========================================
  -- DETECT IF FILTER IS A FULL PAST MONTH
  -- ==========================================
  -- Check if: first day of month AND last day of month AND in the past

  v_is_first_day_of_month := EXTRACT(DAY FROM p_data_inicio) = 1;

  -- Last day of the filter's month
  v_last_day_of_filter_month := EXTRACT(DAY FROM (DATE_TRUNC('month', p_data_inicio) + INTERVAL '1 month' - INTERVAL '1 day')::DATE);

  v_is_last_day_of_month := EXTRACT(DAY FROM p_data_fim) = v_last_day_of_filter_month;

  v_is_past_month := p_data_fim < CURRENT_DATE;

  v_is_full_past_month := v_is_first_day_of_month AND v_is_last_day_of_month AND v_is_past_month;

  -- ==========================================
  -- DETERMINE REFERENCE DAY FOR MTD CALCULATION
  -- ==========================================

  IF p_data_fim >= CURRENT_DATE THEN
    -- Current month or future: use today's day as reference
    v_reference_day := EXTRACT(DAY FROM CURRENT_DATE);
  ELSE
    -- Past month: use the filter's end date day
    v_reference_day := EXTRACT(DAY FROM p_data_fim);
  END IF;

  -- ==========================================
  -- CALCULATE MTD DATE RANGES
  -- ==========================================

  -- Current MTD: start of month to reference day
  v_data_inicio_mtd := DATE_TRUNC('month', p_data_inicio)::DATE;
  v_data_fim_mtd := LEAST(
    (DATE_TRUNC('month', p_data_inicio) + (v_reference_day - 1) * INTERVAL '1 day')::DATE,
    p_data_fim  -- Don't exceed the filter end date
  );

  -- ==========================================
  -- PREVIOUS MONTH MTD
  -- ==========================================
  v_data_inicio_mtd_mes_anterior := (DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 month')::DATE;

  -- Calculate last day of previous month
  v_last_day_mes_anterior := EXTRACT(DAY FROM (DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 day')::DATE);

  IF v_is_full_past_month THEN
    -- Full past month filter: fetch FULL previous month
    v_data_fim_mtd_mes_anterior := (v_data_inicio_mtd_mes_anterior + (v_last_day_mes_anterior - 1) * INTERVAL '1 day')::DATE;
  ELSE
    -- Proportional MTD: use minimum between reference day and last day of previous month
    v_mtd_end_day := LEAST(v_reference_day, v_last_day_mes_anterior);
    v_data_fim_mtd_mes_anterior := (v_data_inicio_mtd_mes_anterior + (v_mtd_end_day - 1) * INTERVAL '1 day')::DATE;
  END IF;

  -- ==========================================
  -- PREVIOUS YEAR MTD
  -- ==========================================
  v_data_inicio_mtd_ano_anterior := (DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 year')::DATE;

  -- Calculate last day of same month in previous year
  v_last_day_ano_anterior := EXTRACT(DAY FROM ((DATE_TRUNC('month', p_data_inicio) - INTERVAL '1 year') + INTERVAL '1 month' - INTERVAL '1 day')::DATE);

  IF v_is_full_past_month THEN
    -- Full past month filter: fetch FULL same month previous year
    v_data_fim_mtd_ano_anterior := (v_data_inicio_mtd_ano_anterior + (v_last_day_ano_anterior - 1) * INTERVAL '1 day')::DATE;
  ELSE
    -- Proportional MTD: use minimum between reference day and last day of same month previous year
    v_mtd_end_day := LEAST(v_reference_day, v_last_day_ano_anterior);
    v_data_fim_mtd_ano_anterior := (v_data_inicio_mtd_ano_anterior + (v_mtd_end_day - 1) * INTERVAL '1 day')::DATE;
  END IF;

  -- Check if descontos_venda table exists
  EXECUTE format('
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = %L AND table_name = ''descontos_venda''
    )', schema_name) INTO v_table_exists;

  -- ==========================================
  -- CURRENT MTD
  -- ==========================================

  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0) as vendas,
      COALESCE(SUM(total_lucro), 0) as lucro
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_mtd, v_data_fim_mtd, p_filiais_ids
  INTO v_mtd_vendas, v_mtd_lucro;

  -- Get discounts for current MTD if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_mtd, v_data_fim_mtd, p_filiais_ids
    INTO v_descontos_mtd;

    v_mtd_vendas := v_mtd_vendas - v_descontos_mtd;
    v_mtd_lucro := v_mtd_lucro - v_descontos_mtd;
  END IF;

  -- Calculate current MTD margin
  IF v_mtd_vendas > 0 THEN
    v_mtd_margem := (v_mtd_lucro / v_mtd_vendas) * 100;
  ELSE
    v_mtd_margem := 0;
  END IF;

  -- ==========================================
  -- PREVIOUS MONTH MTD
  -- ==========================================

  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0) as vendas,
      COALESCE(SUM(total_lucro), 0) as lucro
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_mtd_mes_anterior, v_data_fim_mtd_mes_anterior, p_filiais_ids
  INTO v_mtd_mes_anterior_vendas, v_mtd_mes_anterior_lucro;

  -- Get discounts for previous month MTD if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_mtd_mes_anterior, v_data_fim_mtd_mes_anterior, p_filiais_ids
    INTO v_descontos_mtd_mes_anterior;

    v_mtd_mes_anterior_vendas := v_mtd_mes_anterior_vendas - v_descontos_mtd_mes_anterior;
    v_mtd_mes_anterior_lucro := v_mtd_mes_anterior_lucro - v_descontos_mtd_mes_anterior;
  END IF;

  -- Calculate previous month MTD margin
  IF v_mtd_mes_anterior_vendas > 0 THEN
    v_mtd_mes_anterior_margem := (v_mtd_mes_anterior_lucro / v_mtd_mes_anterior_vendas) * 100;
  ELSE
    v_mtd_mes_anterior_margem := 0;
  END IF;

  -- ==========================================
  -- PREVIOUS YEAR MTD
  -- ==========================================

  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0) as vendas,
      COALESCE(SUM(total_lucro), 0) as lucro
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_mtd_ano_anterior, v_data_fim_mtd_ano_anterior, p_filiais_ids
  INTO v_mtd_ano_anterior_vendas, v_mtd_ano_anterior_lucro;

  -- Get discounts for previous year MTD if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_mtd_ano_anterior, v_data_fim_mtd_ano_anterior, p_filiais_ids
    INTO v_descontos_mtd_ano_anterior;

    v_mtd_ano_anterior_vendas := v_mtd_ano_anterior_vendas - v_descontos_mtd_ano_anterior;
    v_mtd_ano_anterior_lucro := v_mtd_ano_anterior_lucro - v_descontos_mtd_ano_anterior;
  END IF;

  -- Calculate previous year MTD margin
  IF v_mtd_ano_anterior_vendas > 0 THEN
    v_mtd_ano_anterior_margem := (v_mtd_ano_anterior_lucro / v_mtd_ano_anterior_vendas) * 100;
  ELSE
    v_mtd_ano_anterior_margem := 0;
  END IF;

  -- ==========================================
  -- CALCULATE VARIATIONS
  -- ==========================================

  -- Variations vs previous month
  IF v_mtd_mes_anterior_vendas > 0 THEN
    v_mtd_variacao_mes_anterior_vendas_percent := ((v_mtd_vendas - v_mtd_mes_anterior_vendas) / v_mtd_mes_anterior_vendas) * 100;
  ELSE
    v_mtd_variacao_mes_anterior_vendas_percent := 0;
  END IF;

  IF v_mtd_mes_anterior_lucro > 0 THEN
    v_mtd_variacao_mes_anterior_lucro_percent := ((v_mtd_lucro - v_mtd_mes_anterior_lucro) / v_mtd_mes_anterior_lucro) * 100;
  ELSE
    v_mtd_variacao_mes_anterior_lucro_percent := 0;
  END IF;

  v_mtd_variacao_mes_anterior_margem := v_mtd_margem - v_mtd_mes_anterior_margem;

  -- Variations vs previous year
  IF v_mtd_ano_anterior_vendas > 0 THEN
    v_mtd_variacao_ano_anterior_vendas_percent := ((v_mtd_vendas - v_mtd_ano_anterior_vendas) / v_mtd_ano_anterior_vendas) * 100;
  ELSE
    v_mtd_variacao_ano_anterior_vendas_percent := 0;
  END IF;

  IF v_mtd_ano_anterior_lucro > 0 THEN
    v_mtd_variacao_ano_anterior_lucro_percent := ((v_mtd_lucro - v_mtd_ano_anterior_lucro) / v_mtd_ano_anterior_lucro) * 100;
  ELSE
    v_mtd_variacao_ano_anterior_lucro_percent := 0;
  END IF;

  v_mtd_variacao_ano_anterior_margem := v_mtd_margem - v_mtd_ano_anterior_margem;

  -- ==========================================
  -- RETURN RESULTS
  -- ==========================================

  RETURN QUERY SELECT
    v_mtd_vendas,
    v_mtd_lucro,
    v_mtd_margem,
    v_mtd_mes_anterior_vendas,
    v_mtd_mes_anterior_lucro,
    v_mtd_mes_anterior_margem,
    v_mtd_variacao_mes_anterior_vendas_percent,
    v_mtd_variacao_mes_anterior_lucro_percent,
    v_mtd_variacao_mes_anterior_margem,
    v_mtd_ano_anterior_vendas,
    v_mtd_ano_anterior_lucro,
    v_mtd_ano_anterior_margem,
    v_mtd_variacao_ano_anterior_vendas_percent,
    v_mtd_variacao_ano_anterior_lucro_percent,
    v_mtd_variacao_ano_anterior_margem;
END;
$_$;


--
-- Name: FUNCTION get_dashboard_mtd_metrics(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_dashboard_mtd_metrics(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]) IS 'Calculates Month-to-Date metrics for Revenue, Profit and Margin.
- When filtering a FULL PAST MONTH: compares with FULL previous months (mês completo vs mês completo)
- When filtering current month or partial period: uses proportional MTD comparison
FIX 2025-12-05: Added full month detection to fix comparison discrepancies.';


--
-- Name: get_dashboard_ytd_metrics(text, date, date, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_ytd_metrics(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[] DEFAULT NULL::text[]) RETURNS TABLE(ytd_vendas numeric, ytd_vendas_ano_anterior numeric, ytd_variacao_vendas_percent numeric, ytd_lucro numeric, ytd_lucro_ano_anterior numeric, ytd_variacao_lucro_percent numeric, ytd_margem numeric, ytd_margem_ano_anterior numeric, ytd_variacao_margem numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_data_inicio_ytd DATE;
  v_data_fim_ytd DATE;
  v_data_inicio_ytd_ano_anterior DATE;
  v_data_fim_ytd_ano_anterior DATE;
  
  v_ytd_vendas NUMERIC := 0;
  v_ytd_lucro NUMERIC := 0;
  v_ytd_margem NUMERIC := 0;
  
  v_ytd_vendas_ano_anterior NUMERIC := 0;
  v_ytd_lucro_ano_anterior NUMERIC := 0;
  v_ytd_margem_ano_anterior NUMERIC := 0;
  
  v_ytd_variacao_vendas_percent NUMERIC := 0;
  v_ytd_variacao_lucro_percent NUMERIC := 0;
  v_ytd_variacao_margem NUMERIC := 0;
  
  v_descontos_ytd NUMERIC := 0;
  v_descontos_ytd_ano_anterior NUMERIC := 0;
  v_table_exists BOOLEAN;
BEGIN
  -- Calculate YTD dates (start of year to end date)
  v_data_inicio_ytd := DATE_TRUNC('year', p_data_inicio)::DATE;
  
  -- Use CURRENT_DATE only if filtering the current year
  IF EXTRACT(YEAR FROM p_data_inicio) = EXTRACT(YEAR FROM CURRENT_DATE) THEN
    v_data_fim_ytd := LEAST(p_data_fim, CURRENT_DATE);
  ELSE
    v_data_fim_ytd := p_data_fim;
  END IF;
  
  -- Calculate YTD dates for previous year (same period)
  v_data_inicio_ytd_ano_anterior := (v_data_inicio_ytd - INTERVAL '1 year')::DATE;
  v_data_fim_ytd_ano_anterior := (v_data_fim_ytd - INTERVAL '1 year')::DATE;
  
  -- Check if descontos_venda table exists
  EXECUTE format('
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = %L AND table_name = ''descontos_venda''
    )', schema_name) INTO v_table_exists;
  
  -- ==========================================
  -- CURRENT YEAR YTD
  -- ==========================================
  
  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0) as vendas,
      COALESCE(SUM(total_lucro), 0) as lucro
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
  INTO v_ytd_vendas, v_ytd_lucro;
  
  -- Get discounts for current year YTD if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_ytd, v_data_fim_ytd, p_filiais_ids
    INTO v_descontos_ytd;
    
    v_ytd_vendas := v_ytd_vendas - v_descontos_ytd;
    v_ytd_lucro := v_ytd_lucro - v_descontos_ytd;
  END IF;
  
  -- Calculate current year YTD margin
  IF v_ytd_vendas > 0 THEN
    v_ytd_margem := (v_ytd_lucro / v_ytd_vendas) * 100;
  ELSE
    v_ytd_margem := 0;
  END IF;
  
  -- ==========================================
  -- PREVIOUS YEAR YTD
  -- ==========================================
  
  EXECUTE format('
    SELECT
      COALESCE(SUM(valor_total), 0) as vendas,
      COALESCE(SUM(total_lucro), 0) as lucro
    FROM %I.vendas_diarias_por_filial
    WHERE data_venda BETWEEN $1 AND $2
      AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
  ', schema_name)
  USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
  INTO v_ytd_vendas_ano_anterior, v_ytd_lucro_ano_anterior;
  
  -- Get discounts for previous year YTD if table exists
  IF v_table_exists THEN
    EXECUTE format('
      SELECT COALESCE(SUM(valor_desconto), 0)
      FROM %I.descontos_venda
      WHERE data_desconto BETWEEN $1 AND $2
        AND ($3 IS NULL OR filial_id = ANY($3::INTEGER[]))
    ', schema_name)
    USING v_data_inicio_ytd_ano_anterior, v_data_fim_ytd_ano_anterior, p_filiais_ids
    INTO v_descontos_ytd_ano_anterior;
    
    v_ytd_vendas_ano_anterior := v_ytd_vendas_ano_anterior - v_descontos_ytd_ano_anterior;
    v_ytd_lucro_ano_anterior := v_ytd_lucro_ano_anterior - v_descontos_ytd_ano_anterior;
  END IF;
  
  -- Calculate previous year YTD margin
  IF v_ytd_vendas_ano_anterior > 0 THEN
    v_ytd_margem_ano_anterior := (v_ytd_lucro_ano_anterior / v_ytd_vendas_ano_anterior) * 100;
  ELSE
    v_ytd_margem_ano_anterior := 0;
  END IF;
  
  -- ==========================================
  -- CALCULATE VARIATIONS
  -- ==========================================
  
  -- Revenue variation %
  IF v_ytd_vendas_ano_anterior > 0 THEN
    v_ytd_variacao_vendas_percent := ((v_ytd_vendas - v_ytd_vendas_ano_anterior) / v_ytd_vendas_ano_anterior) * 100;
  ELSE
    v_ytd_variacao_vendas_percent := 0;
  END IF;
  
  -- Profit variation %
  IF v_ytd_lucro_ano_anterior > 0 THEN
    v_ytd_variacao_lucro_percent := ((v_ytd_lucro - v_ytd_lucro_ano_anterior) / v_ytd_lucro_ano_anterior) * 100;
  ELSE
    v_ytd_variacao_lucro_percent := 0;
  END IF;
  
  -- Margin variation (percentage points)
  v_ytd_variacao_margem := v_ytd_margem - v_ytd_margem_ano_anterior;
  
  -- ==========================================
  -- RETURN RESULTS
  -- ==========================================
  
  RETURN QUERY SELECT
    v_ytd_vendas,
    v_ytd_vendas_ano_anterior,
    v_ytd_variacao_vendas_percent,
    v_ytd_lucro,
    v_ytd_lucro_ano_anterior,
    v_ytd_variacao_lucro_percent,
    v_ytd_margem,
    v_ytd_margem_ano_anterior,
    v_ytd_variacao_margem;
END;
$_$;


--
-- Name: FUNCTION get_dashboard_ytd_metrics(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_dashboard_ytd_metrics(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]) IS 'Calculates Year-to-Date metrics for Revenue, Profit and Margin with discounts applied.';


--
-- Name: get_departamentos_hierarquia(text, integer, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_departamentos_hierarquia(p_schema text, p_nivel integer, p_dept_ids bigint[]) RETURNS TABLE(nivel integer, dept_id bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  -- Retornar o próprio nível
  RETURN QUERY
  SELECT p_nivel, unnest(p_dept_ids);
  
  -- Se for nível 3, buscar níveis 2 e 1 relacionados
  IF p_nivel = 3 THEN
    -- Nível 2
    RETURN QUERY EXECUTE format('
      SELECT 2, departamento_id::BIGINT
      FROM %I.departments_level_2
      WHERE pai_level_3_id = ANY($1)
    ', p_schema) USING p_dept_ids;
    
    -- Nível 1
    RETURN QUERY EXECUTE format('
      SELECT 1, departamento_id::BIGINT
      FROM %I.departments_level_1
      WHERE pai_level_3_id = ANY($1)
    ', p_schema) USING p_dept_ids;
  END IF;
  
  -- Se for nível 2, buscar nível 1
  IF p_nivel = 2 THEN
    RETURN QUERY EXECUTE format('
      SELECT 1, departamento_id::BIGINT
      FROM %I.departments_level_1
      WHERE pai_level_2_id = ANY($1)
    ', p_schema) USING p_dept_ids;
  END IF;
  
  -- Níveis 4, 5, 6 podem ser adicionados depois se necessário
  
  RETURN;
END;
$_$;


--
-- Name: get_departamentos_hierarquia_simples(text, integer, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_departamentos_hierarquia_simples(p_schema text, p_nivel integer, p_dept_ids bigint[]) RETURNS bigint[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_result BIGINT[];
BEGIN
  -- Se for nível 1, retornar os próprios IDs
  IF p_nivel = 1 THEN
    RETURN p_dept_ids;
  END IF;
  
  -- Se for nível 2, buscar todos level_1 que têm pai_level_2_id nos IDs
  IF p_nivel = 2 THEN
    EXECUTE format('
      SELECT array_agg(DISTINCT departamento_id)
      FROM %I.departments_level_1
      WHERE pai_level_2_id = ANY($1)
    ', p_schema)
    INTO v_result
    USING p_dept_ids;
    RETURN v_result;
  END IF;
  
  -- Se for nível 3, buscar todos level_1 que têm pai_level_3_id nos IDs
  IF p_nivel = 3 THEN
    EXECUTE format('
      SELECT array_agg(DISTINCT departamento_id)
      FROM %I.departments_level_1
      WHERE pai_level_3_id = ANY($1)
    ', p_schema)
    INTO v_result
    USING p_dept_ids;
    RETURN v_result;
  END IF;
  
  -- Nível 4
  IF p_nivel = 4 THEN
    EXECUTE format('
      SELECT array_agg(DISTINCT departamento_id)
      FROM %I.departments_level_1
      WHERE pai_level_4_id = ANY($1)
    ', p_schema)
    INTO v_result
    USING p_dept_ids;
    RETURN v_result;
  END IF;
  
  -- Nível 5
  IF p_nivel = 5 THEN
    EXECUTE format('
      SELECT array_agg(DISTINCT departamento_id)
      FROM %I.departments_level_1
      WHERE pai_level_5_id = ANY($1)
    ', p_schema)
    INTO v_result
    USING p_dept_ids;
    RETURN v_result;
  END IF;
  
  -- Nível 6
  IF p_nivel = 6 THEN
    EXECUTE format('
      SELECT array_agg(DISTINCT departamento_id)
      FROM %I.departments_level_1
      WHERE pai_level_6_id = ANY($1)
    ', p_schema)
    INTO v_result
    USING p_dept_ids;
    RETURN v_result;
  END IF;
  
  RETURN ARRAY[]::BIGINT[];
END;
$_$;


--
-- Name: get_descontos_venda(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_descontos_venda(p_schema text) RETURNS TABLE(id uuid, filial_id integer, data_desconto date, valor_desconto numeric, desconto_custo numeric, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT 
      id,
      filial_id,
      data_desconto,
      valor_desconto,
      COALESCE(desconto_custo, 0) as desconto_custo,
      observacao,
      created_at,
      updated_at,
      created_by
    FROM %I.descontos_venda
    ORDER BY data_desconto DESC, filial_id',
    p_schema
  );
END;
$$;


--
-- Name: FUNCTION get_descontos_venda(p_schema text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_descontos_venda(p_schema text) IS 'Busca todos os descontos_venda de um schema específico';


--
-- Name: get_despesas_hierarquia(text, integer, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_despesas_hierarquia(p_schema text, p_filial_id integer, p_data_inicial date, p_data_final date, p_tipo_data text DEFAULT 'data_despesa'::text) RETURNS TABLE(dept_id integer, dept_descricao text, tipo_id integer, tipo_descricao text, data_emissao date, descricao_despesa text, id_fornecedor integer, numero_nota bigint, serie_nota character varying, valor numeric, usuario character varying, observacao text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      d.id AS dept_id,
      d.descricao AS dept_descricao,
      td.id AS tipo_id,
      td.descricao AS tipo_descricao,
      desp.data_emissao,
      desp.descricao_despesa AS descricao_despesa,
      desp.id_fornecedor,
      desp.numero_nota,
      desp.serie_nota,
      desp.valor,
      desp.usuario,
      desp.observacao
    FROM %I.despesas desp
    INNER JOIN %I.tipos_despesa td ON desp.id_tipo_despesa = td.id
    INNER JOIN %I.departamentos_nivel1 d ON td.departamentalizacao_nivel1 = d.id
    WHERE desp.filial_id = $1
      AND desp.data_despesa BETWEEN $2 AND $3
    ORDER BY d.descricao, td.descricao, desp.data_despesa DESC
  ', p_schema, p_schema, p_schema)
  USING p_filial_id, p_data_inicial, p_data_final;
END;
$_$;


--
-- Name: FUNCTION get_despesas_hierarquia(p_schema text, p_filial_id integer, p_data_inicial date, p_data_final date, p_tipo_data text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_despesas_hierarquia(p_schema text, p_filial_id integer, p_data_inicial date, p_data_final date, p_tipo_data text) IS 'Retorna despesas hierárquicas agrupadas por departamento e tipo usando data_despesa';


--
-- Name: get_dre_comparativo_data(text, integer[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dre_comparativo_data(p_schema text, p_filiais_ids integer[], p_mes integer, p_ano integer) RETURNS TABLE(receita_bruta_pdv numeric, receita_bruta_faturamento numeric, receita_bruta numeric, desconto_venda numeric, receita_liquida numeric, cmv_pdv numeric, cmv_faturamento numeric, cmv numeric, lucro_bruto numeric, margem_bruta numeric, despesas_operacionais numeric, resultado_operacional numeric, margem_operacional numeric, despesas_json jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  BEGIN
    -- Redirecionar para v3
    RETURN QUERY 
    SELECT * FROM public.get_dre_comparativo_data_v3(
      p_schema, 
      p_filiais_ids, 
      p_mes, 
      p_ano
    );
  END;
  $$;


--
-- Name: get_dre_comparativo_data_v2(text, integer[], date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dre_comparativo_data_v2(p_schema text, p_filiais_ids integer[], p_data_inicio date, p_data_fim date) RETURNS TABLE(receita_bruta_pdv numeric, receita_bruta_faturamento numeric, receita_bruta numeric, desconto_venda numeric, receita_liquida numeric, cmv_pdv numeric, cmv_faturamento numeric, cmv numeric, lucro_bruto numeric, margem_bruta numeric, despesas_operacionais numeric, resultado_operacional numeric, margem_operacional numeric, despesas_json jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  BEGIN
    -- Redirecionar para v2_v3
    RETURN QUERY 
    SELECT * FROM public.get_dre_comparativo_data_v2_v3(
      p_schema,
      p_filiais_ids,
      p_data_inicio,
      p_data_fim
    );
  END;
  $$;


--
-- Name: get_dre_comparativo_data_v2_v3(text, integer[], date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dre_comparativo_data_v2_v3(p_schema text, p_filiais_ids integer[], p_data_inicio date, p_data_fim date) RETURNS TABLE(receita_bruta_pdv numeric, receita_bruta_faturamento numeric, receita_bruta numeric, desconto_venda numeric, receita_liquida numeric, cmv_pdv numeric, cmv_faturamento numeric, cmv numeric, lucro_bruto numeric, margem_bruta numeric, despesas_operacionais numeric, resultado_operacional numeric, margem_operacional numeric, despesas_json jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $_$
  DECLARE
    v_receita_bruta_pdv NUMERIC := 0;
    v_cmv_pdv NUMERIC := 0;
    v_receita_bruta_faturamento NUMERIC := 0;
    v_cmv_faturamento NUMERIC := 0;
    v_receita_bruta NUMERIC := 0;
    v_desconto_venda NUMERIC := 0;
    v_receita_liquida NUMERIC := 0;
    v_cmv NUMERIC := 0;
    v_lucro_bruto NUMERIC := 0;
    v_margem_bruta NUMERIC := 0;
    v_despesas_operacionais NUMERIC := 0;
    v_resultado_operacional NUMERIC := 0;
    v_margem_operacional NUMERIC := 0;
    v_despesas_json JSONB := '[]'::JSONB;
    v_table_exists BOOLEAN;
  BEGIN
    -- Validations
    IF p_schema IS NULL OR p_schema = '' THEN 
      RAISE EXCEPTION 'Schema é obrigatório'; 
    END IF;
    
    IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN 
      RAISE EXCEPTION 'Período de datas é obrigatório'; 
    END IF;
    
    IF p_filiais_ids IS NULL OR array_length(p_filiais_ids, 1) IS NULL THEN 
      RAISE EXCEPTION 'Ao menos uma filial é obrigatória'; 
    END IF;

    -- ============================================
    -- PDV (Vendas Diárias)
    -- ============================================
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_total), 0)::NUMERIC 
      FROM %I.vendas_diarias_por_filial 
      WHERE data_venda BETWEEN $1 AND $2 
        AND filial_id = ANY($3)',
      p_schema
    ) INTO v_receita_bruta_pdv 
    USING p_data_inicio, p_data_fim, p_filiais_ids;

    EXECUTE format(
      'SELECT COALESCE(SUM(custo_total), 0)::NUMERIC 
      FROM %I.vendas_diarias_por_filial 
      WHERE data_venda BETWEEN $1 AND $2 
        AND filial_id = ANY($3)',
      p_schema
    ) INTO v_cmv_pdv 
    USING p_data_inicio, p_data_fim, p_filiais_ids;

    -- ============================================
    -- FATURAMENTO
    -- ============================================
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = %L 
          AND table_name = ''faturamento''
      )', 
      p_schema
    ) INTO v_table_exists;

    IF v_table_exists THEN
      EXECUTE format(
        'SELECT COALESCE(SUM(valor_contabil), 0)::NUMERIC 
        FROM (
          SELECT DISTINCT ON (id_saida) id_saida, valor_contabil 
          FROM %I.faturamento 
          WHERE data_saida BETWEEN $1 AND $2 
            AND (cancelado IS NULL OR cancelado = '' '' OR cancelado = '''') 
            AND filial_id = ANY($3)
        ) n',
        p_schema
      ) INTO v_receita_bruta_faturamento 
      USING p_data_inicio, p_data_fim, p_filiais_ids;

      EXECUTE format(
        'SELECT COALESCE(SUM(quantidade * custo_medio), 0)::NUMERIC 
        FROM %I.faturamento 
        WHERE data_saida BETWEEN $1 AND $2 
          AND (cancelado IS NULL OR cancelado = '' '' OR cancelado = '''') 
          AND filial_id = ANY($3)',
        p_schema
      ) INTO v_cmv_faturamento 
      USING p_data_inicio, p_data_fim, p_filiais_ids;
    END IF;

    v_receita_bruta := v_receita_bruta_pdv + v_receita_bruta_faturamento;
    v_cmv := v_cmv_pdv + v_cmv_faturamento;

    -- ============================================
    -- DESCONTOS
    -- ============================================
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = %L 
          AND table_name = ''descontos_venda''
      )',
      p_schema
    ) INTO v_table_exists;

    IF v_table_exists THEN
      EXECUTE format(
        'SELECT COALESCE(SUM(valor_desconto), 0)::NUMERIC 
        FROM %I.descontos_venda 
        WHERE data_desconto BETWEEN $1 AND $2 
          AND filial_id = ANY($3)',
        p_schema
      ) INTO v_desconto_venda 
      USING p_data_inicio, p_data_fim, p_filiais_ids;
    END IF;

    v_receita_liquida := v_receita_bruta - v_desconto_venda;
    v_lucro_bruto := v_receita_liquida - v_cmv;
    
    IF v_receita_liquida > 0 THEN 
      v_margem_bruta := (v_lucro_bruto / v_receita_liquida) * 100; 
    END IF;

    -- ============================================
    -- DESPESAS HIERÁRQUICAS (NOVO!)
    -- ============================================
    EXECUTE format('
      WITH despesas_completas AS (
        SELECT
          d.id AS departamento_id,
          d.descricao AS departamento,
          td.id AS tipo_id,
          td.descricao AS tipo,
          desp.descricao_despesa,
          desp.numero_nota,
          desp.serie_nota,
          desp.data_emissao,
          desp.valor
        FROM %I.despesas desp
        INNER JOIN %I.tipos_despesa td ON desp.id_tipo_despesa = td.id
        INNER JOIN %I.departamentos_nivel1 d ON td.departamentalizacao_nivel1 = d.id
        WHERE desp.data_despesa BETWEEN $1 AND $2
          AND desp.filial_id = ANY($3)
      ),
      despesas_agrupadas AS (
        SELECT 
          departamento_id,
          departamento,
          tipo_id,
          tipo,
          jsonb_agg(
            jsonb_build_object(
              ''descricao'', descricao_despesa,
              ''numero_nota'', numero_nota,
              ''serie_nota'', serie_nota,
              ''data_emissao'', data_emissao,
              ''valor'', valor
            ) ORDER BY data_emissao DESC, valor DESC
          ) AS despesas,
          SUM(valor) AS tipo_valor
        FROM despesas_completas
        GROUP BY departamento_id, departamento, tipo_id, tipo
      ),
      tipos_agrupados AS (
        SELECT
          departamento_id,
          departamento,
          jsonb_agg(
            jsonb_build_object(
              ''tipo_id'', tipo_id,
              ''tipo'', tipo,
              ''valor'', tipo_valor,
              ''despesas'', despesas
            ) ORDER BY tipo_valor DESC
          ) AS tipos,
          SUM(tipo_valor) AS dept_valor
        FROM despesas_agrupadas
        GROUP BY departamento_id, departamento
      )
      SELECT 
        COALESCE(SUM(dept_valor), 0)::NUMERIC AS total_despesas,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              ''departamento_id'', departamento_id,
              ''departamento'', departamento,
              ''valor'', dept_valor,
              ''tipos'', tipos
            ) ORDER BY dept_valor DESC
          ),
          ''[]''::JSONB
        ) AS despesas_json
      FROM tipos_agrupados
    ', p_schema, p_schema, p_schema)
    INTO v_despesas_operacionais, v_despesas_json
    USING p_data_inicio, p_data_fim, p_filiais_ids;

    v_resultado_operacional := v_lucro_bruto - v_despesas_operacionais;
    
    IF v_receita_liquida > 0 THEN 
      v_margem_operacional := (v_resultado_operacional / v_receita_liquida) * 100; 
    END IF;

    -- Return results
    RETURN QUERY SELECT 
      v_receita_bruta_pdv,
      v_receita_bruta_faturamento,
      v_receita_bruta,
      v_desconto_venda,
      v_receita_liquida,
      v_cmv_pdv,
      v_cmv_faturamento,
      v_cmv,
      v_lucro_bruto,
      v_margem_bruta,
      v_despesas_operacionais,
      v_resultado_operacional,
      v_margem_operacional,
      v_despesas_json;
  END;
  $_$;


--
-- Name: get_dre_comparativo_data_v3(text, integer[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dre_comparativo_data_v3(p_schema text, p_filiais_ids integer[], p_mes integer, p_ano integer) RETURNS TABLE(receita_bruta_pdv numeric, receita_bruta_faturamento numeric, receita_bruta numeric, desconto_venda numeric, receita_liquida numeric, cmv_pdv numeric, cmv_faturamento numeric, cmv numeric, lucro_bruto numeric, margem_bruta numeric, despesas_operacionais numeric, resultado_operacional numeric, margem_operacional numeric, despesas_json jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $_$
  DECLARE
    v_data_inicio DATE;
    v_data_fim DATE;
    v_receita_bruta_pdv NUMERIC := 0;
    v_cmv_pdv NUMERIC := 0;
    v_receita_bruta_faturamento NUMERIC := 0;
    v_cmv_faturamento NUMERIC := 0;
    v_receita_bruta NUMERIC := 0;
    v_desconto_venda NUMERIC := 0;
    v_receita_liquida NUMERIC := 0;
    v_cmv NUMERIC := 0;
    v_lucro_bruto NUMERIC := 0;
    v_margem_bruta NUMERIC := 0;
    v_despesas_operacionais NUMERIC := 0;
    v_resultado_operacional NUMERIC := 0;
    v_margem_operacional NUMERIC := 0;
    v_despesas_json JSONB := '[]'::JSONB;
    v_table_exists BOOLEAN;
  BEGIN
    -- Validations
    IF p_schema IS NULL OR p_schema = '' THEN 
      RAISE EXCEPTION 'Schema é obrigatório'; 
    END IF;
    
    IF p_mes < 1 OR p_mes > 12 THEN 
      RAISE EXCEPTION 'Mês deve estar entre 1 e 12'; 
    END IF;
    
    IF p_ano < 2000 OR p_ano > 2100 THEN 
      RAISE EXCEPTION 'Ano inválido'; 
    END IF;
    
    IF p_filiais_ids IS NULL OR array_length(p_filiais_ids, 1) IS NULL THEN 
      RAISE EXCEPTION 'Ao menos uma filial é obrigatória'; 
    END IF;

    -- Calculate date range
    v_data_inicio := make_date(p_ano, p_mes, 1);
    v_data_fim := (v_data_inicio + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- ============================================
    -- PDV (Vendas Diárias)
    -- ============================================
    EXECUTE format(
      'SELECT COALESCE(SUM(valor_total), 0)::NUMERIC 
      FROM %I.vendas_diarias_por_filial 
      WHERE data_venda BETWEEN $1 AND $2 
        AND filial_id = ANY($3)',
      p_schema
    ) INTO v_receita_bruta_pdv 
    USING v_data_inicio, v_data_fim, p_filiais_ids;

    EXECUTE format(
      'SELECT COALESCE(SUM(custo_total), 0)::NUMERIC 
      FROM %I.vendas_diarias_por_filial 
      WHERE data_venda BETWEEN $1 AND $2 
        AND filial_id = ANY($3)',
      p_schema
    ) INTO v_cmv_pdv 
    USING v_data_inicio, v_data_fim, p_filiais_ids;

    -- ============================================
    -- FATURAMENTO
    -- ============================================
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = %L 
          AND table_name = ''faturamento''
      )', 
      p_schema
    ) INTO v_table_exists;

    IF v_table_exists THEN
      EXECUTE format(
        'SELECT COALESCE(SUM(valor_contabil), 0)::NUMERIC 
        FROM (
          SELECT DISTINCT ON (id_saida) id_saida, valor_contabil 
          FROM %I.faturamento 
          WHERE data_saida BETWEEN $1 AND $2 
            AND (cancelado IS NULL OR cancelado = '' '' OR cancelado = '''') 
            AND filial_id = ANY($3)
        ) n',
        p_schema
      ) INTO v_receita_bruta_faturamento 
      USING v_data_inicio, v_data_fim, p_filiais_ids;

      EXECUTE format(
        'SELECT COALESCE(SUM(quantidade * custo_medio), 0)::NUMERIC 
        FROM %I.faturamento 
        WHERE data_saida BETWEEN $1 AND $2 
          AND (cancelado IS NULL OR cancelado = '' '' OR cancelado = '''') 
          AND filial_id = ANY($3)',
        p_schema
      ) INTO v_cmv_faturamento 
      USING v_data_inicio, v_data_fim, p_filiais_ids;
    END IF;

    v_receita_bruta := v_receita_bruta_pdv + v_receita_bruta_faturamento;
    v_cmv := v_cmv_pdv + v_cmv_faturamento;

    -- ============================================
    -- DESCONTOS
    -- ============================================
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = %L 
          AND table_name = ''descontos_venda''
      )',
      p_schema
    ) INTO v_table_exists;

    IF v_table_exists THEN
      EXECUTE format(
        'SELECT COALESCE(SUM(valor_desconto), 0)::NUMERIC 
        FROM %I.descontos_venda 
        WHERE data_desconto BETWEEN $1 AND $2 
          AND filial_id = ANY($3)',
        p_schema
      ) INTO v_desconto_venda 
      USING v_data_inicio, v_data_fim, p_filiais_ids;
    END IF;

    v_receita_liquida := v_receita_bruta - v_desconto_venda;
    v_lucro_bruto := v_receita_liquida - v_cmv;
    
    IF v_receita_liquida > 0 THEN 
      v_margem_bruta := (v_lucro_bruto / v_receita_liquida) * 100; 
    END IF;

    -- ============================================
    -- DESPESAS HIERÁRQUICAS (NOVO!)
    -- ============================================
    EXECUTE format('
      WITH despesas_completas AS (
        SELECT
          d.id AS departamento_id,
          d.descricao AS departamento,
          td.id AS tipo_id,
          td.descricao AS tipo,
          desp.descricao_despesa,
          desp.numero_nota,
          desp.serie_nota,
          desp.data_emissao,
          desp.valor
        FROM %I.despesas desp
        INNER JOIN %I.tipos_despesa td ON desp.id_tipo_despesa = td.id
        INNER JOIN %I.departamentos_nivel1 d ON td.departamentalizacao_nivel1 = d.id
        WHERE desp.data_despesa BETWEEN $1 AND $2
          AND desp.filial_id = ANY($3)
      ),
      despesas_agrupadas AS (
        SELECT 
          departamento_id,
          departamento,
          tipo_id,
          tipo,
          jsonb_agg(
            jsonb_build_object(
              ''descricao'', descricao_despesa,
              ''numero_nota'', numero_nota,
              ''serie_nota'', serie_nota,
              ''data_emissao'', data_emissao,
              ''valor'', valor
            ) ORDER BY data_emissao DESC, valor DESC
          ) AS despesas,
          SUM(valor) AS tipo_valor
        FROM despesas_completas
        GROUP BY departamento_id, departamento, tipo_id, tipo
      ),
      tipos_agrupados AS (
        SELECT
          departamento_id,
          departamento,
          jsonb_agg(
            jsonb_build_object(
              ''tipo_id'', tipo_id,
              ''tipo'', tipo,
              ''valor'', tipo_valor,
              ''despesas'', despesas
            ) ORDER BY tipo_valor DESC
          ) AS tipos,
          SUM(tipo_valor) AS dept_valor
        FROM despesas_agrupadas
        GROUP BY departamento_id, departamento
      )
      SELECT 
        COALESCE(SUM(dept_valor), 0)::NUMERIC AS total_despesas,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              ''departamento_id'', departamento_id,
              ''departamento'', departamento,
              ''valor'', dept_valor,
              ''tipos'', tipos
            ) ORDER BY dept_valor DESC
          ),
          ''[]''::JSONB
        ) AS despesas_json
      FROM tipos_agrupados
    ', p_schema, p_schema, p_schema)
    INTO v_despesas_operacionais, v_despesas_json
    USING v_data_inicio, v_data_fim, p_filiais_ids;

    v_resultado_operacional := v_lucro_bruto - v_despesas_operacionais;
    
    IF v_receita_liquida > 0 THEN 
      v_margem_operacional := (v_resultado_operacional / v_receita_liquida) * 100; 
    END IF;

    -- Return results
    RETURN QUERY SELECT 
      v_receita_bruta_pdv,
      v_receita_bruta_faturamento,
      v_receita_bruta,
      v_desconto_venda,
      v_receita_liquida,
      v_cmv_pdv,
      v_cmv_faturamento,
      v_cmv,
      v_lucro_bruto,
      v_margem_bruta,
      v_despesas_operacionais,
      v_resultado_operacional,
      v_margem_operacional,
      v_despesas_json;
  END;
  $_$;


--
-- Name: FUNCTION get_dre_comparativo_data_v3(p_schema text, p_filiais_ids integer[], p_mes integer, p_ano integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_dre_comparativo_data_v3(p_schema text, p_filiais_ids integer[], p_mes integer, p_ano integer) IS 'Retorna dados do DRE Comparativo com hierarquia completa de despesas:
  - Departamentos
  - Tipos de Despesa
  - Despesas Individuais (com nota fiscal, data, valor)

  Versão 3: Adicionado hierarquia completa em despesas_json';


--
-- Name: get_dre_indicadores(text, date, date, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dre_indicadores(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[] DEFAULT NULL::text[]) RETURNS TABLE(receita_bruta numeric, lucro_bruto numeric, cmv numeric, total_transacoes integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    filter_clause TEXT := '';
BEGIN
    -- Build filter clause for branches if provided
    IF p_filiais_ids IS NOT NULL AND array_length(p_filiais_ids, 1) > 0 THEN
        filter_clause := format('AND filial_id = ANY(ARRAY[%s]::TEXT[])', 
                               array_to_string(p_filiais_ids, ','));
    END IF;

    -- Execute dynamic query to get aggregated data
    RETURN QUERY EXECUTE format('
        SELECT 
            COALESCE(SUM(valor_total), 0)::NUMERIC as receita_bruta,
            COALESCE(SUM(total_lucro), 0)::NUMERIC as lucro_bruto,
            COALESCE(SUM(valor_total) - SUM(total_lucro), 0)::NUMERIC as cmv,
            COALESCE(SUM(total_transacoes), 0)::INTEGER as total_transacoes
        FROM %I.vendas_diarias_por_filial
        WHERE data_venda BETWEEN %L AND %L %s
    ', schema_name, p_data_inicio, p_data_fim, filter_clause);
END;
$$;


--
-- Name: FUNCTION get_dre_indicadores(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_dre_indicadores(schema_name text, p_data_inicio date, p_data_fim date, p_filiais_ids text[]) IS 'Busca indicadores agregados de vendas para o DRE Gerencial com filtro opcional por filiais';


--
-- Name: get_expenses_by_month_chart(text, text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_expenses_by_month_chart(schema_name text, p_filiais text, p_data_inicio date, p_data_fim date, p_filter_type text) RETURNS TABLE(mes text, total_despesas numeric, total_despesas_ano_anterior numeric)
    LANGUAGE plpgsql
    AS $_$
DECLARE
  v_query text;
  v_filter_type text := coalesce(p_filter_type, 'year');
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
  v_where_clause text := '';
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    v_start := make_date(extract(year from current_date)::int, 1, 1);
    v_end := make_date(extract(year from current_date)::int, 12, 31);
    v_filter_type := 'year';
  ELSE
    IF v_filter_type = 'year' THEN
      v_start := make_date(extract(year from p_data_inicio)::int, 1, 1);
      v_end := make_date(extract(year from p_data_inicio)::int, 12, 31);
    ELSIF v_filter_type = 'month' THEN
      v_start := p_data_inicio;
      v_end := p_data_fim;
    ELSE
      v_start := date_trunc('month', p_data_inicio)::date;
      v_end := (date_trunc('month', p_data_fim) + interval '1 month - 1 day')::date;
    END IF;
  END IF;

  v_prev_start := (v_start - interval '1 year')::date;
  v_prev_end := (v_end - interval '1 year')::date;

  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    v_where_clause := format('and d.filial_id in (%s)', p_filiais);
  END IF;

  v_query := format($fmt$
    with
    periods as (
      select
        gs::date as period_date,
        case
          when $1 = 'month' then to_char(gs, 'DD')
          when $1 = 'custom' then (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int] || '/' || extract(year from gs)::int
          else (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int]
        end as mes
      from generate_series(
        $2::date,
        $3::date,
        case when $1 = 'month' then interval '1 day' else interval '1 month' end
      ) gs
    ),
    despesas_atual as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, d.data_despesa)::date as period_date,
        coalesce(sum(d.valor), 0) as total
      from %I.despesas d
      where d.data_despesa between $2 and $3
        and d.data_despesa is not null
        and d.valor is not null
        %s
      group by 1
    ),
    despesas_anterior as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, d.data_despesa)::date as period_date,
        coalesce(sum(d.valor), 0) as total
      from %I.despesas d
      where d.data_despesa between $4 and $5
        and d.data_despesa is not null
        and d.valor is not null
        %s
      group by 1
    )
    select
      p.mes,
      coalesce(da.total, 0) as total_despesas,
      coalesce(daa.total, 0) as total_despesas_ano_anterior
    from periods p
    left join despesas_atual da on da.period_date = p.period_date
    left join despesas_anterior daa on daa.period_date = (p.period_date - interval '1 year')::date
    order by p.period_date
  $fmt$,
    schema_name, v_where_clause,
    schema_name, v_where_clause
  );

  return query execute v_query using v_filter_type, v_start, v_end, v_prev_start, v_prev_end;
END;
$_$;


--
-- Name: get_faturamento_by_month_chart(text, text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_faturamento_by_month_chart(schema_name text, p_filiais text, p_data_inicio date, p_data_fim date, p_filter_type text) RETURNS TABLE(mes text, total_faturamento numeric, total_faturamento_ano_anterior numeric, total_lucro_faturamento numeric, total_lucro_faturamento_ano_anterior numeric)
    LANGUAGE plpgsql
    AS $_$
DECLARE
  v_filiais_array int[];
  v_table_exists boolean;
  v_filter_type text := coalesce(p_filter_type, 'year');
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
BEGIN
  execute format(
    'select exists (
       select 1 from information_schema.tables
       where table_schema = %L and table_name = ''faturamento''
     )', schema_name
  ) into v_table_exists;

  if not v_table_exists then
    return query
    select
      m.mes::text,
      0::numeric as total_faturamento,
      0::numeric as total_faturamento_ano_anterior,
      0::numeric as total_lucro_faturamento,
      0::numeric as total_lucro_faturamento_ano_anterior
    from (
      select unnest(array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']) as mes
    ) m;
    return;
  end if;

  if p_filiais is null or p_filiais = 'all' or p_filiais = '' then
    v_filiais_array := null;
  else
    v_filiais_array := string_to_array(p_filiais, ',')::int[];
  end if;

  if p_data_inicio is null or p_data_fim is null then
    v_start := make_date(extract(year from current_date)::int, 1, 1);
    v_end := make_date(extract(year from current_date)::int, 12, 31);
    v_filter_type := 'year';
  else
    if v_filter_type = 'year' then
      v_start := make_date(extract(year from p_data_inicio)::int, 1, 1);
      v_end := make_date(extract(year from p_data_inicio)::int, 12, 31);
    elsif v_filter_type = 'month' then
      v_start := p_data_inicio;
      v_end := p_data_fim;
    else
      v_start := date_trunc('month', p_data_inicio)::date;
      v_end := (date_trunc('month', p_data_fim) + interval '1 month - 1 day')::date;
    end if;
  end if;

  v_prev_start := (v_start - interval '1 year')::date;
  v_prev_end := (v_end - interval '1 year')::date;

  return query execute format($q$
    with
    periods as (
      select
        gs::date as period_date,
        case
          when $1 = 'month' then to_char(gs, 'DD')
          when $1 = 'custom' then (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int] || '/' || extract(year from gs)::int
          else (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int]
        end as mes
      from generate_series(
        $2::date,
        $3::date,
        case when $1 = 'month' then interval '1 day' else interval '1 month' end
      ) gs
    ),
    receita_atual as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_saida)::date as period_date,
        sum(valor_contabil) as receita
      from (
        select distinct on (id_saida, date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_saida))
          id_saida, data_saida, valor_contabil
        from %I.faturamento
        where data_saida between $2 and $3
          and (cancelado is null or cancelado = '' or cancelado = ' ')
          and ($4::int[] is null or filial_id = any($4))
      ) notas
      group by 1
    ),
    cmv_atual as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_saida)::date as period_date,
        sum(quantidade * custo_medio) as cmv
      from %I.faturamento
      where data_saida between $2 and $3
        and (cancelado is null or cancelado = '' or cancelado = ' ')
        and ($4::int[] is null or filial_id = any($4))
      group by 1
    ),
    receita_anterior as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_saida)::date as period_date,
        sum(valor_contabil) as receita
      from (
        select distinct on (id_saida, date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_saida))
          id_saida, data_saida, valor_contabil
        from %I.faturamento
        where data_saida between $5 and $6
          and (cancelado is null or cancelado = '' or cancelado = ' ')
          and ($4::int[] is null or filial_id = any($4))
      ) notas
      group by 1
    ),
    cmv_anterior as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_saida)::date as period_date,
        sum(quantidade * custo_medio) as cmv
      from %I.faturamento
      where data_saida between $5 and $6
        and (cancelado is null or cancelado = '' or cancelado = ' ')
        and ($4::int[] is null or filial_id = any($4))
      group by 1
    )
    select
      p.mes,
      coalesce(ra.receita, 0)::numeric as total_faturamento,
      coalesce(rant.receita, 0)::numeric as total_faturamento_ano_anterior,
      coalesce(ra.receita - ca.cmv, 0)::numeric as total_lucro_faturamento,
      coalesce(rant.receita - cant.cmv, 0)::numeric as total_lucro_faturamento_ano_anterior
    from periods p
    left join receita_atual ra on ra.period_date = p.period_date
    left join cmv_atual ca on ca.period_date = p.period_date
    left join receita_anterior rant on rant.period_date = (p.period_date - interval '1 year')::date
    left join cmv_anterior cant on cant.period_date = (p.period_date - interval '1 year')::date
    order by p.period_date
  $q$,
    schema_name, schema_name, schema_name, schema_name
  )
  using v_filter_type, v_start, v_end, v_filiais_array, v_prev_start, v_prev_end;
end;
$_$;


--
-- Name: get_faturamento_data(text, date, date, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_faturamento_data(p_schema text, p_data_inicio date, p_data_fim date, p_filiais_ids integer[] DEFAULT NULL::integer[]) RETURNS TABLE(receita_faturamento numeric, cmv_faturamento numeric, lucro_bruto_faturamento numeric, qtd_notas integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  DECLARE
    v_receita NUMERIC := 0;
    v_cmv NUMERIC := 0;
    v_qtd_notas INTEGER := 0;
    v_table_exists BOOLEAN;
  BEGIN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema 
  = %L AND table_name = ''faturamento'')', p_schema) INTO v_table_exists;
    IF NOT v_table_exists THEN
      RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::INTEGER;
      RETURN;
    END IF;

    -- Receita: valor_contabil por nota DISTINTA (sem filtro de transacao)
    EXECUTE format('
      SELECT COALESCE(SUM(valor_contabil), 0)::NUMERIC
      FROM (SELECT DISTINCT ON (id_saida) id_saida, valor_contabil FROM %I.faturamento
        WHERE data_saida BETWEEN $1 AND $2 AND (cancelado IS NULL OR cancelado = '' '' OR 
  cancelado = '''') AND ($3 IS NULL OR filial_id = ANY($3))) notas_unicas
    ', p_schema) INTO v_receita USING p_data_inicio, p_data_fim, p_filiais_ids;

    -- CMV: SUM(quantidade * custo_medio)
    EXECUTE format('
      SELECT COALESCE(SUM(quantidade * custo_medio), 0)::NUMERIC FROM %I.faturamento
      WHERE data_saida BETWEEN $1 AND $2 AND (cancelado IS NULL OR cancelado = '' '' OR 
  cancelado = '''') AND ($3 IS NULL OR filial_id = ANY($3))
    ', p_schema) INTO v_cmv USING p_data_inicio, p_data_fim, p_filiais_ids;

    EXECUTE format('
      SELECT COUNT(DISTINCT id_saida)::INTEGER FROM %I.faturamento
      WHERE data_saida BETWEEN $1 AND $2 AND (cancelado IS NULL OR cancelado = '' '' OR 
  cancelado = '''') AND ($3 IS NULL OR filial_id = ANY($3))
    ', p_schema) INTO v_qtd_notas USING p_data_inicio, p_data_fim, p_filiais_ids;

    RETURN QUERY SELECT v_receita, v_cmv, (v_receita - v_cmv)::NUMERIC, v_qtd_notas;
  END;
  $_$;


--
-- Name: get_faturamento_por_filial(text, date, date, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_faturamento_por_filial(p_schema text, p_data_inicio date, p_data_fim date, p_filiais_ids integer[] DEFAULT NULL::integer[]) RETURNS TABLE(filial_id integer, receita_faturamento numeric, cmv_faturamento numeric, lucro_bruto_faturamento numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  DECLARE
    v_table_exists BOOLEAN;
  BEGIN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema 
  = %L AND table_name = ''faturamento'')', p_schema) INTO v_table_exists;

    IF NOT v_table_exists THEN
      RETURN;
    END IF;

    RETURN QUERY EXECUTE format('
      WITH notas_unicas AS (
        SELECT DISTINCT ON (id_saida)
          id_saida,
          filial_id as nota_filial_id,
          valor_contabil
        FROM %I.faturamento
        WHERE data_saida BETWEEN $1 AND $2
          AND (cancelado IS NULL OR cancelado = '' '' OR cancelado = '''')
          AND ($3 IS NULL OR filial_id = ANY($3))
      ),
      receitas AS (
        SELECT
          nota_filial_id as fil_id,
          COALESCE(SUM(valor_contabil), 0) as receita
        FROM notas_unicas
        GROUP BY nota_filial_id
      ),
      custos AS (
        SELECT
          filial_id as fil_id,
          COALESCE(SUM(quantidade * custo_medio), 0) as cmv
        FROM %I.faturamento
        WHERE data_saida BETWEEN $1 AND $2
          AND (cancelado IS NULL OR cancelado = '' '' OR cancelado = '''')
          AND ($3 IS NULL OR filial_id = ANY($3))
        GROUP BY filial_id
      )
      SELECT
        COALESCE(r.fil_id, c.fil_id)::INTEGER as filial_id,
        COALESCE(r.receita, 0)::NUMERIC as receita_faturamento,
        COALESCE(c.cmv, 0)::NUMERIC as cmv_faturamento,
        (COALESCE(r.receita, 0) - COALESCE(c.cmv, 0))::NUMERIC as lucro_bruto_faturamento
      FROM receitas r
      FULL OUTER JOIN custos c ON r.fil_id = c.fil_id
      ORDER BY 1
    ', p_schema, p_schema) USING p_data_inicio, p_data_fim, p_filiais_ids;
  END;
  $_$;


--
-- Name: get_lucro_by_month_chart(text, text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_lucro_by_month_chart(schema_name text, p_filiais text, p_data_inicio date, p_data_fim date, p_filter_type text) RETURNS json
    LANGUAGE plpgsql
    AS $_$
DECLARE
  result json;
  filial_filter text := '';
  v_filter_type text := coalesce(p_filter_type, 'year');
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    v_start := make_date(extract(year from current_date)::int, 1, 1);
    v_end := make_date(extract(year from current_date)::int, 12, 31);
    v_filter_type := 'year';
  ELSE
    IF v_filter_type = 'year' THEN
      v_start := make_date(extract(year from p_data_inicio)::int, 1, 1);
      v_end := make_date(extract(year from p_data_inicio)::int, 12, 31);
    ELSIF v_filter_type = 'month' THEN
      v_start := p_data_inicio;
      v_end := p_data_fim;
    ELSE
      v_start := date_trunc('month', p_data_inicio)::date;
      v_end := (date_trunc('month', p_data_fim) + interval '1 month - 1 day')::date;
    END IF;
  END IF;

  v_prev_start := (v_start - interval '1 year')::date;
  v_prev_end := (v_end - interval '1 year')::date;

  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    filial_filter := format('and vdf.filial_id in (%s)', p_filiais);
  END IF;

  execute format($q$
    with
    periods as (
      select
        gs::date as period_date,
        case
          when $1 = 'month' then to_char(gs, 'DD')
          when $1 = 'custom' then (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int] || '/' || extract(year from gs)::int
          else (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int]
        end as mes
      from generate_series(
        $2::date,
        $3::date,
        case when $1 = 'month' then interval '1 day' else interval '1 month' end
      ) gs
    ),
    lucro_atual as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, vdf.data_venda)::date as period_date,
        coalesce(sum(vdf.total_lucro), 0) as total
      from %I.vendas_diarias_por_filial vdf
      where vdf.data_venda between $2 and $3
      %s
      group by 1
    ),
    lucro_anterior as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, vdf.data_venda)::date as period_date,
        coalesce(sum(vdf.total_lucro), 0) as total
      from %I.vendas_diarias_por_filial vdf
      where vdf.data_venda between $4 and $5
      %s
      group by 1
    )
    select json_agg(t)
    from (
      select
        p.mes,
        coalesce(la.total, 0)::numeric(15,2) as total_lucro,
        coalesce(lb.total, 0)::numeric(15,2) as total_lucro_ano_anterior
      from periods p
      left join lucro_atual la on la.period_date = p.period_date
      left join lucro_anterior lb on lb.period_date = (p.period_date - interval '1 year')::date
      order by p.period_date
    ) t
  $q$,
    schema_name, filial_filter,
    schema_name, filial_filter
  )
  into result
  using v_filter_type, v_start, v_end, v_prev_start, v_prev_end;

  return coalesce(result, '[]'::json);
end;
$_$;


--
-- Name: get_metas_mensais_report(text, integer, integer, integer, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_metas_mensais_report(p_schema text, p_mes integer, p_ano integer, p_filial_id integer DEFAULT NULL::integer, p_filial_ids integer[] DEFAULT NULL::integer[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_result JSON;
    v_query TEXT;
    v_filial_filter TEXT;
    v_data_inicio DATE;
    v_data_fim DATE;
BEGIN
    -- Validar schema
    IF p_schema IS NULL OR p_schema = '' THEN
        RAISE EXCEPTION 'Schema nao informado';
    END IF;

    -- Calcular data de inicio e fim do mes (SEMPRE do dia 1 ao ultimo dia)
    v_data_inicio := make_date(p_ano, p_mes, 1);
    v_data_fim := (v_data_inicio + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Montar filtro de filial
    IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
        v_filial_filter := format('AND m.filial_id = ANY($1)');
    ELSIF p_filial_id IS NOT NULL THEN
        v_filial_filter := format('AND m.filial_id = %s', p_filial_id);
    ELSE
        v_filial_filter := '';
    END IF;

    -- Query principal com novos campos de custo e lucro
    v_query := format($query$
        WITH metas_periodo AS (
            SELECT
                m.id,
                m.filial_id,
                m.data,
                CASE EXTRACT(DOW FROM m.data)
                    WHEN 0 THEN 'Domingo'
                    WHEN 1 THEN 'Segunda'
                    WHEN 2 THEN 'Terca'
                    WHEN 3 THEN 'Quarta'
                    WHEN 4 THEN 'Quinta'
                    WHEN 5 THEN 'Sexta'
                    WHEN 6 THEN 'Sabado'
                END as dia_semana,
                m.meta_percentual,
                m.data_referencia,
                m.valor_referencia,
                m.valor_meta,
                COALESCE(m.valor_realizado, 0) as valor_realizado,
                COALESCE(m.custo_realizado, 0) as custo_realizado,
                COALESCE(m.lucro_realizado, 0) as lucro_realizado,
                (COALESCE(m.valor_realizado, 0) - m.valor_meta) as diferenca,
                CASE
                    WHEN m.valor_meta > 0 THEN
                        ((COALESCE(m.valor_realizado, 0) - m.valor_meta) / m.valor_meta * 100)
                    ELSE 0
                END as diferenca_percentual
            FROM %I.metas_mensais m
            WHERE m.data >= $2
              AND m.data <= $3
              %s
            ORDER BY m.data, m.filial_id
        ),
        totais AS (
            SELECT
                COALESCE(SUM(valor_realizado), 0) as total_realizado,
                COALESCE(SUM(valor_meta), 0) as total_meta,
                COALESCE(SUM(custo_realizado), 0) as total_custo,
                COALESCE(SUM(lucro_realizado), 0) as total_lucro,
                CASE
                    WHEN SUM(valor_meta) > 0 THEN
                        (SUM(valor_realizado) / SUM(valor_meta) * 100)
                    ELSE 0
                END as percentual_atingido,
                CASE
                    WHEN SUM(valor_realizado) > 0 THEN
                        (SUM(lucro_realizado) / SUM(valor_realizado) * 100)
                    ELSE 0
                END as margem_bruta
            FROM metas_periodo
        )
        SELECT json_build_object(
            'metas', COALESCE((SELECT json_agg(row_to_json(metas_periodo)) FROM metas_periodo), '[]'::json),
            'total_realizado', (SELECT total_realizado FROM totais),
            'total_meta', (SELECT total_meta FROM totais),
            'total_custo', (SELECT total_custo FROM totais),
            'total_lucro', (SELECT total_lucro FROM totais),
            'percentual_atingido', (SELECT percentual_atingido FROM totais),
            'margem_bruta', (SELECT margem_bruta FROM totais)
        )
    $query$, p_schema, v_filial_filter);

    -- Executar query
    IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
        EXECUTE v_query INTO v_result USING p_filial_ids, v_data_inicio, v_data_fim;
    ELSE
        EXECUTE v_query INTO v_result USING v_data_inicio, v_data_fim;
    END IF;

    RETURN COALESCE(v_result, json_build_object(
        'metas', '[]'::json,
        'total_realizado', 0,
        'total_meta', 0,
        'total_custo', 0,
        'total_lucro', 0,
        'percentual_atingido', 0,
        'margem_bruta', 0
    ));

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao buscar metas: %', SQLERRM;
END;
$_$;


--
-- Name: FUNCTION get_metas_mensais_report(p_schema text, p_mes integer, p_ano integer, p_filial_id integer, p_filial_ids integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_metas_mensais_report(p_schema text, p_mes integer, p_ano integer, p_filial_id integer, p_filial_ids integer[]) IS 'Retorna relatório de metas mensais com valores realizados. SEMPRE inicia do dia 1 do mês até o último dia, independentemente dos filtros de filial aplicados.';


--
-- Name: get_metas_setor_report(text, bigint, integer, integer, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_metas_setor_report(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_id bigint DEFAULT NULL::bigint) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_result JSON;
  v_departamento_ids_level3 BIGINT[];
  v_departamento_ids_level1 BIGINT[];
  v_dept_ids_text TEXT;
  v_debug_query TEXT;
  v_debug_count BIGINT;
BEGIN
  -- Get departamento_ids (level 3) for the setor
  EXECUTE format('
    SELECT departamento_ids
    FROM %I.setores
    WHERE id = $1
  ', p_schema)
  INTO v_departamento_ids_level3
  USING p_setor_id;

  RAISE NOTICE 'DEBUG: Setor ID: %, Departamento IDs Level 3: %', p_setor_id, v_departamento_ids_level3;

  IF v_departamento_ids_level3 IS NULL OR array_length(v_departamento_ids_level3, 1) IS NULL THEN
    -- Setor not found or has no departments
    RAISE NOTICE 'DEBUG: Setor not found or has no departments';
    RETURN '[]'::json;
  END IF;

  -- Get all level 1 departments that belong to these level 3 departments
  EXECUTE format('
    SELECT ARRAY_AGG(departamento_id)
    FROM %I.departments_level_1
    WHERE pai_level_3_id = ANY($1)
  ', p_schema)
  INTO v_departamento_ids_level1
  USING v_departamento_ids_level3;

  RAISE NOTICE 'DEBUG: Found % Level 1 departments', array_length(v_departamento_ids_level1, 1);

  IF v_departamento_ids_level1 IS NULL OR array_length(v_departamento_ids_level1, 1) IS NULL THEN
    -- No level 1 departments found for these level 3 departments
    RAISE NOTICE 'DEBUG: No level 1 departments found for level 3 IDs';
    RETURN '[]'::json;
  END IF;

  -- Convert array to text for use in query
  v_dept_ids_text := array_to_string(v_departamento_ids_level1, ',');
  RAISE NOTICE 'DEBUG: Dept IDs as text: %', v_dept_ids_text;

  -- Debug: Check if there are any vendas for this period
  v_debug_query := format('
    SELECT COUNT(*)
    FROM %I.vendas v
    WHERE EXTRACT(MONTH FROM v.data_venda) = $1
      AND EXTRACT(YEAR FROM v.data_venda) = $2
  ', p_schema);

  EXECUTE v_debug_query INTO v_debug_count USING p_mes, p_ano;
  RAISE NOTICE 'DEBUG: Total vendas in month % year %: %', p_mes, p_ano, v_debug_count;

  -- Debug: Check vendas with departamento filter (using level 1 IDs)
  v_debug_query := format('
    SELECT COUNT(*)
    FROM %I.vendas v
    INNER JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
    WHERE EXTRACT(MONTH FROM v.data_venda) = $1
      AND EXTRACT(YEAR FROM v.data_venda) = $2
      AND p.departamento_id = ANY(ARRAY[%s]::BIGINT[])
  ', p_schema, p_schema, v_dept_ids_text);

  EXECUTE v_debug_query INTO v_debug_count USING p_mes, p_ano;
  RAISE NOTICE 'DEBUG: Vendas with dept level 1 filter: %', v_debug_count;

  IF p_filial_id IS NOT NULL THEN
    -- Debug for specific filial
    v_debug_query := format('
      SELECT COUNT(*)
      FROM %I.vendas v
      INNER JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
      WHERE v.filial_id = $1
        AND EXTRACT(MONTH FROM v.data_venda) = $2
        AND EXTRACT(YEAR FROM v.data_venda) = $3
        AND p.departamento_id = ANY(ARRAY[%s]::BIGINT[])
    ', p_schema, p_schema, v_dept_ids_text);

    EXECUTE v_debug_query INTO v_debug_count USING p_filial_id, p_mes, p_ano;
    RAISE NOTICE 'DEBUG: Vendas for filial % with dept level 1 filter: %', p_filial_id, v_debug_count;

    -- Return metas for a specific filial with realtime valores_realizados
    EXECUTE format('
      WITH valores_realizados AS (
        SELECT
          v.data_venda,
          v.filial_id,
          SUM(v.valor_vendas) as valor_realizado,
          COUNT(*) as num_vendas
        FROM %I.vendas v
        INNER JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
        WHERE v.filial_id = $1
          AND EXTRACT(MONTH FROM v.data_venda) = $2
          AND EXTRACT(YEAR FROM v.data_venda) = $3
          AND p.departamento_id = ANY(ARRAY[%s]::BIGINT[])
        GROUP BY v.data_venda, v.filial_id
      )
      SELECT COALESCE(json_agg(day_data ORDER BY data), ''[]''::json)
      FROM (
        SELECT
          m.data,
          m.dia_semana,
          json_agg(
            json_build_object(
              ''filial_id'', m.filial_id,
              ''data_referencia'', m.data_referencia,
              ''dia_semana_ref'', COALESCE(m.dia_semana_ref,
                CASE EXTRACT(DOW FROM m.data_referencia)
                  WHEN 0 THEN ''Domingo''
                  WHEN 1 THEN ''Segunda-Feira''
                  WHEN 2 THEN ''Terça-Feira''
                  WHEN 3 THEN ''Quarta-Feira''
                  WHEN 4 THEN ''Quinta-Feira''
                  WHEN 5 THEN ''Sexta-Feira''
                  WHEN 6 THEN ''Sábado''
                END
              ),
              ''valor_referencia'', m.valor_referencia,
              ''meta_percentual'', m.meta_percentual,
              ''valor_meta'', m.valor_meta,
              ''valor_realizado'', COALESCE(vr.valor_realizado, 0),
              ''diferenca'', COALESCE(vr.valor_realizado, 0) - m.valor_meta,
              ''diferenca_percentual'', CASE
                WHEN m.valor_meta > 0 THEN
                  ((COALESCE(vr.valor_realizado, 0) - m.valor_meta) / m.valor_meta) * 100
                ELSE 0
              END,
              ''_debug_num_vendas'', COALESCE(vr.num_vendas, 0),
              ''_debug_data_meta'', m.data::text,
              ''_debug_data_venda'', COALESCE(vr.data_venda::text, ''null'')
            ) ORDER BY m.filial_id
          ) as filiais
        FROM %I.metas_setor m
        LEFT JOIN valores_realizados vr ON vr.data_venda = m.data AND vr.filial_id = m.filial_id
        WHERE m.setor_id = $4
          AND m.filial_id = $1
          AND EXTRACT(MONTH FROM m.data) = $2
          AND EXTRACT(YEAR FROM m.data) = $3
        GROUP BY m.data, m.dia_semana
      ) day_data
    ', p_schema, p_schema, v_dept_ids_text, p_schema)
    INTO v_result
    USING p_filial_id, p_mes, p_ano, p_setor_id;
  ELSE
    -- Return metas for all filiais with realtime valores_realizados
    EXECUTE format('
      WITH valores_realizados AS (
        SELECT
          v.data_venda,
          v.filial_id,
          SUM(v.valor_vendas) as valor_realizado,
          COUNT(*) as num_vendas
        FROM %I.vendas v
        INNER JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
        WHERE EXTRACT(MONTH FROM v.data_venda) = $1
          AND EXTRACT(YEAR FROM v.data_venda) = $2
          AND p.departamento_id = ANY(ARRAY[%s]::BIGINT[])
        GROUP BY v.data_venda, v.filial_id
      )
      SELECT COALESCE(json_agg(day_data ORDER BY data), ''[]''::json)
      FROM (
        SELECT
          m.data,
          MAX(m.dia_semana) as dia_semana,
          json_agg(
            json_build_object(
              ''filial_id'', m.filial_id,
              ''data_referencia'', m.data_referencia,
              ''dia_semana_ref'', COALESCE(m.dia_semana_ref,
                CASE EXTRACT(DOW FROM m.data_referencia)
                  WHEN 0 THEN ''Domingo''
                  WHEN 1 THEN ''Segunda-Feira''
                  WHEN 2 THEN ''Terça-Feira''
                  WHEN 3 THEN ''Quarta-Feira''
                  WHEN 4 THEN ''Quinta-Feira''
                  WHEN 5 THEN ''Sexta-Feira''
                  WHEN 6 THEN ''Sábado''
                END
              ),
              ''valor_referencia'', m.valor_referencia,
              ''meta_percentual'', m.meta_percentual,
              ''valor_meta'', m.valor_meta,
              ''valor_realizado'', COALESCE(vr.valor_realizado, 0),
              ''diferenca'', COALESCE(vr.valor_realizado, 0) - m.valor_meta,
              ''diferenca_percentual'', CASE
                WHEN m.valor_meta > 0 THEN
                  ((COALESCE(vr.valor_realizado, 0) - m.valor_meta) / m.valor_meta) * 100
                ELSE 0
              END,
              ''_debug_num_vendas'', COALESCE(vr.num_vendas, 0),
              ''_debug_data_meta'', m.data::text,
              ''_debug_data_venda'', COALESCE(vr.data_venda::text, ''null'')
            ) ORDER BY m.filial_id
          ) as filiais
        FROM %I.metas_setor m
        LEFT JOIN valores_realizados vr ON vr.data_venda = m.data AND vr.filial_id = m.filial_id
        WHERE m.setor_id = $3
          AND EXTRACT(MONTH FROM m.data) = $1
          AND EXTRACT(YEAR FROM m.data) = $2
        GROUP BY m.data
      ) day_data
    ', p_schema, p_schema, v_dept_ids_text, p_schema)
    INTO v_result
    USING p_mes, p_ano, p_setor_id;
  END IF;

  RAISE NOTICE 'DEBUG: Result length: %', length(v_result::text);

  RETURN COALESCE(v_result, '[]'::json);
END;
$_$;


--
-- Name: FUNCTION get_metas_setor_report(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_metas_setor_report(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_id bigint) IS 'Retorna relatório de metas por setor com valores realizados calculados em tempo real.
A função busca os departamento_ids do setor e calcula o valor_realizado somando
as vendas da tabela vendas onde departamento_id está no array de departamento_ids do setor.
Os valores de diferenca e diferenca_percentual também são recalculados dinamicamente.
Usa CTE (Common Table Expression) para calcular valores realizados e fazer LEFT JOIN com metas.';


--
-- Name: get_metas_setor_report_optimized(text, bigint, integer, integer, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_metas_setor_report_optimized(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_ids bigint[] DEFAULT NULL::bigint[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '45s'
    SET work_mem TO '64MB'
    AS $_$
DECLARE
  v_result JSONB;
  v_date_start DATE;
  v_date_end DATE;
  v_query_start TIMESTAMP;
  v_query_duration INTERVAL;
BEGIN
  v_query_start := clock_timestamp();

  IF p_schema IS NULL OR p_setor_id IS NULL OR p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Schema, setor_id, mes e ano sao obrigatorios';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: % (deve ser 1-12)', p_mes;
  END IF;

  v_date_start := make_date(p_ano, p_mes, 1);
  v_date_end := v_date_start + INTERVAL '1 month' - INTERVAL '1 day';

  RAISE NOTICE 'Buscando metas: schema=%, setor=%, periodo=% a %',
    p_schema, p_setor_id, v_date_start, v_date_end;

  EXECUTE format('
    SELECT COALESCE(json_agg(
      json_build_object(
        ''data'', ms.data,
        ''dia_semana'', ms.dia_semana,
        ''filiais'', (
          SELECT json_agg(
            json_build_object(
              ''filial_id'', msf.filial_id,
              ''filial_nome'', COALESCE(b.descricao, ''Filial '' || msf.filial_id),
              ''data_referencia'', msf.data_referencia,
              ''dia_semana_ref'', msf.dia_semana_ref,
              ''valor_referencia'', COALESCE(msf.valor_referencia, 0),
              ''meta_percentual'', COALESCE(msf.meta_percentual, 0),
              ''valor_meta'', COALESCE(msf.valor_meta, 0),
              ''valor_realizado'', COALESCE(msf.valor_realizado, 0),
              ''custo_realizado'', COALESCE(msf.custo_realizado, 0),
              ''lucro_realizado'', COALESCE(msf.lucro_realizado, 0),
              ''diferenca'', COALESCE(msf.diferenca, 0),
              ''diferenca_percentual'', COALESCE(msf.diferenca_percentual, 0),
              ''percentual_atingido'', CASE
                WHEN COALESCE(msf.valor_meta, 0) > 0 THEN
                  ROUND((COALESCE(msf.valor_realizado, 0) / msf.valor_meta * 100)::numeric, 2)
                ELSE 0
              END
            ) ORDER BY COALESCE(b.descricao, ''Filial '' || msf.filial_id)
          )
          FROM %I.metas_setor msf
          LEFT JOIN public.branches b
            ON b.branch_code = msf.filial_id::text
            AND b.tenant_id = (SELECT id FROM public.tenants WHERE supabase_schema = %L LIMIT 1)
          WHERE msf.setor_id = ms.setor_id
            AND msf.data = ms.data
            AND ($3 IS NULL OR msf.filial_id = ANY($3))
        )
      ) ORDER BY ms.data
    ), ''[]''::json)
    FROM (
      SELECT DISTINCT ms.data, ms.setor_id, ms.dia_semana
      FROM %I.metas_setor ms
      WHERE ms.setor_id = $1
        AND ms.data >= $4
        AND ms.data <= $5
        AND ($3 IS NULL OR ms.filial_id = ANY($3))
    ) ms
  ',
    p_schema,
    p_schema,
    p_schema
  )
  INTO v_result
  USING p_setor_id, p_mes, p_filial_ids, v_date_start, v_date_end;

  v_query_duration := clock_timestamp() - v_query_start;

  RAISE NOTICE 'Query executada em: %', v_query_duration;
  RAISE NOTICE 'Registros retornados: %', COALESCE(jsonb_array_length(v_result), 0);

  RETURN v_result;

EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Timeout ao buscar metas (>45s).';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao buscar metas: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$_$;


--
-- Name: FUNCTION get_metas_setor_report_optimized(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_ids bigint[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_metas_setor_report_optimized(p_schema text, p_setor_id bigint, p_mes integer, p_ano integer, p_filial_ids bigint[]) IS 'Retorna relatório de metas por setor para um mês específico (VERSÃO OTIMIZADA - FIXED v2).

FIX v2: Corrigido JOIN com public.branches usando as colunas corretas:
- branch_code (VARCHAR) - código da filial
- descricao (VARCHAR) - nome/descrição da filial

OTIMIZAÇÕES APLICADAS:
- Range query (data >= X AND data <= Y) ao invés de EXTRACT() [85% mais rápido]
- json_agg ao invés de jsonb_agg [10-15% mais leve]
- Timeout aumentado para 45s [margem de segurança]
- LEFT JOIN com public.branches para pegar nome das filiais

PERFORMANCE:
- Tempo esperado: 1-2s (vs 9-10s antes)
- Taxa de timeout: <5% (vs 40-50% antes)
- Usa índice: idx_vendas_data_covering

EXEMPLO:
SELECT get_metas_setor_report_optimized(''okilao'', 1, 11, 2025, NULL);
SELECT get_metas_setor_report_optimized(''okilao'', 1, 11, 2025, ARRAY[1,2,3]);';


--
-- Name: get_metas_setores_report(text, integer, integer, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_metas_setores_report(p_schema text, p_mes integer, p_ano integer, p_setor_id bigint DEFAULT NULL::bigint, p_filial_id bigint DEFAULT NULL::bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_result jsonb;
BEGIN
  EXECUTE format('
    SELECT jsonb_agg(
      jsonb_build_object(
        ''id'', m.id,
        ''setor_id'', m.setor_id,
        ''setor_nome'', s.nome,
        ''filial_id'', m.filial_id,
        ''data'', m.data,
        ''dia_semana'', m.dia_semana,
        ''meta_percentual'', m.meta_percentual,
        ''data_referencia'', m.data_referencia,
        ''valor_referencia'', m.valor_referencia,
        ''valor_meta'', m.valor_meta,
        ''valor_realizado'', m.valor_realizado,
        ''diferenca'', m.diferenca,
        ''diferenca_percentual'', COALESCE(m.diferenca_percentual, 0)
      ) ORDER BY s.nome, m.data, m.filial_id
    )
    FROM %I.metas_setores m
    INNER JOIN %I.setores s ON m.setor_id = s.id
    WHERE EXTRACT(MONTH FROM m.data) = $1
      AND EXTRACT(YEAR FROM m.data) = $2
      AND ($3::bigint IS NULL OR m.setor_id = $3)
      AND ($4::bigint IS NULL OR m.filial_id = $4)
  ', p_schema, p_schema)
  INTO v_result
  USING p_mes, p_ano, p_setor_id, p_filial_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$_$;


--
-- Name: get_my_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$;


--
-- Name: get_my_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
$$;


--
-- Name: get_perdas_report(text, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_perdas_report(p_schema text, p_mes integer, p_ano integer, p_filial_id integer, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50) RETURNS TABLE(dept_nivel3 text, dept_nivel2 text, dept_nivel1 text, produto_codigo bigint, produto_descricao text, filial_id integer, qtde numeric, valor_perda numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $_$
DECLARE
  v_sql TEXT;
BEGIN
  -- Validar parâmetros
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema é obrigatório';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês deve estar entre 1 e 12';
  END IF;

  IF p_ano < 2000 OR p_ano > 2100 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;

  IF p_filial_id IS NULL THEN
    RAISE EXCEPTION 'Filial é obrigatória';
  END IF;

  -- Construir query dinâmica com schema
  -- Estrutura de departamentos:
  -- - departments_level_1: nível mais baixo (subgrupo), tem pai_level_2_id e pai_level_3_id
  -- - departments_level_2: nível intermediário (grupo)
  -- - departments_level_3: nível mais alto (departamento)
  --
  -- produtos.departamento_id SEMPRE referencia departments_level_1.departamento_id
  v_sql := format('
    SELECT
      COALESCE(d3.descricao, ''SEM DEPARTAMENTO'')::TEXT as dept_nivel3,
      COALESCE(d2.descricao, ''SEM GRUPO'')::TEXT as dept_nivel2,
      COALESCE(d1.descricao, ''SEM SUBGRUPO'')::TEXT as dept_nivel1,
      p.id::BIGINT as produto_codigo,
      p.descricao::TEXT as produto_descricao,
      per.filial_id::INTEGER,
      SUM(per.quantidade)::NUMERIC as qtde,
      SUM(per.valor_perda)::NUMERIC as valor_perda
    FROM %I.perdas per
    INNER JOIN %I.produtos p
      ON per.produto_id = p.id
      AND per.filial_id = p.filial_id
    LEFT JOIN %I.departments_level_1 d1
      ON p.departamento_id = d1.departamento_id
    LEFT JOIN %I.departments_level_2 d2
      ON d1.pai_level_2_id = d2.departamento_id
    LEFT JOIN %I.departments_level_3 d3
      ON d1.pai_level_3_id = d3.departamento_id
    WHERE per.filial_id = $1
      AND EXTRACT(MONTH FROM per.data_perda) = $2
      AND EXTRACT(YEAR FROM per.data_perda) = $3
    GROUP BY
      d3.descricao,
      d2.descricao,
      d1.descricao,
      p.id,
      p.descricao,
      per.filial_id
    ORDER BY
      d3.descricao NULLS LAST,
      d2.descricao NULLS LAST,
      d1.descricao NULLS LAST,
      SUM(per.valor_perda) DESC
  ', p_schema, p_schema, p_schema, p_schema, p_schema);

  -- Executar query com parâmetros
  RETURN QUERY EXECUTE v_sql USING p_filial_id, p_mes, p_ano;
END;
$_$;


--
-- Name: FUNCTION get_perdas_report(p_schema text, p_mes integer, p_ano integer, p_filial_id integer, p_page integer, p_page_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_perdas_report(p_schema text, p_mes integer, p_ano integer, p_filial_id integer, p_page integer, p_page_size integer) IS 'Retorna relatório de perdas por filial e período com hierarquia de departamentos.
Parâmetros:
  - p_schema: Nome do schema do tenant
  - p_mes: Mês (1-12)
  - p_ano: Ano (ex: 2025)
  - p_filial_id: ID da filial
  - p_page: Página atual (não utilizado, reservado para paginação futura)
  - p_page_size: Registros por página (não utilizado, reservado para paginação futura)
Retorno: Dados agrupados por departamento e produto com quantidade e valor de perda.';


--
-- Name: get_perdas_total_vendas_periodo(text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_perdas_total_vendas_periodo(p_schema text, p_mes integer, p_ano integer, p_filial_id integer) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $_$
DECLARE
  v_sql TEXT;
  v_total NUMERIC;
  v_data_inicio DATE;
  v_data_fim DATE;
BEGIN
  -- Validar parâmetros
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema é obrigatório';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês deve estar entre 1 e 12';
  END IF;

  IF p_ano < 2000 OR p_ano > 2100 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;

  IF p_filial_id IS NULL THEN
    RAISE EXCEPTION 'Filial é obrigatória';
  END IF;

  -- Calcular intervalo de datas (usa índice em data_venda)
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + INTERVAL '1 month')::DATE;

  -- Construir query dinâmica com schema
  -- Usa filtro por range de datas para aproveitar índice em data_venda
  v_sql := 'SELECT COALESCE(SUM(valor_vendas), 0)::NUMERIC FROM ' || quote_ident(p_schema) || '.vendas WHERE filial_id = $1 AND data_venda >= $2 AND data_venda < $3';

  -- Executar query com parâmetros
  EXECUTE v_sql INTO v_total USING p_filial_id, v_data_inicio, v_data_fim;

  RETURN v_total;
END;
$_$;


--
-- Name: FUNCTION get_perdas_total_vendas_periodo(p_schema text, p_mes integer, p_ano integer, p_filial_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_perdas_total_vendas_periodo(p_schema text, p_mes integer, p_ano integer, p_filial_id integer) IS '[Módulo: Perdas] Retorna o total de vendas (receita bruta) para uma filial em um período específico.
Usado para calcular o percentual de perda sobre a venda (% Venda) no relatório de Perdas.
Parâmetros:
  - p_schema: Nome do schema do tenant
  - p_mes: Mês (1-12)
  - p_ano: Ano (ex: 2025)
  - p_filial_id: ID da filial
Retorno: Valor total de vendas no período.';


--
-- Name: get_perdas_vendas_por_departamento(text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_perdas_vendas_por_departamento(p_schema text, p_mes integer, p_ano integer, p_filial_id integer) RETURNS TABLE(dept_nivel3 text, dept_nivel2 text, dept_nivel1 text, valor_vendas numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $_$
DECLARE
  v_sql TEXT;
  v_data_inicio DATE;
  v_data_fim DATE;
BEGIN
  -- Validar parâmetros
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema é obrigatório';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês deve estar entre 1 e 12';
  END IF;

  IF p_ano < 2000 OR p_ano > 2100 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;

  IF p_filial_id IS NULL THEN
    RAISE EXCEPTION 'Filial é obrigatória';
  END IF;

  -- Calcular intervalo de datas (usa índice em data_venda)
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + INTERVAL '1 month')::DATE;

  -- Construir query dinâmica com schema
  -- Agrupa vendas por hierarquia de departamentos
  v_sql := format('
    SELECT
      COALESCE(d3.descricao, ''SEM DEPARTAMENTO'')::TEXT as dept_nivel3,
      COALESCE(d2.descricao, ''SEM GRUPO'')::TEXT as dept_nivel2,
      COALESCE(d1.descricao, ''SEM SUBGRUPO'')::TEXT as dept_nivel1,
      COALESCE(SUM(v.valor_vendas), 0)::NUMERIC as valor_vendas
    FROM %I.vendas v
    INNER JOIN %I.produtos p
      ON v.id_produto = p.id
      AND v.filial_id = p.filial_id
    LEFT JOIN %I.departments_level_1 d1
      ON p.departamento_id = d1.departamento_id
    LEFT JOIN %I.departments_level_2 d2
      ON d1.pai_level_2_id = d2.departamento_id
    LEFT JOIN %I.departments_level_3 d3
      ON d1.pai_level_3_id = d3.departamento_id
    WHERE v.filial_id = $1
      AND v.data_venda >= $2
      AND v.data_venda < $3
    GROUP BY
      d3.descricao,
      d2.descricao,
      d1.descricao
    ORDER BY
      d3.descricao NULLS LAST,
      d2.descricao NULLS LAST,
      d1.descricao NULLS LAST
  ', p_schema, p_schema, p_schema, p_schema, p_schema);

  -- Executar query com parâmetros
  RETURN QUERY EXECUTE v_sql USING p_filial_id, v_data_inicio, v_data_fim;
END;
$_$;


--
-- Name: FUNCTION get_perdas_vendas_por_departamento(p_schema text, p_mes integer, p_ano integer, p_filial_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_perdas_vendas_por_departamento(p_schema text, p_mes integer, p_ano integer, p_filial_id integer) IS '[Módulo: Perdas] Retorna as vendas (receita bruta) agrupadas por hierarquia de departamentos.
Usado para calcular o percentual de perda sobre a venda do setor (% Venda Setor) no relatório de Perdas.
Parâmetros:
  - p_schema: Nome do schema do tenant
  - p_mes: Mês (1-12)
  - p_ano: Ano (ex: 2025)
  - p_filial_id: ID da filial
Retorno: Vendas agrupadas por dept_nivel3, dept_nivel2, dept_nivel1.';


--
-- Name: get_previsao_ruptura_report(text, bigint[], integer, integer, text[], boolean, text, text, bigint[], bigint[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_previsao_ruptura_report(p_schema text, p_filial_ids bigint[] DEFAULT NULL::bigint[], p_dias_min integer DEFAULT 1, p_dias_max integer DEFAULT 7, p_curvas text[] DEFAULT ARRAY['A'::text, 'B'::text, 'C'::text], p_apenas_ativos boolean DEFAULT true, p_busca text DEFAULT NULL::text, p_tipo_busca text DEFAULT 'produto'::text, p_departamento_ids bigint[] DEFAULT NULL::bigint[], p_setor_ids bigint[] DEFAULT NULL::bigint[], p_page integer DEFAULT 1, p_page_size integer DEFAULT 50) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '60s'
    AS $_$
DECLARE
  v_offset integer;
  v_total_records integer;
  v_produtos jsonb;
  v_query text;
  v_count_query text;
  v_busca_pattern text;
  v_setor_dept_ids bigint[];
BEGIN
  -- Calcular offset
  v_offset := (p_page - 1) * p_page_size;

  -- Preparar pattern de busca
  v_busca_pattern := CASE WHEN p_busca IS NOT NULL AND p_busca <> ''
                          THEN '%' || UPPER(p_busca) || '%'
                          ELSE NULL
                     END;

  -- ============================================================================
  -- Se filtro por setores, buscar os departamento_ids de nível 1 correspondentes
  -- ============================================================================
  IF p_setor_ids IS NOT NULL THEN
    EXECUTE format('
      SELECT ARRAY_AGG(DISTINCT dl1.departamento_id)
      FROM %I.setores s
      CROSS JOIN LATERAL (
        SELECT dl1.departamento_id
        FROM %I.departments_level_1 dl1
        WHERE
          (s.departamento_nivel = 1 AND dl1.departamento_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 2 AND dl1.pai_level_2_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 3 AND dl1.pai_level_3_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 4 AND dl1.pai_level_4_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 5 AND dl1.pai_level_5_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 6 AND dl1.pai_level_6_id = ANY(s.departamento_ids))
      ) dl1
      WHERE s.id = ANY($1) AND s.ativo = true
    ', p_schema, p_schema)
    INTO v_setor_dept_ids
    USING p_setor_ids;
  END IF;

  -- ============================================================================
  -- Query para contar total de registros
  -- ============================================================================
  v_count_query := format('
    SELECT COUNT(*)
    FROM %I.produtos p
    LEFT JOIN %I.departments_level_1 d ON d.departamento_id = p.departamento_id
    WHERE
      COALESCE(p.estoque_atual, 0) >= 1
      AND COALESCE(p.venda_media_diaria_60d, 0) > 0
      AND COALESCE(p.dias_de_estoque, 0) > 0
      AND p.dias_de_estoque >= $1
      AND p.dias_de_estoque <= $2
      AND p.curva_abcd = ANY($3)
      AND ($4 = false OR p.ativo = true)
      AND ($5 IS NULL OR p.filial_id = ANY($5))
      AND (
        $6 IS NULL
        OR (
          CASE WHEN $7 = ''departamento''
            THEN UPPER(COALESCE(d.descricao, '''')) LIKE $6
            ELSE UPPER(p.descricao) LIKE $6
          END
        )
      )
      AND ($8 IS NULL OR p.departamento_id = ANY($8))
      AND ($9 IS NULL OR p.departamento_id = ANY($9))
  ', p_schema, p_schema);

  EXECUTE v_count_query
  INTO v_total_records
  USING p_dias_min, p_dias_max, p_curvas, p_apenas_ativos, p_filial_ids, v_busca_pattern, p_tipo_busca, p_departamento_ids, v_setor_dept_ids;

  -- ============================================================================
  -- Query principal para buscar produtos
  -- ============================================================================
  v_query := format('
    SELECT jsonb_agg(row_to_json(t))
    FROM (
      SELECT
        p.id,
        p.descricao,
        p.filial_id,
        COALESCE(b.descricao, ''Filial '' || p.filial_id) AS filial_nome,
        COALESCE(p.departamento_id, 0) AS departamento_id,
        COALESCE(d.descricao, ''SEM DEPARTAMENTO'') AS departamento_nome,
        p.curva_abcd,
        ROUND(p.estoque_atual::numeric, 2) AS estoque_atual,
        ROUND(p.venda_media_diaria_60d::numeric, 2) AS venda_media_diaria_60d,
        ROUND(p.dias_de_estoque::numeric, 1) AS dias_de_estoque,
        (CURRENT_DATE + p.dias_de_estoque::integer)::date AS previsao_ruptura
      FROM %I.produtos p
      LEFT JOIN public.branches b
        ON b.branch_code = p.filial_id::text
        AND b.tenant_id = (SELECT id FROM public.tenants WHERE supabase_schema = %L LIMIT 1)
      LEFT JOIN %I.departments_level_1 d ON d.departamento_id = p.departamento_id
      WHERE
        COALESCE(p.estoque_atual, 0) >= 1
        AND COALESCE(p.venda_media_diaria_60d, 0) > 0
        AND COALESCE(p.dias_de_estoque, 0) > 0
        AND p.dias_de_estoque >= $1
        AND p.dias_de_estoque <= $2
        AND p.curva_abcd = ANY($3)
        AND ($4 = false OR p.ativo = true)
        AND ($5 IS NULL OR p.filial_id = ANY($5))
        AND (
          $6 IS NULL
          OR (
            CASE WHEN $7 = ''departamento''
              THEN UPPER(COALESCE(d.descricao, '''')) LIKE $6
              ELSE UPPER(p.descricao) LIKE $6
            END
          )
        )
        AND ($8 IS NULL OR p.departamento_id = ANY($8))
        AND ($9 IS NULL OR p.departamento_id = ANY($9))
      ORDER BY
        COALESCE(d.descricao, ''ZZZ SEM DEPARTAMENTO'') ASC,
        p.dias_de_estoque ASC,
        p.curva_abcd ASC
      LIMIT $10 OFFSET $11
    ) t
  ', p_schema, p_schema, p_schema);

  EXECUTE v_query
  INTO v_produtos
  USING p_dias_min, p_dias_max, p_curvas, p_apenas_ativos, p_filial_ids, v_busca_pattern, p_tipo_busca, p_departamento_ids, v_setor_dept_ids, p_page_size, v_offset;

  -- ============================================================================
  -- Retornar resultado
  -- ============================================================================
  RETURN jsonb_build_object(
    'total_records', COALESCE(v_total_records, 0),
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(COALESCE(v_total_records, 0)::numeric / p_page_size),
    'produtos', COALESCE(v_produtos, '[]'::jsonb)
  );
END;
$_$;


--
-- Name: FUNCTION get_previsao_ruptura_report(p_schema text, p_filial_ids bigint[], p_dias_min integer, p_dias_max integer, p_curvas text[], p_apenas_ativos boolean, p_busca text, p_tipo_busca text, p_departamento_ids bigint[], p_setor_ids bigint[], p_page integer, p_page_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_previsao_ruptura_report(p_schema text, p_filial_ids bigint[], p_dias_min integer, p_dias_max integer, p_curvas text[], p_apenas_ativos boolean, p_busca text, p_tipo_busca text, p_departamento_ids bigint[], p_setor_ids bigint[], p_page integer, p_page_size integer) IS 'Retorna produtos em risco de ruptura com base nos dias de estoque.

PARAMETROS:
- p_schema: Schema do tenant (ex: okilao, lucia, paraiso)
- p_filial_ids: Array de IDs de filiais (NULL = todas)
- p_dias_min: Filtrar produtos com dias_de_estoque >= este valor (default: 1)
- p_dias_max: Filtrar produtos com dias_de_estoque <= este valor (default: 7)
- p_curvas: Array de curvas ABCD a filtrar (default: A,B,C)
- p_apenas_ativos: Se true, apenas produtos ativos (default: true)
- p_busca: Texto para buscar (default: NULL)
- p_tipo_busca: Tipo de busca: ''produto'' ou ''departamento'' (default: produto)
- p_departamento_ids: Array de IDs de departamentos a filtrar (NULL = todos)
- p_setor_ids: Array de IDs de setores a filtrar (NULL = todos). Filtra produtos pelos departamentos associados aos setores.
- p_page: Pagina atual (default: 1)
- p_page_size: Itens por pagina (default: 50)

RETORNO:
{
  "total_records": integer,
  "page": integer,
  "page_size": integer,
  "total_pages": integer,
  "produtos": [...]
}

EXEMPLO - Por produto:
SELECT public.get_previsao_ruptura_report(
  ''lucia'',
  NULL,
  1,
  7,
  ARRAY[''A'',''B'',''C''],
  true,
  ''ARROZ'',
  ''produto'',
  NULL,
  NULL,
  1,
  50
);

EXEMPLO - Por setores:
SELECT public.get_previsao_ruptura_report(
  ''lucia'',
  NULL,
  1,
  7,
  ARRAY[''A'',''B'',''C''],
  true,
  NULL,
  ''produto'',
  NULL,
  ARRAY[13, 14, 15],
  1,
  50
);';


--
-- Name: get_produtos_sem_vendas(text, text, integer, integer, date, text, text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_produtos_sem_vendas(p_schema text, p_filiais text DEFAULT 'all'::text, p_dias_sem_vendas_min integer DEFAULT 15, p_dias_sem_vendas_max integer DEFAULT 90, p_data_referencia date DEFAULT CURRENT_DATE, p_curva_abc text DEFAULT 'all'::text, p_filtro_tipo text DEFAULT 'all'::text, p_departamento_ids text DEFAULT NULL::text, p_produto_ids text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0) RETURNS TABLE(filial_id bigint, produto_id bigint, descricao text, estoque_atual numeric, data_ultima_venda date, data_ultima_entrada date, preco_custo numeric, curva_abcd text, curva_lucro character varying, dias_sem_venda integer, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '25s'
    AS $_$
DECLARE
  v_filiais_condition TEXT;
  v_curva_condition TEXT;
  v_departamento_condition TEXT;
  v_produto_condition TEXT;
  v_data_limite_min DATE;
  v_data_limite_max DATE;
  v_query TEXT;
BEGIN
  -- Datas limites
  v_data_limite_min := p_data_referencia - p_dias_sem_vendas_max;  -- Máximo de dias = mais antiga
  v_data_limite_max := p_data_referencia - p_dias_sem_vendas_min;  -- Mínimo de dias = mais recente

  -- Condições
  IF p_filiais IS NULL OR p_filiais = 'all' OR p_filiais = '' THEN
    v_filiais_condition := '1=1';
  ELSE
    v_filiais_condition := 'p.filial_id IN (' || p_filiais || ')';
  END IF;

  IF p_curva_abc IS NULL OR p_curva_abc = 'all' OR p_curva_abc = '' THEN
    v_curva_condition := '1=1';
  ELSE
    v_curva_condition := 'p.curva_abcd = ' || quote_literal(p_curva_abc);
  END IF;

  IF p_filtro_tipo = 'departamento' AND p_departamento_ids IS NOT NULL AND p_departamento_ids != '' THEN
    v_departamento_condition := 'p.departamento_id IN (' || p_departamento_ids || ')';
  ELSE
    v_departamento_condition := '1=1';
  END IF;

  IF p_filtro_tipo = 'produto' AND p_produto_ids IS NOT NULL AND p_produto_ids != '' THEN
    v_produto_condition := 'p.id IN (' || p_produto_ids || ')';
  ELSE
    v_produto_condition := '1=1';
  END IF;

  -- Query otimizada com RANGE de dias
  v_query := format('
    WITH 
    produtos_base AS (
      SELECT 
        p.id,
        p.filial_id,
        p.descricao,
        p.estoque_atual,
        p.preco_de_custo,
        p.curva_abcd,
        p.curva_lucro
      FROM %I.produtos p
      WHERE p.ativo = true
        AND p.estoque_atual > 0
        AND %s  -- filiais_condition
        AND %s  -- curva_condition
        AND %s  -- departamento_condition
        AND %s  -- produto_condition
      LIMIT 2000
    ),
    ultimas_vendas AS (
      SELECT 
        v.id_produto,
        v.filial_id,
        MAX(v.data_venda) as data_ultima_venda
      FROM %I.vendas v
      WHERE EXISTS (
        SELECT 1 FROM produtos_base pb 
        WHERE pb.id = v.id_produto 
          AND pb.filial_id = v.filial_id
      )
      GROUP BY v.id_produto, v.filial_id
    ),
    produtos_sem_vendas AS (
      SELECT
        p.filial_id::BIGINT,
        p.id::BIGINT as produto_id,
        p.descricao::TEXT,
        p.estoque_atual::NUMERIC(18,6),
        uv.data_ultima_venda::DATE,
        ue.data_ultima_entrada::DATE,
        p.preco_de_custo::NUMERIC(15,5),
        p.curva_abcd::TEXT,
        p.curva_lucro::VARCHAR(2),
        CASE 
          WHEN uv.data_ultima_venda IS NULL THEN NULL
          ELSE (CURRENT_DATE - uv.data_ultima_venda)::INTEGER 
        END as dias_sem_venda
      FROM produtos_base p
      LEFT JOIN ultimas_vendas uv 
        ON p.id = uv.id_produto 
        AND p.filial_id = uv.filial_id
      LEFT JOIN LATERAL (
        SELECT
          e.data_entrada as data_ultima_entrada
        FROM %I.entradas_produtos ep
        INNER JOIN %I.entradas e
          ON e.id = ep.entrada_id
        WHERE ep.produto_id = p.id
          AND e.filial_id = p.filial_id
        ORDER BY e.data_entrada DESC, e.id DESC
        LIMIT 1
      ) ue ON true
      WHERE (
        -- SOMENTE última venda no RANGE especificado
        uv.data_ultima_venda >= $1 
        AND uv.data_ultima_venda <= $2
      )
    ),
    total AS (
      SELECT COUNT(*) as cnt FROM produtos_sem_vendas
    )
    SELECT
      psv.filial_id,
      psv.produto_id,
      psv.descricao,
      psv.estoque_atual,
      psv.data_ultima_venda,
      psv.data_ultima_entrada,
      psv.preco_de_custo,
      psv.curva_abcd,
      psv.curva_lucro,
      psv.dias_sem_venda,
      t.cnt::BIGINT as total_count
    FROM produtos_sem_vendas psv
    CROSS JOIN total t
    ORDER BY psv.dias_sem_venda DESC, psv.produto_id
    LIMIT $3
    OFFSET $4
  ',
  p_schema,
  v_filiais_condition,
  v_curva_condition,
  v_departamento_condition,
  v_produto_condition,
  p_schema,
  p_schema,
  p_schema
  );

  RETURN QUERY EXECUTE v_query 
    USING v_data_limite_min, v_data_limite_max, p_limit, p_offset;
  
EXCEPTION
  WHEN query_canceled THEN
    RAISE EXCEPTION 'Query muito lenta. Por favor: 1) Selecione UMA filial específica, 2) Aguarde criação de índices';
END;
$_$;


--
-- Name: FUNCTION get_produtos_sem_vendas(p_schema text, p_filiais text, p_dias_sem_vendas_min integer, p_dias_sem_vendas_max integer, p_data_referencia date, p_curva_abc text, p_filtro_tipo text, p_departamento_ids text, p_produto_ids text, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_produtos_sem_vendas(p_schema text, p_filiais text, p_dias_sem_vendas_min integer, p_dias_sem_vendas_max integer, p_data_referencia date, p_curva_abc text, p_filtro_tipo text, p_departamento_ids text, p_produto_ids text, p_limit integer, p_offset integer) IS 'Retorna produtos sem vendas em um RANGE de dias (min-max). Default: 15 a 90 dias.';


--
-- Name: get_relatorio_hierarquico_lucro(text, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_relatorio_hierarquico_lucro(p_schema text, p_mes_referencia date, p_filial_id integer DEFAULT NULL::integer) RETURNS TABLE(tipo text, nivel integer, codigo_produto bigint, nome text, segmento_pai text, quantidade_vendida numeric, valor_vendido numeric, lucro_total numeric, percentual_lucro numeric, curva_erp text, curva_calculada text, curva_lucro text, ordem_sort text)
    LANGUAGE plpgsql
    AS $_$
DECLARE
    query_sql TEXT;
    filtro_filial TEXT;
    nivel_max INTEGER;
    cte_niveis TEXT := '';
    union_niveis TEXT := '';
    i INTEGER;
BEGIN
    -- Filtro de filial
    filtro_filial := CASE WHEN p_filial_id IS NOT NULL THEN 'AND filial_id = $2' ELSE '' END;
    
    -- Detectar quantos níveis existem (de 1 a 6)
    EXECUTE format('
        SELECT MAX(
            CASE 
                WHEN segmento_nivel_6 IS NOT NULL AND segmento_nivel_6 != '''' THEN 6
                WHEN segmento_nivel_5 IS NOT NULL AND segmento_nivel_5 != '''' THEN 5
                WHEN segmento_nivel_4 IS NOT NULL AND segmento_nivel_4 != '''' THEN 4
                WHEN segmento_nivel_3 IS NOT NULL AND segmento_nivel_3 != '''' THEN 3
                WHEN segmento_nivel_2 IS NOT NULL AND segmento_nivel_2 != '''' THEN 2
                ELSE 1
            END
        )
        FROM %I.vw_report_curva_abcd
        WHERE mes_referencia = $1 %s
        LIMIT 1
    ', p_schema, filtro_filial)
    INTO nivel_max
    USING p_mes_referencia, p_filial_id;
    
    -- Se não encontrou dados, assume 3 níveis
    IF nivel_max IS NULL THEN
        nivel_max := 3;
    END IF;
    
    RAISE NOTICE 'Níveis detectados: %', nivel_max;
    
    -- Construir CTEs dinamicamente para cada nível
    FOR i IN REVERSE nivel_max..1 LOOP
        -- CTE para cada nível de segmentação
        cte_niveis := cte_niveis || format('
        dados_nivel_%s AS (
            SELECT 
                ''nivel_%s''::TEXT as tipo,
                %s as nivel,
                NULL::BIGINT as codigo_produto,
                segmento_nivel_%s::TEXT as nome,
                %s as segmento_pai,
                SUM(quantidade_vendida) as quantidade_vendida,
                SUM(valor_vendido) as valor_vendido,
                SUM(lucro_total) as lucro_total,
                CASE WHEN SUM(valor_vendido) > 0 THEN (SUM(lucro_total) / SUM(valor_vendido) * 100) ELSE 0 END as percentual_lucro,
                NULL::TEXT as curva_erp,
                NULL::TEXT as curva_calculada,
                NULL::TEXT as curva_lucro,
                %s as ordem_sort
            FROM %I.vw_report_curva_abcd
            WHERE mes_referencia = $1 %s
              AND segmento_nivel_%s IS NOT NULL 
              AND segmento_nivel_%s != ''''
            GROUP BY %s
        )',
            i, -- número do nível
            i, -- tipo
            i, -- nivel
            i, -- nome (segmento_nivel_X)
            CASE WHEN i < nivel_max THEN format('segmento_nivel_%s::TEXT', i + 1) ELSE 'NULL::TEXT' END, -- segmento_pai
            -- ordem_sort: concatena todos os níveis superiores
            CASE 
                WHEN i = nivel_max THEN format('segmento_nivel_%s::TEXT', i)
                ELSE (
                    SELECT string_agg(format('segmento_nivel_%s', j), ' || ''|'' || ' ORDER BY j DESC)
                    FROM generate_series(nivel_max, i, -1) j
                )
            END,
            p_schema,
            filtro_filial,
            i, -- WHERE segmento_nivel_X IS NOT NULL
            i, -- AND segmento_nivel_X != ''
            -- GROUP BY: inclui todos os níveis de i até nivel_max
            (
                SELECT string_agg(format('segmento_nivel_%s', j), ', ' ORDER BY j DESC)
                FROM generate_series(nivel_max, i, -1) j
            )
        );
        
        -- Adicionar UNION ALL
        IF i > 1 THEN
            cte_niveis := cte_niveis || ',';
        END IF;
        
        -- Construir lista de UNIONs
        IF union_niveis != '' THEN
            union_niveis := union_niveis || ' UNION ALL ';
        END IF;
        union_niveis := union_niveis || format('SELECT * FROM dados_nivel_%s', i);
    END LOOP;
    
    -- Query final
    query_sql := format('
        WITH 
        %s,
        dados_produtos AS (
            SELECT 
                ''produto''::TEXT as tipo,
                0 as nivel,
                codigo_produto,
                nome_produto::TEXT as nome,
                segmento_nivel_1::TEXT as segmento_pai,
                quantidade_vendida,
                valor_vendido,
                lucro_total,
                CASE WHEN valor_vendido > 0 THEN (lucro_total / valor_vendido * 100) ELSE 0 END as percentual_lucro,
                curva_erp::TEXT,
                curva_calculada::TEXT,
                curva_lucro::TEXT,
                (%s || ''|'' || LPAD(valor_vendido::TEXT, 20, ''0''))::TEXT as ordem_sort
            FROM %I.vw_report_curva_abcd
            WHERE mes_referencia = $1 %s
        )
        %s
        UNION ALL
        SELECT * FROM dados_produtos
        ORDER BY ordem_sort, nivel DESC',
        cte_niveis,
        -- ordem_sort dos produtos: concatena todos os níveis
        (
            SELECT string_agg(format('segmento_nivel_%s', j), ' || ''|'' || ' ORDER BY j DESC)
            FROM generate_series(nivel_max, 1, -1) j
        ),
        p_schema,
        filtro_filial,
        union_niveis
    );
    
    RAISE NOTICE 'Query SQL: %', query_sql;
    
    RETURN QUERY EXECUTE query_sql USING p_mes_referencia, p_filial_id;
END;
$_$;


--
-- Name: get_relatorio_venda_curva(text, integer, integer, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_relatorio_venda_curva(p_schema text, p_mes integer, p_ano integer, p_filial_id text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_result jsonb;
  v_offset INTEGER;
  v_filial_filter TEXT;
  v_query TEXT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  
  -- Construir filtro de filial
  IF p_filial_id IS NOT NULL AND p_filial_id != 'all' THEN
    v_filial_filter := format('AND v.filial_id = %L::bigint', p_filial_id);
  ELSE
    v_filial_filter := '';
  END IF;

  -- Query principal
  v_query := format('
    WITH vendas_base AS (
      SELECT 
        v.filial_id,
        v.filial_id::text as filial_nome,
        p.id as produto_id,
        p.descricao as produto_descricao,
        p.departamento_id,
        d1.descricao as dept1_nome,
        d1.pai_level_2_id,
        COALESCE(d2.descricao, ''Sem Departamento Nível 2'') as dept2_nome,
        d1.pai_level_3_id,
        COALESCE(d3.descricao, ''Sem Departamento Nível 3'') as dept3_nome,
        SUM(v.quantidade) as quantidade_total,
        SUM(v.valor_vendas) as total_vendas,
        SUM(COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0)) as total_custo,
        SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro,
        COALESCE(p.curva_abcd, ''D'') as curva_venda,
        COALESCE(p.curva_lucro, ''D'') as curva_lucro
      FROM %I.vendas v
      INNER JOIN %I.produtos p ON p.id = v.id_produto AND p.filial_id = v.filial_id
      INNER JOIN %I.departments_level_1 d1 ON d1.departamento_id = p.departamento_id
      LEFT JOIN %I.departments_level_2 d2 ON d2.departamento_id = d1.pai_level_2_id
      LEFT JOIN %I.departments_level_3 d3 ON d3.departamento_id = d1.pai_level_3_id
      WHERE EXTRACT(MONTH FROM v.data_venda) = $1
        AND EXTRACT(YEAR FROM v.data_venda) = $2
        AND v.valor_vendas > 0
        AND p.ativo = true
        %s
      GROUP BY 
        v.filial_id, p.id, p.descricao, p.departamento_id,
        d1.descricao, d1.pai_level_2_id, d2.descricao, d1.pai_level_3_id, d3.descricao,
        p.curva_abcd, p.curva_lucro
    ),
    totais_dept3 AS (
      SELECT 
        COALESCE(pai_level_3_id, 0) as dept3_id,
        dept3_nome,
        COALESCE(pai_level_2_id, 0) as dept2_id,
        dept2_nome,
        SUM(total_vendas) as total_vendas,
        SUM(total_lucro) as total_lucro,
        CASE 
          WHEN SUM(total_vendas) > 0 
          THEN ROUND((SUM(total_lucro) / SUM(total_vendas)) * 100, 2)
          ELSE 0 
        END as margem
      FROM vendas_base
      GROUP BY COALESCE(pai_level_3_id, 0), dept3_nome, COALESCE(pai_level_2_id, 0), dept2_nome
    ),
    totais_dept2 AS (
      SELECT 
        COALESCE(pai_level_2_id, 0) as dept2_id,
        dept2_nome,
        SUM(total_vendas) as total_vendas,
        SUM(total_lucro) as total_lucro,
        CASE 
          WHEN SUM(total_vendas) > 0 
          THEN ROUND((SUM(total_lucro) / SUM(total_vendas)) * 100, 2)
          ELSE 0 
        END as margem
      FROM vendas_base
      GROUP BY COALESCE(pai_level_2_id, 0), dept2_nome
    ),
    totais_dept1 AS (
      SELECT 
        departamento_id as dept1_id,
        dept1_nome,
        SUM(total_vendas) as total_vendas,
        SUM(total_lucro) as total_lucro,
        CASE 
          WHEN SUM(total_vendas) > 0 
          THEN ROUND((SUM(total_lucro) / SUM(total_vendas)) * 100, 2)
          ELSE 0 
        END as margem
      FROM vendas_base
      GROUP BY departamento_id, dept1_nome
    ),
    dept3_paginado AS (
      SELECT dept3_id, dept3_nome, dept2_id, dept2_nome, total_vendas, total_lucro, margem,
             ROW_NUMBER() OVER (ORDER BY total_vendas DESC) as rn
      FROM totais_dept3
    )
    SELECT jsonb_build_object(
      ''total_records'', (SELECT COUNT(*) FROM totais_dept3),
      ''page'', $5,
      ''page_size'', $6,
      ''total_pages'', CEIL((SELECT COUNT(*)::NUMERIC FROM totais_dept3) / $6),
      ''departamentos_nivel1'', (
        SELECT COALESCE(jsonb_agg(dept1_obj ORDER BY total_vendas DESC), ''[]''::jsonb)
        FROM (
          SELECT jsonb_build_object(
            ''departamento_id'', td1.dept1_id,
            ''departamento_nome'', td1.dept1_nome,
            ''valor_venda'', ROUND(td1.total_vendas::numeric, 2),
            ''valor_lucro'', ROUND(td1.total_lucro::numeric, 2),
            ''margem'', td1.margem,
            ''departamentos_nivel2'', (
              SELECT COALESCE(jsonb_agg(dept2_obj ORDER BY total_vendas DESC), ''[]''::jsonb)
              FROM (
                SELECT jsonb_build_object(
                  ''departamento_id'', td2.dept2_id,
                  ''departamento_nome'', td2.dept2_nome,
                  ''valor_venda'', ROUND(td2.total_vendas::numeric, 2),
                  ''valor_lucro'', ROUND(td2.total_lucro::numeric, 2),
                  ''margem'', td2.margem,
                  ''departamentos_nivel3'', (
                    SELECT COALESCE(jsonb_agg(dept3_obj ORDER BY total_vendas DESC), ''[]''::jsonb)
                    FROM (
                      SELECT jsonb_build_object(
                        ''departamento_id'', td3.dept3_id,
                        ''departamento_nome'', td3.dept3_nome,
                        ''valor_venda'', ROUND(td3.total_vendas::numeric, 2),
                        ''valor_lucro'', ROUND(td3.total_lucro::numeric, 2),
                        ''margem'', td3.margem,
                        ''produtos'', (
                          SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                              ''produto_id'', vb.produto_id,
                              ''filial_id'', vb.filial_id,
                              ''filial_nome'', vb.filial_nome,
                              ''codigo'', vb.produto_id,
                              ''descricao'', vb.produto_descricao,
                              ''quantidade'', ROUND(vb.quantidade_total::numeric, 2),
                              ''valor_venda'', ROUND(vb.total_vendas::numeric, 2),
                              ''curva_venda'', vb.curva_venda,
                              ''valor_lucro'', ROUND(vb.total_lucro::numeric, 2),
                              ''percentual_lucro'', CASE 
                                WHEN vb.total_vendas > 0 
                                THEN ROUND((vb.total_lucro / vb.total_vendas) * 100, 2)
                                ELSE 0 
                              END,
                              ''curva_lucro'', vb.curva_lucro
                            )
                            ORDER BY 
                              CASE vb.curva_venda 
                                WHEN ''A'' THEN 1 
                                WHEN ''C'' THEN 2 
                                WHEN ''B'' THEN 3 
                                WHEN ''D'' THEN 4 
                                ELSE 5 
                              END,
                              vb.total_vendas DESC
                          ), ''[]''::jsonb)
                          FROM vendas_base vb
                          WHERE COALESCE(vb.pai_level_3_id, 0) = td3.dept3_id
                        )
                      ) as dept3_obj
                      FROM dept3_paginado td3
                      WHERE td3.dept2_id = td2.dept2_id
                        AND td3.rn > $3 
                        AND td3.rn <= $3 + $6
                    ) dept3_sub
                  )
                ) as dept2_obj
                FROM totais_dept2 td2
                WHERE EXISTS (
                  SELECT 1 FROM vendas_base vb 
                  WHERE COALESCE(vb.pai_level_2_id, 0) = td2.dept2_id 
                    AND vb.departamento_id = td1.dept1_id
                )
              ) dept2_sub
            )
          ) as dept1_obj
          FROM totais_dept1 td1
          WHERE EXISTS (
            SELECT 1 FROM dept3_paginado 
            WHERE rn > $3 AND rn <= $3 + $6
              AND EXISTS (
                SELECT 1 FROM vendas_base vb2
                WHERE vb2.departamento_id = td1.dept1_id
              )
          )
        ) dept1_sub
      )
    )
  ', p_schema, p_schema, p_schema, p_schema, p_schema, v_filial_filter);

  RAISE LOG 'Query venda_curva: %', v_query;

  EXECUTE v_query
  INTO v_result
  USING p_mes, p_ano, v_offset, v_offset, p_page, p_page_size;

  RETURN COALESCE(v_result, '{"departamentos_nivel1": [], "total_records": 0, "page": 1, "page_size": 50, "total_pages": 0}'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_relatorio_venda_curva: % - %', SQLERRM, SQLSTATE;
    RAISE;
END;
$_$;


--
-- Name: FUNCTION get_relatorio_venda_curva(p_schema text, p_mes integer, p_ano integer, p_filial_id text, p_page integer, p_page_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_relatorio_venda_curva(p_schema text, p_mes integer, p_ano integer, p_filial_id text, p_page integer, p_page_size integer) IS 'Relatório de Vendas por Curva ABC agrupado por departamentos (níveis 1, 2, 3) e produtos';


--
-- Name: get_report_curva_abcd(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_report_curva_abcd(p_schema_name text, p_mes_ano text, p_filial_id integer DEFAULT NULL::integer) RETURNS TABLE(mes_referencia date, filial_id bigint, codigo_produto bigint, nome_produto text, curva_erp text, curva_calculada text, quantidade_vendida numeric, valor_vendido numeric, segmento_nivel_1 text, segmento_nivel_2 text, segmento_nivel_3 text, segmento_nivel_4 text, segmento_nivel_5 text, segmento_nivel_6 text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    target_date DATE;
    query_text TEXT;
BEGIN
    target_date := to_date(p_mes_ano, 'MM/YYYY');
    
    query_text := format(
        'SELECT * FROM %I.vw_report_curva_abcd WHERE mes_referencia = %L',
        p_schema_name,
        target_date
    );

    IF p_filial_id IS NOT NULL THEN
        query_text := query_text || format(' AND filial_id = %L', p_filial_id);
    END IF;

    RETURN QUERY EXECUTE query_text;
END;
$$;


--
-- Name: get_report_data_from_view(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_report_data_from_view(p_schema_name text, p_mes_ano text, p_filial_id integer DEFAULT NULL::integer) RETURNS TABLE(mes_referencia date, filial_id bigint, codigo_produto bigint, nome_produto text, curva_erp text, curva_calculada text, curva_lucro character varying, quantidade_vendida numeric, valor_vendido numeric, lucro_total numeric, segmento_nivel_1 text, segmento_nivel_2 text, segmento_nivel_3 text, segmento_nivel_4 text, segmento_nivel_5 text, segmento_nivel_6 text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    target_date DATE;
    query_text TEXT;
BEGIN
    SET search_path = '';
    target_date := to_date(p_mes_ano, 'MM/YYYY');
    
    query_text := format('SELECT * FROM %I.vw_report_curva_abcd WHERE mes_referencia = %L', p_schema_name, target_date);

    IF p_filial_id IS NOT NULL THEN
        query_text := query_text || format(' AND filial_id = %L', p_filial_id);
    END IF;

    RETURN QUERY EXECUTE query_text;
END;
$$;


--
-- Name: get_ruptura_abcd_report(text, bigint[], text[], boolean, boolean, bigint[], bigint[], text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ruptura_abcd_report(p_schema text, p_filial_ids bigint[] DEFAULT NULL::bigint[], p_curvas text[] DEFAULT ARRAY['A'::text, 'B'::text], p_apenas_ativos boolean DEFAULT true, p_apenas_ruptura boolean DEFAULT true, p_departamento_ids bigint[] DEFAULT NULL::bigint[], p_setor_ids bigint[] DEFAULT NULL::bigint[], p_busca text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50) RETURNS TABLE(total_records bigint, departamento_id bigint, departamento_nome text, produto_id bigint, filial_id bigint, filial_nome text, produto_descricao text, curva_lucro character varying, curva_venda text, estoque_atual numeric, venda_media_diaria_60d numeric, dias_de_estoque numeric, preco_venda numeric, filial_transfer_id bigint, filial_transfer_nome text, estoque_transfer numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '60s'
    AS $_$
DECLARE
  v_offset INTEGER;
  v_sql TEXT;
  v_setor_dept_ids bigint[];
  v_final_dept_ids bigint[];
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- ============================================================================
  -- Se filtro por setores, buscar os departamento_ids de nível 1 correspondentes
  -- ============================================================================
  IF p_setor_ids IS NOT NULL THEN
    EXECUTE format('
      SELECT ARRAY_AGG(DISTINCT dl1.departamento_id)
      FROM %I.setores s
      CROSS JOIN LATERAL (
        SELECT dl1.departamento_id
        FROM %I.departments_level_1 dl1
        WHERE
          (s.departamento_nivel = 1 AND dl1.departamento_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 2 AND dl1.pai_level_2_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 3 AND dl1.pai_level_3_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 4 AND dl1.pai_level_4_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 5 AND dl1.pai_level_5_id = ANY(s.departamento_ids))
          OR (s.departamento_nivel = 6 AND dl1.pai_level_6_id = ANY(s.departamento_ids))
      ) dl1
      WHERE s.id = ANY($1) AND s.ativo = true
    ', p_schema, p_schema)
    INTO v_setor_dept_ids
    USING p_setor_ids;
  END IF;

  -- Combinar filtros de departamento (se ambos fornecidos, usar interseção)
  IF p_departamento_ids IS NOT NULL AND v_setor_dept_ids IS NOT NULL THEN
    -- Interseção: apenas departamentos que estão em ambos
    SELECT ARRAY_AGG(d)
    FROM unnest(p_departamento_ids) d
    WHERE d = ANY(v_setor_dept_ids)
    INTO v_final_dept_ids;
  ELSIF v_setor_dept_ids IS NOT NULL THEN
    v_final_dept_ids := v_setor_dept_ids;
  ELSE
    v_final_dept_ids := p_departamento_ids;
  END IF;

  v_sql := format($sql$
    WITH filtered_produtos AS (
      SELECT
        p.id,
        p.filial_id,
        p.descricao,
        p.curva_lucro,
        p.curva_abcd,
        p.estoque_atual,
        p.venda_media_diaria_60d,
        p.dias_de_estoque,
        p.preco_de_venda_1,
        p.departamento_id
      FROM %I.produtos p
      WHERE 1=1
        AND (CASE WHEN $1 IS NULL THEN TRUE ELSE p.filial_id = ANY($1) END)
        AND (CASE WHEN $2 = TRUE THEN p.ativo = TRUE ELSE TRUE END)
        AND (CASE WHEN $3 = TRUE THEN p.estoque_atual <= 0 ELSE TRUE END)
        AND p.curva_abcd = ANY($4)
        AND (CASE WHEN $5 IS NULL THEN TRUE ELSE p.departamento_id = ANY($5) END)
        AND (CASE WHEN $6 IS NULL OR $6 = '' THEN TRUE ELSE p.descricao ILIKE '%%' || $6 || '%%' END)
    ),
    with_total AS (
      SELECT COUNT(*) as total FROM filtered_produtos
    ),
    tenant_info AS (
      SELECT tenant_id FROM branches LIMIT 1
    ),
    with_transfer_all AS (
      SELECT
        p.id as produto_origem_id,
        p.filial_id as filial_origem_id,
        pt.filial_id as filial_transfer_id,
        COALESCE(f.descricao::TEXT, 'Filial ' || pt.filial_id::TEXT) as filial_transfer_nome,
        pt.estoque_atual as estoque_transfer,
        ROW_NUMBER() OVER (PARTITION BY p.id, p.filial_id ORDER BY pt.estoque_atual DESC, pt.filial_id ASC) as rn
      FROM filtered_produtos p
      INNER JOIN %I.produtos pt
        ON p.id = pt.id
        AND pt.filial_id != p.filial_id
        AND pt.estoque_atual > 0
      LEFT JOIN branches f
        ON pt.filial_id::TEXT = f.branch_code
        AND f.tenant_id = (SELECT tenant_id FROM tenant_info)
    ),
    with_transfer AS (
      SELECT
        produto_origem_id,
        filial_origem_id,
        filial_transfer_id,
        filial_transfer_nome,
        estoque_transfer
      FROM with_transfer_all
      WHERE rn = 1
    )
    SELECT
      (SELECT total FROM with_total) as total_records,
      COALESCE(d.departamento_id, 0) as departamento_id,
      COALESCE(d.descricao, 'SEM DEPARTAMENTO') as departamento_nome,
      fp.id as produto_id,
      fp.filial_id,
      COALESCE(b.descricao::TEXT, 'Filial ' || fp.filial_id::TEXT) as filial_nome,
      fp.descricao as produto_descricao,
      fp.curva_lucro,
      fp.curva_abcd as curva_venda,
      fp.estoque_atual,
      fp.venda_media_diaria_60d,
      fp.dias_de_estoque,
      fp.preco_de_venda_1 as preco_venda,
      wt.filial_transfer_id,
      wt.filial_transfer_nome,
      wt.estoque_transfer
    FROM filtered_produtos fp
    LEFT JOIN %I.departments_level_1 d ON fp.departamento_id = d.departamento_id
    LEFT JOIN branches b
      ON fp.filial_id::TEXT = b.branch_code
      AND b.tenant_id = (SELECT tenant_id FROM tenant_info)
    LEFT JOIN with_transfer wt
      ON fp.id = wt.produto_origem_id
      AND fp.filial_id = wt.filial_origem_id
    ORDER BY
      COALESCE(d.descricao, 'ZZZZZ_SEM DEPARTAMENTO') ASC,
      COALESCE(b.descricao, 'ZZZZ_Filial ' || fp.filial_id::TEXT) ASC,
      fp.descricao ASC
    LIMIT $7 OFFSET $8
  $sql$, p_schema, p_schema, p_schema);

  RETURN QUERY EXECUTE v_sql
  USING p_filial_ids, p_apenas_ativos, p_apenas_ruptura, p_curvas, v_final_dept_ids, p_busca, p_page_size, v_offset;
END;
$_$;


--
-- Name: FUNCTION get_ruptura_abcd_report(p_schema text, p_filial_ids bigint[], p_curvas text[], p_apenas_ativos boolean, p_apenas_ruptura boolean, p_departamento_ids bigint[], p_setor_ids bigint[], p_busca text, p_page integer, p_page_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_ruptura_abcd_report(p_schema text, p_filial_ids bigint[], p_curvas text[], p_apenas_ativos boolean, p_apenas_ruptura boolean, p_departamento_ids bigint[], p_setor_ids bigint[], p_busca text, p_page integer, p_page_size integer) IS 'Retorna produtos em ruptura (estoque <= 0) para análise ABCD.

PARAMETROS:
- p_schema: Schema do tenant (ex: okilao, lucia, paraiso)
- p_filial_ids: Array de IDs de filiais (NULL = todas)
- p_curvas: Array de curvas ABCD a filtrar (default: A,B)
- p_apenas_ativos: Se true, apenas produtos ativos (default: true)
- p_apenas_ruptura: Se true, apenas estoque <= 0 (default: true)
- p_departamento_ids: Array de IDs de departamentos a filtrar (NULL = todos)
- p_setor_ids: Array de IDs de setores a filtrar (NULL = todos). Filtra produtos pelos departamentos associados aos setores.
- p_busca: Texto para buscar na descrição do produto (default: NULL)
- p_page: Pagina atual (default: 1)
- p_page_size: Itens por pagina (default: 50)

RETORNO:
Tabela com colunas: total_records, departamento_id, departamento_nome, produto_id,
filial_id, filial_nome, produto_descricao, curva_lucro, curva_venda, estoque_atual,
venda_media_diaria_60d, dias_de_estoque, preco_venda, filial_transfer_id,
filial_transfer_nome, estoque_transfer

EXEMPLO:
SELECT * FROM public.get_ruptura_abcd_report(
  ''lucia'',
  ARRAY[1, 2],
  ARRAY[''A'',''B'',''C''],
  true,
  true,
  NULL,
  ARRAY[13, 14, 15],
  NULL,
  1,
  50
);';


--
-- Name: get_ruptura_curva_a(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ruptura_curva_a(p_schema text, p_filial_id bigint) RETURNS TABLE(id bigint, descricao text, estoque_atual numeric, departamento_id bigint, departamento_nome text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '30s'
    AS $_$
BEGIN
    -- Validação de schema - ADICIONAR 'sol' aqui
    IF p_schema NOT IN ('okilao', 'saoluiz', 'paraiso', 'sol') THEN
        RAISE EXCEPTION 'Schema inválido: %', p_schema;
    END IF;

    RETURN QUERY EXECUTE format('
        SELECT
            p.id,
            p.descricao,
            COALESCE(p.estoque_atual, 0) as estoque_atual,
            COALESCE(p.departamento_id, 0) as departamento_id,
            COALESCE(d.descricao, ''Sem Departamento'') as departamento_nome
        FROM %I.produtos p
        LEFT JOIN %I.departments_level_1 d
            ON p.departamento_id = d.departamento_id
        WHERE
            p.filial_id = $1
            AND p.curva_abcd = ''A''
            AND COALESCE(p.estoque_atual, 0) <= 0
            AND COALESCE(p.ativo, true) = true
        ORDER BY
            COALESCE(d.descricao, ''Sem Departamento'') ASC,
            p.descricao ASC
    ', p_schema, p_schema)
    USING p_filial_id;
END;
$_$;


--
-- Name: FUNCTION get_ruptura_curva_a(p_schema text, p_filial_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_ruptura_curva_a(p_schema text, p_filial_id bigint) IS 'Retorna produtos Curva A em ruptura de estoque (estoque <= 0).
Agrupa por departamento, ordenado alfabeticamente.
Timeout: 30 segundos.';


--
-- Name: get_ruptura_venda_60d_report(text, integer[], integer, text[], integer, integer, bigint[], bigint[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ruptura_venda_60d_report(schema_name text, p_filiais integer[] DEFAULT NULL::integer[], p_limite_minimo_dias integer DEFAULT 20, p_curvas text[] DEFAULT ARRAY['A'::text, 'B'::text, 'C'::text], p_page integer DEFAULT 1, p_page_size integer DEFAULT 50, p_departamento_ids bigint[] DEFAULT NULL::bigint[], p_setor_ids bigint[] DEFAULT NULL::bigint[], p_busca text DEFAULT NULL::text) RETURNS TABLE(total_records bigint, page integer, page_size integer, total_pages integer, departamentos json)
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '120s'
    AS $_$
  DECLARE
    v_offset integer;
    v_total_records bigint;
    v_total_pages integer;
    v_query text;
    v_count_query text;
    v_result json;
    v_departamento_filter_ids bigint[];
  BEGIN
    IF schema_name IS NULL OR schema_name = '' THEN
      RAISE EXCEPTION 'schema_name não pode ser nulo
  ou vazio';
    END IF;

    v_offset := (p_page - 1) * p_page_size;

    IF p_setor_ids IS NOT NULL AND
  array_length(p_setor_ids, 1) > 0 THEN
      EXECUTE
        'SELECT COALESCE(ARRAY_AGG(DISTINCT
  dl1.departamento_id), ARRAY[]::bigint[])
         FROM ' || quote_ident(schema_name) ||
  '.departments_level_1 dl1
         JOIN ' || quote_ident(schema_name) ||
  '.setores s ON s.id = ANY($1)
         WHERE s.ativo = true AND (
           (s.departamento_nivel = 1 AND
  dl1.departamento_id = ANY(s.departamento_ids)) OR
           (s.departamento_nivel = 2 AND
  dl1.pai_level_2_id = ANY(s.departamento_ids)) OR
           (s.departamento_nivel = 3 AND
  dl1.pai_level_3_id = ANY(s.departamento_ids)) OR
           (s.departamento_nivel = 4 AND
  dl1.pai_level_4_id = ANY(s.departamento_ids)) OR
           (s.departamento_nivel = 5 AND
  dl1.pai_level_5_id = ANY(s.departamento_ids)) OR
           (s.departamento_nivel = 6 AND
  dl1.pai_level_6_id = ANY(s.departamento_ids))
         )'
      INTO v_departamento_filter_ids
      USING p_setor_ids;
    END IF;

    IF p_departamento_ids IS NOT NULL AND
  array_length(p_departamento_ids, 1) > 0 THEN
      v_departamento_filter_ids :=
  p_departamento_ids;
    END IF;

    v_count_query :=
      'SELECT COUNT(*)
       FROM ' || quote_ident(schema_name) ||
  '.produtos p
       LEFT JOIN ' || quote_ident(schema_name) ||
  '.departments_level_1 d1 ON d1.departamento_id =
  p.departamento_id
       WHERE
         COALESCE(p.dias_com_venda_60d, 0) >= $1
         AND COALESCE(p.dias_com_venda_ultimos_3d,
  0) = 0
         AND COALESCE(p.estoque_atual, 0) > 0
         AND ($2 IS NULL OR p.curva_abcd = ANY($2))
         AND ($3 IS NULL OR d1.departamento_id =
  ANY($3))
         AND (
           $4 IS NULL
           OR p.id::text = $4
           OR p.descricao ILIKE ''%'' || $4 || ''%''
         )
         AND ($5 IS NULL OR p.filial_id = ANY($5))';

    EXECUTE v_count_query
      INTO v_total_records
      USING p_limite_minimo_dias, p_curvas,
  v_departamento_filter_ids, p_busca, p_filiais;

    v_total_pages :=
  GREATEST(CEIL(COALESCE(v_total_records,
  0)::numeric / p_page_size), 1);

    v_query :=
      'WITH produtos_ruptura AS (
         SELECT
           p.id as produto_id,
           p.filial_id,
           COALESCE(b.descricao, ''Filial '' ||
  p.filial_id) as filial_nome,
           COALESCE(p.descricao, ''Sem Descrição'')
  as produto_nome,
           COALESCE(d1.departamento_id, 0) as
  departamento_id,
           COALESCE(d1.descricao, ''Sem
  Departamento'') as departamento_nome,
           COALESCE(p.curva_abcd, ''N/A'') as
  curva_abcd,
           COALESCE(p.dias_com_venda_60d, 0) as
  dias_com_venda_60d,
           COALESCE(p.dias_com_venda_ultimos_3d, 0)
  as dias_com_venda_ultimos_3d,
           COALESCE(p.estoque_atual, 0) as
  estoque_atual,
           COALESCE(p.venda_media_diaria_60d, 0) as
  venda_media_diaria_60d,
           (COALESCE(p.estoque_atual, 0) *
  COALESCE(p.preco_de_custo, 0)) as
  valor_estoque_parado,
           CASE
             WHEN p.dias_com_venda_60d >= 50 AND
  p.curva_abcd = ''A'' THEN ''CRÍTICO''
             WHEN p.dias_com_venda_60d >= 40 AND
  p.curva_abcd IN (''A'', ''B'') THEN ''ALTO''
             WHEN p.dias_com_venda_60d >= 30 THEN
  ''MÉDIO''
             WHEN p.dias_com_venda_60d >= 20 THEN
  ''BAIXO''
             ELSE ''NORMAL''
           END as nivel_ruptura,
           CASE
             WHEN p.dias_com_venda_60d >= 50 AND
  p.curva_abcd = ''A'' THEN 5
             WHEN p.dias_com_venda_60d >= 40 AND
  p.curva_abcd IN (''A'', ''B'') THEN 4
             WHEN p.dias_com_venda_60d >= 30 THEN 3
             WHEN p.dias_com_venda_60d >= 20 THEN 2
             ELSE 1
           END as nivel_score
         FROM ' || quote_ident(schema_name) ||
  '.produtos p
         LEFT JOIN ' || quote_ident(schema_name) ||
  '.departments_level_1 d1 ON d1.departamento_id =
  p.departamento_id
         LEFT JOIN public.branches b
           ON b.branch_code = p.filial_id::text
           AND b.tenant_id = (SELECT id FROM
  public.tenants WHERE supabase_schema = ' ||
  quote_literal(schema_name) || ' LIMIT 1)
         WHERE
           COALESCE(p.dias_com_venda_60d, 0) >= $1
           AND COALESCE(p.dias_com_venda_ultimos_3d,
  0) = 0
           AND COALESCE(p.estoque_atual, 0) > 0
           AND ($2 IS NULL OR p.curva_abcd =
  ANY($2))
           AND ($3 IS NULL OR d1.departamento_id =
  ANY($3))
           AND (
             $4 IS NULL
             OR p.id::text = $4
             OR p.descricao ILIKE ''%'' || $4 ||
  ''%''
           )
           AND ($5 IS NULL OR p.filial_id = ANY($5))
         ORDER BY
           nivel_score DESC,
           COALESCE(p.venda_media_diaria_60d, 0)
  DESC,
           p.descricao ASC
         LIMIT $6 OFFSET $7
       ),
       departamentos_hierarquia AS (
         SELECT DISTINCT departamento_id,
  departamento_nome
         FROM produtos_ruptura
       )
       SELECT COALESCE(
         (SELECT json_agg(
           json_build_object(
             ''departamento_id'', d.departamento_id,
             ''departamento_nome'',
  d.departamento_nome,
             ''produtos'', (
               SELECT COALESCE(json_agg(
                 json_build_object(
                   ''produto_id'', pr.produto_id,
                   ''filial_id'', pr.filial_id,
                   ''filial_nome'', pr.filial_nome,
                   ''produto_descricao'',
  pr.produto_nome,
                   ''estoque_atual'',
  pr.estoque_atual,
                   ''curva_venda'', pr.curva_abcd,
                   ''dias_com_venda_60d'',
  pr.dias_com_venda_60d,
                   ''dias_com_venda_ultimos_3d'',
  pr.dias_com_venda_ultimos_3d,
                   ''venda_media_diaria_60d'',
  pr.venda_media_diaria_60d,
                   ''valor_estoque_parado'',
  pr.valor_estoque_parado,
                   ''nivel_ruptura'',
  pr.nivel_ruptura
                 )
                 ORDER BY pr.nivel_score DESC,
  pr.venda_media_diaria_60d DESC, pr.produto_nome
               ), ''[]''::json)
               FROM produtos_ruptura pr
               WHERE pr.departamento_id =
  d.departamento_id
             )
           )
           ORDER BY
             CASE WHEN upper(d.departamento_nome)
  LIKE ''%SEM DEPARTAMENTO%'' THEN 1 ELSE 0 END,
             d.departamento_nome
         )
         FROM departamentos_hierarquia d),
         ''[]''::json
       )';

    EXECUTE v_query INTO v_result
      USING p_limite_minimo_dias, p_curvas,
  v_departamento_filter_ids, p_busca, p_filiais,
  p_page_size, v_offset;

    RETURN QUERY SELECT COALESCE(v_total_records,
  0), p_page, p_page_size, v_total_pages, v_result;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Erro ao executar
  get_ruptura_venda_60d_report: % (SQLSTATE: %)',
  SQLERRM, SQLSTATE;
  END;
  $_$;


--
-- Name: get_sales_by_month_chart(text, text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_by_month_chart(schema_name text, p_filiais text, p_data_inicio date, p_data_fim date, p_filter_type text) RETURNS json
    LANGUAGE plpgsql
    AS $_$
DECLARE
  result json;
  filial_filter text := '';
  v_filter_type text := coalesce(p_filter_type, 'year');
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    v_start := make_date(extract(year from current_date)::int, 1, 1);
    v_end := make_date(extract(year from current_date)::int, 12, 31);
    v_filter_type := 'year';
  ELSE
    IF v_filter_type = 'year' THEN
      v_start := make_date(extract(year from p_data_inicio)::int, 1, 1);
      v_end := make_date(extract(year from p_data_inicio)::int, 12, 31);
    ELSIF v_filter_type = 'month' THEN
      v_start := p_data_inicio;
      v_end := p_data_fim;
    ELSE
      v_start := date_trunc('month', p_data_inicio)::date;
      v_end := (date_trunc('month', p_data_fim) + interval '1 month - 1 day')::date;
    END IF;
  END IF;

  v_prev_start := (v_start - interval '1 year')::date;
  v_prev_end := (v_end - interval '1 year')::date;

  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    filial_filter := format('and filial_id in (%s)', p_filiais);
  END IF;

  EXECUTE format($q$
    with
    periods as (
      select
        gs::date as period_date,
        case
          when $1 = 'month' then to_char(gs, 'DD')
          when $1 = 'custom' then (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int] || '/' || extract(year from gs)::int
          else (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[extract(month from gs)::int]
        end as mes
      from generate_series(
        $2::date,
        $3::date,
        case when $1 = 'month' then interval '1 day' else interval '1 month' end
      ) gs
    ),
    sales_current as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_venda)::date as period_date,
        sum(valor_total) as total_vendas
      from %I.vendas_diarias_por_filial
      where data_venda between $2 and $3
      %s
      group by 1
    ),
    sales_prev as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_venda)::date as period_date,
        sum(valor_total) as total_vendas
      from %I.vendas_diarias_por_filial
      where data_venda between $4 and $5
      %s
      group by 1
    ),
    descontos_current as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_desconto)::date as period_date,
        sum(valor_desconto) as total_descontos
      from %I.descontos_venda
      where data_desconto between $2 and $3
      %s
      group by 1
    ),
    descontos_prev as (
      select
        date_trunc(case when $1 = 'month' then 'day' else 'month' end, data_desconto)::date as period_date,
        sum(valor_desconto) as total_descontos
      from %I.descontos_venda
      where data_desconto between $4 and $5
      %s
      group by 1
    )
    select json_agg(t)
    from (
      select
        p.mes,
        (coalesce(sc.total_vendas, 0) - coalesce(dc.total_descontos, 0))::numeric(15,2) as total_vendas,
        (coalesce(sp.total_vendas, 0) - coalesce(dp.total_descontos, 0))::numeric(15,2) as total_vendas_ano_anterior
      from periods p
      left join sales_current sc on sc.period_date = p.period_date
      left join descontos_current dc on dc.period_date = p.period_date
      left join sales_prev sp on sp.period_date = (p.period_date - interval '1 year')::date
      left join descontos_prev dp on dp.period_date = (p.period_date - interval '1 year')::date
      order by p.period_date
    ) t
  $q$,
    schema_name, filial_filter,
    schema_name, filial_filter,
    schema_name, filial_filter,
    schema_name, filial_filter
  )
  INTO result
  USING v_filter_type, v_start, v_end, v_prev_start, v_prev_end;

  RETURN COALESCE(result, '[]'::json);
END;
$_$;


--
-- Name: get_setores_com_nivel1(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_setores_com_nivel1(p_schema text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '30s'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  EXECUTE format('
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        ''id'', s.id,
        ''nome'', s.nome,
        ''departamento_nivel'', s.departamento_nivel,
        ''departamento_ids'', s.departamento_ids,
        ''ativo'', s.ativo,
        ''departamento_ids_nivel_1'', (
          SELECT COALESCE(ARRAY_AGG(DISTINCT dl1.departamento_id), ARRAY[]::bigint[])
          FROM %I.departments_level_1 dl1
          WHERE
            (s.departamento_nivel = 1 AND dl1.departamento_id = ANY(s.departamento_ids))
            OR (s.departamento_nivel = 2 AND dl1.pai_level_2_id = ANY(s.departamento_ids))
            OR (s.departamento_nivel = 3 AND dl1.pai_level_3_id = ANY(s.departamento_ids))
            OR (s.departamento_nivel = 4 AND dl1.pai_level_4_id = ANY(s.departamento_ids))
            OR (s.departamento_nivel = 5 AND dl1.pai_level_5_id = ANY(s.departamento_ids))
            OR (s.departamento_nivel = 6 AND dl1.pai_level_6_id = ANY(s.departamento_ids))
        )
      )
    ORDER BY s.nome), ''[]''::jsonb)
    FROM %I.setores s
    WHERE s.ativo = true
  ', p_schema, p_schema)
  INTO v_result;

  RETURN v_result;
END;
$$;


--
-- Name: FUNCTION get_setores_com_nivel1(p_schema text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_setores_com_nivel1(p_schema text) IS 'Retorna setores ativos com os departamento_ids de nível 1 mapeados.

PARAMETROS:
- p_schema: Schema do tenant (ex: okilao, lucia, paraiso)

RETORNO:
Array JSON com objetos contendo:
- id: ID do setor
- nome: Nome do setor
- departamento_nivel: Nível original do setor (1-6)
- departamento_ids: IDs dos departamentos no nível original
- ativo: Status do setor
- departamento_ids_nivel_1: IDs dos departamentos de nível 1 mapeados

EXEMPLO:
SELECT public.get_setores_com_nivel1(''lucia'');
';


--
-- Name: get_total_sku_distinct(text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_total_sku_distinct(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text DEFAULT 'all'::text) RETURNS TABLE(total_sku bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_filiais_condition TEXT;
BEGIN
  -- Construir condição de filiais
  IF p_filiais IS NULL OR p_filiais = 'all' OR p_filiais = '' THEN
    v_filiais_condition := '1=1';
  ELSE
    v_filiais_condition := 'filial_id IN (' || p_filiais || ')';
  END IF;

  RETURN QUERY EXECUTE format('
    SELECT
      COUNT(DISTINCT id_produto)::BIGINT as total_sku
    FROM %I.vendas
    WHERE data_venda BETWEEN $1 AND $2
      AND %s
  ',
  p_schema,
  v_filiais_condition
  )
  USING p_data_inicio, p_data_fim;
END;
$_$;


--
-- Name: FUNCTION get_total_sku_distinct(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_total_sku_distinct(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text) IS 'Retorna total de SKUs (produtos) distintos vendidos no período para as filiais selecionadas. Usa tabela vendas com COUNT(DISTINCT id_produto).';


--
-- Name: get_total_sku_distinct_pa(text, date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_total_sku_distinct_pa(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text DEFAULT 'all'::text, p_filter_type text DEFAULT 'year'::text) RETURNS TABLE(pa_total_sku bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_pa_data_inicio DATE;
  v_pa_data_fim DATE;
  v_filiais_condition TEXT;
BEGIN
  -- Calcular período anterior baseado no tipo de filtro
  IF p_filter_type = 'month' THEN
    v_pa_data_inicio := p_data_inicio - INTERVAL '1 year';
    v_pa_data_fim := p_data_fim - INTERVAL '1 year';
  ELSIF p_filter_type = 'year' THEN
    v_pa_data_inicio := p_data_inicio - INTERVAL '1 year';
    v_pa_data_fim := p_data_fim - INTERVAL '1 year';
  ELSE
    v_pa_data_inicio := p_data_inicio - (p_data_fim - p_data_inicio + 1);
    v_pa_data_fim := p_data_inicio - INTERVAL '1 day';
  END IF;

  -- Construir condição de filiais
  IF p_filiais IS NULL OR p_filiais = 'all' OR p_filiais = '' THEN
    v_filiais_condition := '1=1';
  ELSE
    v_filiais_condition := 'filial_id IN (' || p_filiais || ')';
  END IF;

  RETURN QUERY EXECUTE format('
    SELECT
      COUNT(DISTINCT id_produto)::BIGINT as pa_total_sku
    FROM %I.vendas
    WHERE data_venda BETWEEN $1 AND $2
      AND %s
  ',
  p_schema,
  v_filiais_condition
  )
  USING v_pa_data_inicio, v_pa_data_fim;
END;
$_$;


--
-- Name: FUNCTION get_total_sku_distinct_pa(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text, p_filter_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_total_sku_distinct_pa(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text, p_filter_type text) IS 'Retorna total de SKUs (produtos) distintos vendidos no período anterior para as filiais selecionadas. Usa tabela vendas com COUNT(DISTINCT id_produto).';


--
-- Name: get_user_authorized_branch_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_authorized_branch_ids(p_user_id uuid) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_branch_ids UUID[];
BEGIN
  -- Get authorized branches for user
  SELECT ARRAY_AGG(branch_id)
  INTO v_branch_ids
  FROM public.user_authorized_branches
  WHERE user_id = p_user_id;

  -- If NULL (no restrictions), return empty array to signal "all branches"
  RETURN COALESCE(v_branch_ids, ARRAY[]::UUID[]);
END;
$$;


--
-- Name: FUNCTION get_user_authorized_branch_ids(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_authorized_branch_ids(p_user_id uuid) IS 'Returns array of authorized branch IDs for user. Empty array means all branches.';


--
-- Name: get_venda_curva_report(text, integer, integer, bigint, integer, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_venda_curva_report(p_schema text, p_mes integer, p_ano integer, p_filial_id bigint DEFAULT NULL::bigint, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50, p_data_fim_override date DEFAULT NULL::date) RETURNS TABLE(dept_nivel3 text, dept_nivel2 text, dept_nivel1 text, produto_codigo bigint, produto_descricao text, filial_id bigint, qtde numeric, valor_vendas numeric, valor_lucro numeric, percentual_lucro numeric, curva_venda text, curva_lucro text)
    LANGUAGE plpgsql
    AS $_$
  DECLARE
    v_offset integer;
    v_data_inicio date;
    v_data_fim date;
  BEGIN
    v_offset := (p_page - 1) * p_page_size;

    -- Data fim padrão: mês completo
    v_data_inicio := make_date(p_ano, p_mes, 1);
    v_data_fim := coalesce(p_data_fim_override, (v_data_inicio + interval '1 month')::date);

    RETURN QUERY EXECUTE format('
      WITH vendas_agregadas AS (
        SELECT
          COALESCE(d3.descricao, ''Sem Nível 3'') as dept3_nome,
          COALESCE(d2.descricao, ''Sem Nível 2'') as dept2_nome,
          d1.descricao as dept1_nome,
          p.id as produto_id,
          p.descricao as produto_nome,
          v.filial_id,
          COALESCE(p.curva_abcd, ''D'') as curva_venda,
          COALESCE(p.curva_lucro, ''D'') as curva_lucro,
          SUM(v.quantidade) as total_qtde,
          SUM(v.valor_vendas) as total_valor_vendas,
          SUM(COALESCE(v.valor_vendas, 0) - (COALESCE(v.custo_compra, 0) * COALESCE(v.quantidade, 0))) as total_lucro
        FROM %I.vendas v
        INNER JOIN %I.produtos p
          ON p.id = v.id_produto
          AND p.filial_id = v.filial_id
          AND p.ativo = true
        INNER JOIN %I.departments_level_1 d1
          ON d1.departamento_id = p.departamento_id
        LEFT JOIN %I.departments_level_2 d2
          ON d2.departamento_id = d1.pai_level_2_id
        LEFT JOIN %I.departments_level_3 d3
          ON d3.departamento_id = d1.pai_level_3_id
        WHERE v.data_venda >= $1
          AND v.data_venda < $2
          AND v.valor_vendas > 0
          AND ($3 IS NULL OR v.filial_id = $3)
        GROUP BY
          d3.descricao,
          d2.descricao,
          d1.descricao,
          p.id,
          p.descricao,
          v.filial_id,
          p.curva_abcd,
          p.curva_lucro
      ),
      dept3_totais AS (
        SELECT
          dept3_nome,
          SUM(total_valor_vendas) as total_vendas
        FROM vendas_agregadas
        GROUP BY dept3_nome
        ORDER BY total_vendas DESC
        LIMIT $4 OFFSET $5
      )
      SELECT
        va.dept3_nome::text,
        va.dept2_nome::text,
        va.dept1_nome::text,
        va.produto_id,
        va.produto_nome::text,
        va.filial_id,
        ROUND(va.total_qtde::numeric, 2),
        ROUND(va.total_valor_vendas::numeric, 2),
        ROUND(va.total_lucro::numeric, 2),
        CASE
          WHEN va.total_valor_vendas > 0
          THEN ROUND((va.total_lucro / va.total_valor_vendas) * 100, 2)
          ELSE 0
        END as percentual_lucro,
        va.curva_venda::text,
        va.curva_lucro::text
      FROM vendas_agregadas va
      INNER JOIN dept3_totais dt ON va.dept3_nome = dt.dept3_nome
      ORDER BY
        va.dept3_nome,
        va.dept2_nome,
        va.dept1_nome,
        CASE va.curva_venda
          WHEN ''A'' THEN 1
          WHEN ''B'' THEN 2
          WHEN ''C'' THEN 3
          WHEN ''D'' THEN 4
          ELSE 5
        END,
        va.total_valor_vendas DESC
    ', p_schema, p_schema, p_schema, p_schema, p_schema)
    USING v_data_inicio, v_data_fim, p_filial_id, p_page_size, v_offset;
  END;
  $_$;


--
-- Name: get_vendas_por_filial(text, date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vendas_por_filial(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text DEFAULT 'all'::text, p_filter_type text DEFAULT 'year'::text) RETURNS TABLE(filial_id bigint, valor_total numeric, custo_total numeric, total_lucro numeric, quantidade_total numeric, total_transacoes numeric, ticket_medio numeric, margem_lucro numeric, pa_valor_total numeric, pa_custo_total numeric, pa_total_lucro numeric, pa_total_transacoes numeric, pa_ticket_medio numeric, pa_margem_lucro numeric, delta_valor numeric, delta_valor_percent numeric, delta_custo numeric, delta_custo_percent numeric, delta_lucro numeric, delta_lucro_percent numeric, delta_margem numeric, total_entradas numeric, pa_total_entradas numeric, delta_entradas numeric, delta_entradas_percent numeric, total_cupons bigint, pa_total_cupons bigint, delta_cupons bigint, delta_cupons_percent numeric, total_sku bigint, pa_total_sku bigint, delta_sku bigint, delta_sku_percent numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_pa_data_inicio DATE;
  v_pa_data_fim DATE;
  v_filiais_array BIGINT[];
BEGIN
  -- Calcular período anterior baseado no tipo de filtro
  IF p_filter_type = 'month' THEN
    v_pa_data_inicio := p_data_inicio - INTERVAL '1 year';
    v_pa_data_fim := p_data_fim - INTERVAL '1 year';
  ELSIF p_filter_type = 'year' THEN
    v_pa_data_inicio := p_data_inicio - INTERVAL '1 year';
    v_pa_data_fim := p_data_fim - INTERVAL '1 year';
  ELSE
    v_pa_data_inicio := p_data_inicio - (p_data_fim - p_data_inicio + 1);
    v_pa_data_fim := p_data_inicio - INTERVAL '1 day';
  END IF;

  -- Converter string de filiais em array (se não for 'all')
  IF p_filiais IS NOT NULL AND p_filiais != 'all' AND p_filiais != '' THEN
    v_filiais_array := string_to_array(p_filiais, ',')::BIGINT[];
  ELSE
    v_filiais_array := NULL;
  END IF;

  RETURN QUERY EXECUTE format('
    WITH 
    -- Período Atual - Vendas
    periodo_atual AS (
      SELECT
        v.filial_id,
        SUM(v.valor_total) as valor_total_bruto,
        SUM(v.custo_total) as custo_total_bruto,
        SUM(v.total_lucro) as total_lucro_bruto,
        SUM(v.quantidade_total) as quantidade_total,
        SUM(v.total_transacoes)::NUMERIC as total_transacoes
      FROM %I.vendas_diarias_por_filial v
      WHERE v.data_venda BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    -- Período Atual - Descontos
    descontos_periodo_atual AS (
      SELECT
        d.filial_id,
        COALESCE(SUM(d.valor_desconto), 0) as total_desconto_venda,
        COALESCE(SUM(d.desconto_custo), 0) as total_desconto_custo
      FROM %I.descontos_venda d
      WHERE d.data_desconto BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR d.filial_id = ANY($7))
      GROUP BY d.filial_id
    ),
    -- Período Atual - Entradas
    entradas_periodo_atual AS (
      SELECT
        e.filial_id,
        COALESCE(SUM(e.valor_total), 0) as total_entradas
      FROM %I.entradas e
      WHERE e.transacao IN (''P'', ''V'')
        AND e.data_entrada BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR e.filial_id = ANY($7))
      GROUP BY e.filial_id
    ),
    -- Período Atual - Cupons
    cupons_periodo_atual AS (
      SELECT
        r.filial_id,
        COALESCE(SUM(r.qtde_cupons), 0) as total_cupons
      FROM %I.resumo_vendas_caixa r
      WHERE r.data BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR r.filial_id = ANY($7))
      GROUP BY r.filial_id
    ),
    -- Período Atual - SKU
    sku_periodo_atual AS (
      SELECT
        v.filial_id,
        COUNT(DISTINCT v.id_produto) as total_sku
      FROM %I.vendas v
      WHERE v.data_venda BETWEEN $1 AND $2
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    -- Período Atual com Desconto aplicado
    periodo_atual_com_desconto AS (
      SELECT
        pa.filial_id,
        pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0) as valor_total,
        pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0) as custo_total,
        (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) -
        (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)) as total_lucro,
        pa.quantidade_total,
        pa.total_transacoes,
        CASE
          WHEN pa.total_transacoes > 0
          THEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) / pa.total_transacoes
          ELSE 0
        END as ticket_medio,
        CASE
          WHEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) > 0
          THEN (((pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) -
                 (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)))::NUMERIC /
                (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) * 100)
          ELSE 0
        END as margem_lucro
      FROM periodo_atual pa
      LEFT JOIN descontos_periodo_atual dpa ON pa.filial_id = dpa.filial_id
    ),
    -- Período Anterior - Vendas
    periodo_anterior AS (
      SELECT
        v.filial_id,
        SUM(v.valor_total) as valor_total_bruto,
        SUM(v.custo_total) as custo_total_bruto,
        SUM(v.total_lucro) as total_lucro_bruto,
        SUM(v.total_transacoes)::NUMERIC as total_transacoes
      FROM %I.vendas_diarias_por_filial v
      WHERE v.data_venda BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    -- Período Anterior - Descontos
    descontos_periodo_anterior AS (
      SELECT
        d.filial_id,
        COALESCE(SUM(d.valor_desconto), 0) as total_desconto_venda,
        COALESCE(SUM(d.desconto_custo), 0) as total_desconto_custo
      FROM %I.descontos_venda d
      WHERE d.data_desconto BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR d.filial_id = ANY($7))
      GROUP BY d.filial_id
    ),
    -- Período Anterior - Entradas
    entradas_periodo_anterior AS (
      SELECT
        e.filial_id,
        COALESCE(SUM(e.valor_total), 0) as pa_total_entradas
      FROM %I.entradas e
      WHERE e.transacao IN (''P'', ''V'')
        AND e.data_entrada BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR e.filial_id = ANY($7))
      GROUP BY e.filial_id
    ),
    -- Período Anterior - Cupons
    cupons_periodo_anterior AS (
      SELECT
        r.filial_id,
        COALESCE(SUM(r.qtde_cupons), 0) as pa_total_cupons
      FROM %I.resumo_vendas_caixa r
      WHERE r.data BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR r.filial_id = ANY($7))
      GROUP BY r.filial_id
    ),
    -- Período Anterior - SKU
    sku_periodo_anterior AS (
      SELECT
        v.filial_id,
        COUNT(DISTINCT v.id_produto) as pa_total_sku
      FROM %I.vendas v
      WHERE v.data_venda BETWEEN $3 AND $4
        AND ($7::BIGINT[] IS NULL OR v.filial_id = ANY($7))
      GROUP BY v.filial_id
    ),
    -- Período Anterior com Desconto aplicado
    periodo_anterior_com_desconto AS (
      SELECT
        pa.filial_id,
        pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0) as pa_valor_total,
        pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0) as pa_custo_total,
        (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) -
        (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)) as pa_total_lucro,
        pa.total_transacoes as pa_total_transacoes,
        CASE
          WHEN pa.total_transacoes > 0
          THEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) / pa.total_transacoes
          ELSE 0
        END as pa_ticket_medio,
        CASE
          WHEN (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) > 0
          THEN (((pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) -
                 (pa.custo_total_bruto - COALESCE(dpa.total_desconto_custo, 0)))::NUMERIC /
                (pa.valor_total_bruto - COALESCE(dpa.total_desconto_venda, 0)) * 100)
          ELSE 0
        END as pa_margem_lucro
      FROM periodo_anterior pa
      LEFT JOIN descontos_periodo_anterior dpa ON pa.filial_id = dpa.filial_id
    ),
    -- Todas as filiais (UNION de todas as fontes)
    todas_filiais AS (
      SELECT DISTINCT filial_id FROM periodo_atual_com_desconto
      UNION
      SELECT DISTINCT filial_id FROM periodo_anterior_com_desconto
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM entradas_periodo_anterior
      UNION
      SELECT DISTINCT filial_id FROM cupons_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM cupons_periodo_anterior
      UNION
      SELECT DISTINCT filial_id FROM sku_periodo_atual
      UNION
      SELECT DISTINCT filial_id FROM sku_periodo_anterior
    )
    SELECT
      tf.filial_id as filial_id,
      COALESCE(pc.valor_total, 0)::NUMERIC(15,2) as valor_total,
      COALESCE(pc.custo_total, 0)::NUMERIC(15,2) as custo_total,
      COALESCE(pc.total_lucro, 0)::NUMERIC(15,2) as total_lucro,
      COALESCE(pc.quantidade_total, 0)::NUMERIC(15,2) as quantidade_total,
      COALESCE(pc.total_transacoes, 0)::NUMERIC as total_transacoes,
      COALESCE(pc.ticket_medio, 0)::NUMERIC(15,2) as ticket_medio,
      COALESCE(pc.margem_lucro, 0)::NUMERIC(10,2) as margem_lucro,
      COALESCE(pa.pa_valor_total, 0)::NUMERIC(15,2) as pa_valor_total,
      COALESCE(pa.pa_custo_total, 0)::NUMERIC(15,2) as pa_custo_total,
      COALESCE(pa.pa_total_lucro, 0)::NUMERIC(15,2) as pa_total_lucro,
      COALESCE(pa.pa_total_transacoes, 0)::NUMERIC as pa_total_transacoes,
      COALESCE(pa.pa_ticket_medio, 0)::NUMERIC(15,2) as pa_ticket_medio,
      COALESCE(pa.pa_margem_lucro, 0)::NUMERIC(10,2) as pa_margem_lucro,
      -- Deltas
      (COALESCE(pc.valor_total, 0) - COALESCE(pa.pa_valor_total, 0))::NUMERIC(15,2) as delta_valor,
      CASE
        WHEN COALESCE(pa.pa_valor_total, 0) > 0
        THEN LEAST(((COALESCE(pc.valor_total, 0) - COALESCE(pa.pa_valor_total, 0)) / pa.pa_valor_total * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END as delta_valor_percent,
      (COALESCE(pc.custo_total, 0) - COALESCE(pa.pa_custo_total, 0))::NUMERIC(15,2) as delta_custo,
      CASE
        WHEN COALESCE(pa.pa_custo_total, 0) > 0
        THEN LEAST(((COALESCE(pc.custo_total, 0) - COALESCE(pa.pa_custo_total, 0)) / pa.pa_custo_total * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END as delta_custo_percent,
      (COALESCE(pc.total_lucro, 0) - COALESCE(pa.pa_total_lucro, 0))::NUMERIC(15,2) as delta_lucro,
      CASE
        WHEN COALESCE(pa.pa_total_lucro, 0) > 0
        THEN LEAST(((COALESCE(pc.total_lucro, 0) - COALESCE(pa.pa_total_lucro, 0)) / pa.pa_total_lucro * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END as delta_lucro_percent,
      (COALESCE(pc.margem_lucro, 0) - COALESCE(pa.pa_margem_lucro, 0))::NUMERIC(10,2) as delta_margem,
      -- Entradas
      COALESCE(epa.total_entradas, 0)::NUMERIC(15,2) as total_entradas,
      COALESCE(epan.pa_total_entradas, 0)::NUMERIC(15,2) as pa_total_entradas,
      (COALESCE(epa.total_entradas, 0) - COALESCE(epan.pa_total_entradas, 0))::NUMERIC(15,2) as delta_entradas,
      CASE
        WHEN COALESCE(epan.pa_total_entradas, 0) > 0
        THEN LEAST(((COALESCE(epa.total_entradas, 0) - COALESCE(epan.pa_total_entradas, 0)) / epan.pa_total_entradas * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END as delta_entradas_percent,
      -- Cupons
      COALESCE(cpa.total_cupons, 0)::BIGINT as total_cupons,
      COALESCE(cpan.pa_total_cupons, 0)::BIGINT as pa_total_cupons,
      (COALESCE(cpa.total_cupons, 0) - COALESCE(cpan.pa_total_cupons, 0))::BIGINT as delta_cupons,
      CASE
        WHEN COALESCE(cpan.pa_total_cupons, 0) > 0
        THEN LEAST(((COALESCE(cpa.total_cupons, 0) - COALESCE(cpan.pa_total_cupons, 0))::NUMERIC / cpan.pa_total_cupons * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END as delta_cupons_percent,
      -- SKU
      COALESCE(spa.total_sku, 0)::BIGINT as total_sku,
      COALESCE(span.pa_total_sku, 0)::BIGINT as pa_total_sku,
      (COALESCE(spa.total_sku, 0) - COALESCE(span.pa_total_sku, 0))::BIGINT as delta_sku,
      CASE
        WHEN COALESCE(span.pa_total_sku, 0) > 0
        THEN LEAST(((COALESCE(spa.total_sku, 0) - COALESCE(span.pa_total_sku, 0))::NUMERIC / span.pa_total_sku * 100), 99999999.99)::NUMERIC(10,2)
        ELSE 0
      END as delta_sku_percent
    FROM todas_filiais tf
    LEFT JOIN periodo_atual_com_desconto pc ON tf.filial_id = pc.filial_id
    LEFT JOIN periodo_anterior_com_desconto pa ON tf.filial_id = pa.filial_id
    LEFT JOIN entradas_periodo_atual epa ON tf.filial_id = epa.filial_id
    LEFT JOIN entradas_periodo_anterior epan ON tf.filial_id = epan.filial_id
    LEFT JOIN cupons_periodo_atual cpa ON tf.filial_id = cpa.filial_id
    LEFT JOIN cupons_periodo_anterior cpan ON tf.filial_id = cpan.filial_id
    LEFT JOIN sku_periodo_atual spa ON tf.filial_id = spa.filial_id
    LEFT JOIN sku_periodo_anterior span ON tf.filial_id = span.filial_id
    WHERE COALESCE(pc.valor_total, 0) > 0 
       OR COALESCE(epa.total_entradas, 0) > 0
       OR COALESCE(cpa.total_cupons, 0) > 0
       OR COALESCE(spa.total_sku, 0) > 0
    ORDER BY COALESCE(pc.valor_total, 0) DESC NULLS LAST
  ',
  p_schema, p_schema, p_schema, p_schema, p_schema,
  p_schema, p_schema, p_schema, p_schema, p_schema
  )
  USING p_data_inicio, p_data_fim, v_pa_data_inicio, v_pa_data_fim, NULL, NULL, v_filiais_array;
END;
$_$;


--
-- Name: FUNCTION get_vendas_por_filial(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text, p_filter_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_vendas_por_filial(p_schema text, p_data_inicio date, p_data_fim date, p_filiais text, p_filter_type text) IS 'Retorna vendas por filial com dados de PDV, entradas, cupons, SKU e comparação com período anterior. Versão 2026-01-16 OTIMIZADA com filtros aplicados diretamente nas CTEs base usando array de filiais.';


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


--
-- Name: insert_audit_log(text, text, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_audit_log(p_module text, p_sub_module text DEFAULT NULL::text, p_tenant_id uuid DEFAULT NULL::uuid, p_action text DEFAULT 'access'::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    tenant_id,
    module,
    sub_module,
    action,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    p_tenant_id,
    p_module,
    p_sub_module,
    p_action,
    p_metadata,
    NOW() AT TIME ZONE 'America/Sao_Paulo'
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


--
-- Name: FUNCTION insert_audit_log(p_module text, p_sub_module text, p_tenant_id uuid, p_action text, p_metadata jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.insert_audit_log(p_module text, p_sub_module text, p_tenant_id uuid, p_action text, p_metadata jsonb) IS 'Insert audit log entry with São Paulo timezone';


--
-- Name: insert_audit_log(text, text, uuid, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_audit_log(p_module text, p_sub_module text DEFAULT NULL::text, p_tenant_id uuid DEFAULT NULL::uuid, p_user_name text DEFAULT NULL::text, p_user_email text DEFAULT NULL::text, p_action text DEFAULT 'access'::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    user_name,
    user_email,
    tenant_id,
    module,
    sub_module,
    action,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    p_user_name,
    p_user_email,
    p_tenant_id,
    p_module,
    p_sub_module,
    p_action,
    p_metadata,
    NOW() AT TIME ZONE 'America/Sao_Paulo'
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


--
-- Name: insert_desconto_venda(text, integer, date, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_desconto_venda(p_schema text, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_observacao text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_result json;
  v_new_id uuid;
BEGIN
  -- Validar valor
  IF p_valor_desconto < 0 THEN
    RAISE EXCEPTION 'Valor do desconto deve ser maior ou igual a zero';
  END IF;

  -- Gerar novo ID
  v_new_id := gen_random_uuid();

  -- Inserir desconto
  EXECUTE format('
    INSERT INTO %I.descontos_venda (
      id, filial_id, data_desconto, valor_desconto, observacao, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING json_build_object(
      ''id'', id,
      ''filial_id'', filial_id,
      ''data_desconto'', data_desconto,
      ''valor_desconto'', valor_desconto,
      ''observacao'', observacao,
      ''created_at'', created_at,
      ''updated_at'', updated_at,
      ''created_by'', created_by
    )
  ', p_schema)
  USING v_new_id, p_filial_id, p_data_desconto, p_valor_desconto, p_observacao, p_created_by
  INTO v_result;
  
  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um desconto lançado para esta filial nesta data';
END;
$_$;


--
-- Name: insert_desconto_venda(text, integer, date, numeric, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_desconto_venda(p_schema text, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_desconto_custo numeric, p_observacao text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, filial_id integer, data_desconto date, valor_desconto numeric, desconto_custo numeric, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_id uuid;
BEGIN
  -- Gerar novo UUID
  v_id := gen_random_uuid();
  
  -- Inserir desconto
  EXECUTE format(
    'INSERT INTO %I.descontos_venda (
      id, filial_id, data_desconto, valor_desconto, desconto_custo, observacao, created_by, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
    )',
    p_schema
  ) USING v_id, p_filial_id, p_data_desconto, p_valor_desconto, p_desconto_custo, p_observacao, p_created_by;
  
  -- Retornar registro inserido
  RETURN QUERY EXECUTE format(
    'SELECT 
      id, filial_id, data_desconto, valor_desconto, desconto_custo, observacao, created_at, updated_at
    FROM %I.descontos_venda
    WHERE id = $1',
    p_schema
  ) USING v_id;
END;
$_$;


--
-- Name: FUNCTION insert_desconto_venda(p_schema text, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_desconto_custo numeric, p_observacao text, p_created_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.insert_desconto_venda(p_schema text, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_desconto_custo numeric, p_observacao text, p_created_by uuid) IS 'Insere um novo desconto_venda em um schema específico';


--
-- Name: is_superadmin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superadmin(user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id
    AND role = 'superadmin'
  );
END;
$$;


--
-- Name: job_atualizar_mvs_clientes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_atualizar_mvs_clientes() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    schema_rec RECORD;
    schemas_ok INT := 0;
    schemas_falha INT := 0;
BEGIN
    -- MUDANÇA CRÍTICA: Em vez de excluir, agora incluímos APENAS os schemas de clientes.
    FOR schema_rec IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name IN ('okilao', 'paraiso', 'saoluiz') -- << ESTRATÉGIA CORRIGIDA
    LOOP
        BEGIN
            RAISE NOTICE 'Atualizando visão materializada para o schema: %', schema_rec.schema_name;
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I.vendas_agregadas_60d;', schema_rec.schema_name);
            schemas_ok := schemas_ok + 1;
        EXCEPTION
            WHEN OTHERS THEN
                schemas_falha := schemas_falha + 1;
                RAISE WARNING 'Falha ao atualizar a visão para o schema %: %', schema_rec.schema_name, SQLERRM;
        END;
    END LOOP;

    RETURN format('Atualização das visões concluída. Sucesso: %, Falhas: %.', schemas_ok, schemas_falha);
END;
$$;


--
-- Name: limpar_despesas_periodo(text, integer[], date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limpar_despesas_periodo(p_schema_name text, p_filiais integer[], p_data_inicial date, p_data_final date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
declare
  sql text;
begin
  -- monta DELETE dinâmico no schema alvo
  sql := format(
    'delete from %I.despesas
     where filial_id = any($1)
       and data_despesa between $2 and $3',
    p_schema_name
  );

  execute sql using p_filiais, p_data_inicial, p_data_final;
end $_$;


--
-- Name: limpar_despesas_periodo(text, date, date, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limpar_despesas_periodo(p_schema_name text, p_data_inicial date, p_data_final date, p_filiais integer[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_table_name TEXT;
    v_sql TEXT;
    v_rows_deleted INTEGER;
BEGIN
    -- Define o nome da tabela (ajuste conforme a estrutura real)
    v_table_name := p_schema_name || '.despesas';

    -- Monta o SQL dinâmico para deletar os registros
    v_sql := FORMAT(
        'DELETE FROM %I.despesas
         WHERE data_despesa BETWEEN $1 AND $2
         AND filial_id = ANY($3)',
        p_schema_name
    );

    -- Executa a deleção
    EXECUTE v_sql USING p_data_inicial, p_data_final, p_filiais;

    -- Obtém o número de linhas deletadas
    GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

    -- Log da operação
    RAISE NOTICE 'Deletados % registros do período % a % para as filiais %',
        v_rows_deleted, p_data_inicial, p_data_final, p_filiais;

END;
$_$;


--
-- Name: FUNCTION limpar_despesas_periodo(p_schema_name text, p_data_inicial date, p_data_final date, p_filiais integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.limpar_despesas_periodo(p_schema_name text, p_data_inicial date, p_data_final date, p_filiais integer[]) IS 'Remove todas as despesas de um período específico e filiais específicas antes de recarregar os dados';


--
-- Name: limpar_entradas_periodo(text, integer[], date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limpar_entradas_periodo(p_schema_name text, p_filiais integer[], p_data_inicial date, p_data_final date) RETURNS TABLE(deleted_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_deleted INTEGER := 0;
    v_query TEXT;
BEGIN
    -- Valida schema_name para prevenir SQL injection
    IF p_schema_name !~ '^[a-zA-Z0-9_]+$' THEN
        RAISE EXCEPTION 'Nome de schema inválido: %', p_schema_name;
    END IF;

    -- Cria a query dinâmica para deletar do schema correto
    v_query := format('
        DELETE FROM %I.entradas
        WHERE filial_id = ANY($1)
        AND data_entrada BETWEEN $2 AND $3
    ', p_schema_name);

    -- Executa o DELETE
    EXECUTE v_query USING p_filiais, p_data_inicial, p_data_final;

    -- Obtém total deletado
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- Retorna resultado
    RETURN QUERY SELECT v_deleted;
END;
$_$;


--
-- Name: FUNCTION limpar_entradas_periodo(p_schema_name text, p_filiais integer[], p_data_inicial date, p_data_final date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.limpar_entradas_periodo(p_schema_name text, p_filiais integer[], p_data_inicial date, p_data_final date) IS 'Remove entradas de um período específico para as filiais informadas';


--
-- Name: limpar_vendas_hoje(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limpar_vendas_hoje(p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Truncar ambas as tabelas com CASCADE para evitar erro de FK
    EXECUTE format('TRUNCATE TABLE %I.vendas_hoje, %I.vendas_hoje_itens', p_schema_name, p_schema_name);
END;
$$;


--
-- Name: limpar_vendas_hoje_filiais(text, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limpar_vendas_hoje_filiais(p_schema_name text, p_filiais integer[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    -- Deletar apenas das filiais especificadas
    -- ON DELETE CASCADE na FK cuida dos itens automaticamente
    EXECUTE format('
        DELETE FROM %I.vendas_hoje
        WHERE filial_id = ANY($1)
    ', p_schema_name) USING p_filiais;
END;
$_$;


--
-- Name: link_department_parents(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_department_parents() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Atualiza a coluna 'parent_id' de cada departamento filho (c)
    -- encontrando o 'id' do seu respectivo pai (p)
    UPDATE public.departments c
    SET parent_id = p.id
    FROM public.departments p
    WHERE c.parent_source_id = p.source_id AND c.parent_source_level = p.source_level;
END;
$$;


--
-- Name: link_departments_level_2(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_departments_level_2(schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I.departments_nivel_2 AS t2
     SET departamento_pai = t1.departamento_id
     FROM %I.departments AS t1
     WHERE t1.departamentalizacaoNivel2 = t2.departamento_id;',
    schema_name, schema_name
  );
END;
$$;


--
-- Name: log_job(text, text, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_job(p_function_name text, p_schema_name text, p_status text, p_error_message text, p_start_time timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO public.jobs_log (function_name, schema_name, status, error_message, execution_time)
    VALUES (
        p_function_name,
        p_schema_name,
        p_status,
        p_error_message,
        clock_timestamp() - p_start_time
    );
END;
$$;


--
-- Name: maintenance_metas_setor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintenance_metas_setor() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_schema TEXT;
  v_result JSON;
  v_schemas_processed INT := 0;
BEGIN
  RAISE NOTICE 'Executando manutenção periódica das tabelas do módulo Meta por Setor...';

  -- Executar ANALYZE em todos os schemas de tenant
  FOR v_schema IN SELECT nspname FROM pg_namespace
    WHERE nspname IN ('okilao', 'saoluiz', 'paraiso', 'sol', 'lucia')
  LOOP
    BEGIN
      EXECUTE format('ANALYZE %I.metas_setor', v_schema);
      EXECUTE format('ANALYZE %I.vendas', v_schema);
      EXECUTE format('ANALYZE %I.produtos', v_schema);
      EXECUTE format('ANALYZE %I.departments_level_1', v_schema);
      EXECUTE format('ANALYZE %I.descontos_venda', v_schema);

      v_schemas_processed := v_schemas_processed + 1;
      RAISE NOTICE '✅ Schema %: Estatísticas atualizadas', v_schema;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️  Erro ao processar schema %: %', v_schema, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'schemas_processed', v_schemas_processed,
    'timestamp', NOW(),
    'message', format('Manutenção executada em %s schemas', v_schemas_processed)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', NOW()
  );
END;
$$;


--
-- Name: FUNCTION maintenance_metas_setor(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.maintenance_metas_setor() IS 'Função de manutenção periódica para o módulo Meta por Setor.
Executa ANALYZE em todas as tabelas principais de todos os schemas de tenant.

QUANDO EXECUTAR:
- Após grandes cargas de dados (importação de vendas)
- Após mudanças significativas nas metas
- Mensalmente como manutenção preventiva

EXEMPLO:
SELECT public.maintenance_metas_setor();

RETORNO:
{
  "success": true,
  "schemas_processed": 4,
  "timestamp": "2025-11-18T10:30:00Z",
  "message": "Manutenção executada em 4 schemas"
}';


--
-- Name: merge_produtos(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_produtos(schema_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  EXECUTE format('
    INSERT INTO %I.produtos (
      id, descricao, ativo, unidade_de_medida, curva_abc, balanca, ultimo_fornecedor,
      preco_de_venda_1, preco_de_venda_2, preco_de_custo, custo_real, custo_fiscal,
      custo_com_encargos, custo_medio, estoque_atual, qtde_por_embalagem_ultima_entrada,
      data_cadastro, data_alteracao_preco, data_alteracao_custo, data_alteracao_cadastro,
      marca_id, classe_id, agrupamento_id, departamento_id
    )
    SELECT
      s.id, s.descricao, s.ativo, s.unidade_de_medida, s.curva_abc, s.balanca, s.ultimo_fornecedor,
      s.preco_de_venda_1, s.preco_de_venda_2, s.preco_de_custo, s.custo_real, s.custo_fiscal,
      s.custo_com_encargos, s.custo_medio, s.estoque_atual, s.qtde_por_embalagem_ultima_entrada,
      s.data_cadastro, s.data_alteracao_preco, s.data_alteracao_custo, s.data_alteracao_cadastro,
      s.marca_id, s.classe_id, s.agrupamento_id, s.departamento_id
    FROM %I.staging_produtos s
    ON CONFLICT (id) DO UPDATE SET
      descricao = EXCLUDED.descricao,
      ativo = EXCLUDED.ativo,
      unidade_de_medida = EXCLUDED.unidade_de_medida,
      curva_abc = EXCLUDED.curva_abc,
      balanca = EXCLUDED.balanca,
      ultimo_fornecedor = EXCLUDED.ultimo_fornecedor,
      preco_de_venda_1 = EXCLUDED.preco_de_venda_1,
      preco_de_venda_2 = EXCLUDED.preco_de_venda_2,
      preco_de_custo = EXCLUDED.preco_de_custo,
      custo_real = EXCLUDED.custo_real,
      custo_fiscal = EXCLUDED.custo_fiscal,
      custo_com_encargos = EXCLUDED.custo_com_encargos,
      custo_medio = EXCLUDED.custo_medio,
      estoque_atual = EXCLUDED.estoque_atual,
      qtde_por_embalagem_ultima_entrada = EXCLUDED.qtde_por_embalagem_ultima_entrada,
      data_cadastro = EXCLUDED.data_cadastro,
      data_alteracao_preco = EXCLUDED.data_alteracao_preco,
      data_alteracao_custo = EXCLUDED.data_alteracao_custo,
      data_alteracao_cadastro = EXCLUDED.data_alteracao_cadastro,
      marca_id = EXCLUDED.marca_id,
      classe_id = EXCLUDED.classe_id,
      agrupamento_id = EXCLUDED.agrupamento_id,
      departamento_id = EXCLUDED.departamento_id,
      updated_at = NOW();
  ', schema_name, schema_name);
END;
$$;


--
-- Name: obter_dados_relatorio_lucro(text, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.obter_dados_relatorio_lucro(p_schema_name text, p_filial_id integer, p_periodo date) RETURNS TABLE(segmento_nivel_1 text, segmento_nivel_2 text, segmento_nivel_3 text, codigo_produto bigint, nome_produto text, quantidade_vendida numeric, valor_vendido numeric, curva_calculada text, lucro_total numeric, curva_lucro text)
    LANGUAGE plpgsql
    AS $_$
DECLARE
    query_text TEXT;
BEGIN
    query_text := format(
        $SQL$
        SELECT
            vw.segmento_nivel_1,
            vw.segmento_nivel_2,
            vw.segmento_nivel_3,
            vw.codigo_produto,
            vw.nome_produto,
            vw.quantidade_vendida,
            vw.valor_vendido,
            vw.curva_calculada::text, -- <<< CORREÇÃO APLICADA AQUI
            vw.lucro_total,
            vw.curva_lucro::text      -- <<< CORREÇÃO APLICADA AQUI
        FROM %I.vw_report_curva_abcd AS vw
        WHERE
            vw.filial_id = %L AND
            date_trunc('month', vw.mes_referencia) = date_trunc('month', %L::date)
        $SQL$,
        p_schema_name,
        p_filial_id,
        p_periodo
    );

    RETURN QUERY EXECUTE query_text;
END;
$_$;


--
-- Name: obter_produtos_por_filial(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.obter_produtos_por_filial(schema_name text, p_filial_id integer) RETURNS TABLE(id_produto bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    -- Retorna todos os IDs de produtos distintos para a filial especificada
    -- A tabela produtos tem colunas: id (BIGINT) e filial_id (BIGINT)
    RETURN QUERY EXECUTE format(
        'SELECT DISTINCT id as id_produto FROM %I.produtos WHERE filial_id = $1',
        schema_name
    ) USING p_filial_id;
END;
$_$;


--
-- Name: FUNCTION obter_produtos_por_filial(schema_name text, p_filial_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.obter_produtos_por_filial(schema_name text, p_filial_id integer) IS 'Retorna lista de IDs de produtos válidos para uma filial específica. Usado pelo ETL de vendas para validar produtos antes de inserir.';


--
-- Name: processar_carga_departamentos(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_departamentos(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    -- UPSERT em batch para departamentos
    EXECUTE format(
        'INSERT INTO %I.departamentos_nivel1 (
            id, descricao, updated_at
        )
        SELECT
            (item->>''id'')::INTEGER,
            item->>''descricao'',
            NOW()
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (id)
        DO UPDATE SET
            descricao = EXCLUDED.descricao,
            updated_at = NOW()',
        p_schema_name
    ) USING p_data_json;

    RAISE NOTICE 'Departamentos carregados com sucesso (UPSERT)';
END;
$_$;


--
-- Name: FUNCTION processar_carga_departamentos(p_data_json jsonb, p_schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.processar_carga_departamentos(p_data_json jsonb, p_schema_name text) IS 'Carrega departamentos nível 1 usando UPSERT - insere novos ou atualiza existentes';


--
-- Name: processar_carga_despesas(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_despesas(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    -- UPSERT em batch único - muito mais rápido que loop
    EXECUTE format(
        'INSERT INTO %I.despesas (
            filial_id, data_despesa, id_tipo_despesa, sequencia,
            descricao_despesa, id_fornecedor, numero_nota, serie_nota,
            data_emissao, valor, observacao, usuario, classificacao,
            fechamento_caixa, data_processamento
        )
        SELECT
            (item->>''idFilial'')::INTEGER,
            (item->>''dataDespesa'')::DATE,
            (item->>''idTipoDespesa'')::INTEGER,
            (item->>''sequencia'')::INTEGER,
            item->>''descricaoDespesa'',
            NULLIF(item->>''idFornecedor'', '''')::INTEGER,
            NULLIF(item->>''numeroNota'', '''')::BIGINT,
            item->>''serieNota'',
            NULLIF(item->>''dataEmissao'', '''')::DATE,
            NULLIF(item->>''valor'', '''')::NUMERIC,
            item->>''observacao'',
            item->>''usuario'',
            item->>''classificacao'',
            COALESCE((item->>''fechamentoCaixa'')::BOOLEAN, false),
            NULLIF(item->>''dataProcessamento'', '''')::TIMESTAMP
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (filial_id, data_despesa, id_tipo_despesa, sequencia)
        DO UPDATE SET
            descricao_despesa = EXCLUDED.descricao_despesa,
            id_fornecedor = EXCLUDED.id_fornecedor,
            numero_nota = EXCLUDED.numero_nota,
            serie_nota = EXCLUDED.serie_nota,
            data_emissao = EXCLUDED.data_emissao,
            valor = EXCLUDED.valor,
            observacao = EXCLUDED.observacao,
            usuario = EXCLUDED.usuario,
            classificacao = EXCLUDED.classificacao,
            fechamento_caixa = EXCLUDED.fechamento_caixa,
            data_processamento = EXCLUDED.data_processamento',
        p_schema_name
    ) USING p_data_json;

    RAISE NOTICE 'Batch UPSERT executado com sucesso';
END;
$_$;


--
-- Name: FUNCTION processar_carga_despesas(p_data_json jsonb, p_schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.processar_carga_despesas(p_data_json jsonb, p_schema_name text) IS 'Processa carga de despesas usando UPSERT - insere novos registros ou atualiza existentes, evitando erro de duplicate key';


--
-- Name: processar_carga_entradas(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_entradas(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    EXECUTE format('
        INSERT INTO %I.entradas (id, filial_id, numero, data_emissao, data_entrada, valor_total, transacao, data_extracao)
        SELECT
            (item->>''id'')::BIGINT,
            (item->>''filialId'')::INTEGER,
            (item->>''numero'')::INTEGER,
            NULLIF(item->>''dataEmissao'', '''')::DATE,
            (item->>''dataEntrada'')::DATE,
            COALESCE((item->>''valorTotal'')::DECIMAL(15,2), 0),
            item->>''transacao'',
            (item->>''dataExtracao'')::DATE
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (id) DO UPDATE SET
            filial_id = EXCLUDED.filial_id,
            numero = EXCLUDED.numero,
            data_emissao = EXCLUDED.data_emissao,
            data_entrada = EXCLUDED.data_entrada,
            valor_total = EXCLUDED.valor_total,
            transacao = EXCLUDED.transacao,
            data_extracao = EXCLUDED.data_extracao
    ', p_schema_name) USING p_data_json;
END;
$_$;


--
-- Name: FUNCTION processar_carga_entradas(p_data_json jsonb, p_schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.processar_carga_entradas(p_data_json jsonb, p_schema_name text) IS 'Processa upsert de entradas (cabeçalhos das notas de entrada)';


--
-- Name: processar_carga_entradas_produtos(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_entradas_produtos(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    EXECUTE format('
        INSERT INTO %I.entradas_produtos (entrada_id, produto_id, ordem, quantidade, qtd_por_embalagem, custo_unitario, data_extracao)
        SELECT
            (item->>''entradaId'')::BIGINT,
            (item->>''produtoId'')::BIGINT,
            COALESCE((item->>''ordem'')::INTEGER, 1),
            COALESCE((item->>''quantidade'')::DECIMAL(15,3), 0),
            COALESCE((item->>''qtdPorEmbalagem'')::DECIMAL(15,3), 0),
            COALESCE((item->>''custoUnitario'')::DECIMAL(15,5), 0),
            (item->>''dataExtracao'')::DATE
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (entrada_id, produto_id, ordem) DO UPDATE SET
            quantidade = EXCLUDED.quantidade,
            qtd_por_embalagem = EXCLUDED.qtd_por_embalagem,
            custo_unitario = EXCLUDED.custo_unitario,
            data_extracao = EXCLUDED.data_extracao
    ', p_schema_name) USING p_data_json;
END;
$_$;


--
-- Name: FUNCTION processar_carga_entradas_produtos(p_data_json jsonb, p_schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.processar_carga_entradas_produtos(p_data_json jsonb, p_schema_name text) IS 'Processa upsert de produtos das entradas (itens das notas de entrada)';


--
-- Name: processar_carga_faturamento(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_faturamento(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
    v_sql TEXT;
BEGIN
    -- Validação de parâmetros
    IF p_data_json IS NULL OR jsonb_array_length(p_data_json) = 0 THEN
        RETURN;
    END IF;

    IF p_schema_name IS NULL OR p_schema_name = '' THEN
        RAISE EXCEPTION 'Schema name é obrigatório';
    END IF;

    -- Monta e executa o upsert dinâmico
    v_sql := format('
        INSERT INTO %I.faturamento (
            id_saida,
            id_produto,
            ordem,
            filial_id,
            id_entidade,
            tipo_entidade,
            serie_nfc,
            numero_nota,
            data_emissao,
            data_saida,
            valor_contabil,
            valor_desconto,
            valor_frete,
            situacao,
            transacao,
            id_vendedor,
            especie,
            modelo_nota,
            consumidor_final,
            quantidade,
            qtd_embalagens,
            qtd_por_embalagem,
            preco_cadastrado,
            preco_digitado,
            preco_final,
            custo_unitario,
            custo_sem_icms,
            custo_medio,
            custo_fiscal_medio,
            custo_com_encargos,
            aliq_icms,
            valor_ipi,
            unidade_medida,
            valor_desconto_item,
            valor_acrescimo,
            valor_st,
            tipo_tributacao,
            valor_icms,
            base_calculo_icms,
            cancelado,
            valor_frete_item,
            data_extracao
        )
        SELECT
            (item->>''id_saida'')::BIGINT,
            (item->>''id_produto'')::BIGINT,
            (item->>''ordem'')::INTEGER,
            (item->>''filial_id'')::INTEGER,
            (item->>''id_entidade'')::BIGINT,
            item->>''tipo_entidade'',
            item->>''serie_nfc'',
            (item->>''numero_nota'')::INTEGER,
            (item->>''data_emissao'')::DATE,
            (item->>''data_saida'')::DATE,
            (item->>''valor_contabil'')::DECIMAL(15,2),
            (item->>''valor_desconto'')::DECIMAL(15,2),
            (item->>''valor_frete'')::DECIMAL(15,2),
            item->>''situacao'',
            item->>''transacao'',
            (item->>''id_vendedor'')::INTEGER,
            item->>''especie'',
            item->>''modelo_nota'',
            item->>''consumidor_final'',
            (item->>''quantidade'')::DECIMAL(15,3),
            (item->>''qtd_embalagens'')::DECIMAL(15,2),
            (item->>''qtd_por_embalagem'')::DECIMAL(15,3),
            (item->>''preco_cadastrado'')::DECIMAL(15,5),
            (item->>''preco_digitado'')::DECIMAL(15,6),
            (item->>''preco_final'')::DECIMAL(15,7),
            (item->>''custo_unitario'')::DECIMAL(15,5),
            (item->>''custo_sem_icms'')::DECIMAL(15,3),
            (item->>''custo_medio'')::DECIMAL(15,3),
            (item->>''custo_fiscal_medio'')::DECIMAL(15,3),
            (item->>''custo_com_encargos'')::DECIMAL(15,3),
            (item->>''aliq_icms'')::DECIMAL(5,2),
            (item->>''valor_ipi'')::DECIMAL(15,4),
            item->>''unidade_medida'',
            (item->>''valor_desconto_item'')::DECIMAL(15,5),
            (item->>''valor_acrescimo'')::DECIMAL(15,5),
            (item->>''valor_st'')::DECIMAL(15,4),
            item->>''tipo_tributacao'',
            (item->>''valor_icms'')::DECIMAL(15,2),
            (item->>''base_calculo_icms'')::DECIMAL(15,7),
            item->>''cancelado'',
            (item->>''valor_frete_item'')::DECIMAL(15,2),
            (item->>''data_extracao'')::DATE
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (id_saida, id_produto, ordem)
        DO UPDATE SET
            filial_id = EXCLUDED.filial_id,
            id_entidade = EXCLUDED.id_entidade,
            tipo_entidade = EXCLUDED.tipo_entidade,
            serie_nfc = EXCLUDED.serie_nfc,
            numero_nota = EXCLUDED.numero_nota,
            data_emissao = EXCLUDED.data_emissao,
            data_saida = EXCLUDED.data_saida,
            valor_contabil = EXCLUDED.valor_contabil,
            valor_desconto = EXCLUDED.valor_desconto,
            valor_frete = EXCLUDED.valor_frete,
            situacao = EXCLUDED.situacao,
            transacao = EXCLUDED.transacao,
            id_vendedor = EXCLUDED.id_vendedor,
            especie = EXCLUDED.especie,
            modelo_nota = EXCLUDED.modelo_nota,
            consumidor_final = EXCLUDED.consumidor_final,
            quantidade = EXCLUDED.quantidade,
            qtd_embalagens = EXCLUDED.qtd_embalagens,
            qtd_por_embalagem = EXCLUDED.qtd_por_embalagem,
            preco_cadastrado = EXCLUDED.preco_cadastrado,
            preco_digitado = EXCLUDED.preco_digitado,
            preco_final = EXCLUDED.preco_final,
            custo_unitario = EXCLUDED.custo_unitario,
            custo_sem_icms = EXCLUDED.custo_sem_icms,
            custo_medio = EXCLUDED.custo_medio,
            custo_fiscal_medio = EXCLUDED.custo_fiscal_medio,
            custo_com_encargos = EXCLUDED.custo_com_encargos,
            aliq_icms = EXCLUDED.aliq_icms,
            valor_ipi = EXCLUDED.valor_ipi,
            unidade_medida = EXCLUDED.unidade_medida,
            valor_desconto_item = EXCLUDED.valor_desconto_item,
            valor_acrescimo = EXCLUDED.valor_acrescimo,
            valor_st = EXCLUDED.valor_st,
            tipo_tributacao = EXCLUDED.tipo_tributacao,
            valor_icms = EXCLUDED.valor_icms,
            base_calculo_icms = EXCLUDED.base_calculo_icms,
            cancelado = EXCLUDED.cancelado,
            valor_frete_item = EXCLUDED.valor_frete_item,
            data_extracao = EXCLUDED.data_extracao
    ', p_schema_name);

    EXECUTE v_sql USING p_data_json;

END;
$_$;


--
-- Name: FUNCTION processar_carga_faturamento(p_data_json jsonb, p_schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.processar_carga_faturamento(p_data_json jsonb, p_schema_name text) IS 'Processa carga de dados de faturamento via upsert.
Recebe JSON com array de registros e nome do schema.
Faz upsert na tabela faturamento usando chave (id_saida, id_produto, ordem).';


--
-- Name: processar_carga_motivos_perda(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_motivos_perda(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_full_table_name TEXT;
BEGIN
    -- Constrói o nome completo da tabela com schema dinâmico
    v_full_table_name := format('%I.motivos_perda', p_schema_name);

    -- Log de início
    RAISE NOTICE 'Processando % motivos de perda para schema %', jsonb_array_length(p_data_json), p_schema_name;

    -- PRIMEIRO: Garante que o motivo ID 0 sempre existe (para perdas sem motivo informado)
    EXECUTE format('
        INSERT INTO %s (id, descricao, ativo, updated_at)
        VALUES (0, ''SEM MOTIVO INFORMADO'', true, NOW())
        ON CONFLICT (id) DO UPDATE SET
            descricao = ''SEM MOTIVO INFORMADO'',
            ativo = true,
            updated_at = NOW()
    ', v_full_table_name);

    RAISE NOTICE 'Motivo ID 0 garantido no schema %', p_schema_name;

    -- DEPOIS: Insert/Update dos motivos de perda vindos da API
    EXECUTE format('
        INSERT INTO %s (id, descricao, ativo, updated_at)
        SELECT
            (item->>''id'')::INTEGER,
            item->>''descricao'',
            COALESCE((item->>''ativo'')::BOOLEAN, true),
            NOW()
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (id) DO UPDATE SET
            descricao = EXCLUDED.descricao,
            updated_at = NOW()
    ', v_full_table_name)
    USING p_data_json;

    RAISE NOTICE 'Motivos de perda processados com sucesso';
END;
$_$;


--
-- Name: processar_carga_perdas(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_perdas(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_full_table_name TEXT;
    v_count INTEGER;
    v_error_detail TEXT;
BEGIN
    -- Constrói o nome completo da tabela com schema dinâmico
    v_full_table_name := format('%I.perdas', p_schema_name);

    -- Log de início
    v_count := jsonb_array_length(p_data_json);
    RAISE NOTICE 'Processando % registros de perdas para schema %', v_count, p_schema_name;

    -- Insert/Update das perdas com tratamento de erro
    BEGIN
        EXECUTE format('
            INSERT INTO %s (
                filial_id,
                produto_id,
                motivo_perda_id,
                data_perda,
                quantidade,
                valor_perda,
                data_extracao,
                created_at
            )
            SELECT
                (item->>''filialId'')::INTEGER,
                (item->>''produtoId'')::INTEGER,
                (item->>''motivoPerdaId'')::INTEGER,
                (item->>''dataPerda'')::DATE,
                (item->>''quantidade'')::NUMERIC(12,3),
                (item->>''valorPerda'')::NUMERIC(12,2),
                (item->>''dataExtracao'')::DATE,
                NOW()
            FROM jsonb_array_elements($1) AS item
            ON CONFLICT (filial_id, produto_id, data_perda, motivo_perda_id) DO UPDATE SET
                quantidade = EXCLUDED.quantidade,
                valor_perda = EXCLUDED.valor_perda,
                data_extracao = EXCLUDED.data_extracao
        ', v_full_table_name)
        USING p_data_json;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_detail = MESSAGE_TEXT;
        RAISE EXCEPTION 'Erro ao processar perdas no schema %: % | Detalhes: %',
            p_schema_name, SQLERRM, v_error_detail;
    END;

    RAISE NOTICE 'Perdas processadas com sucesso: % registros', v_count;
END;
$_$;


--
-- Name: processar_carga_tipos_despesa(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_tipos_despesa(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    -- UPSERT em batch para tipos de despesa
    EXECUTE format(
        'INSERT INTO %I.tipos_despesa (
            id, descricao, classificacao, vencimento_dia_nao_util, origem,
            obrigatoria_mes, departamentalizacao_nivel1, tipo_custo,
            tipo_requisicao, dia_mes, considera_despesa_real,
            considera_despesa_df, considera_despesa_custo_mensal, updated_at
        )
        SELECT
            (item->>''id'')::INTEGER,
            item->>''descricao'',
            item->>''classificacao'',
            item->>''vencimentoDiaNaoUtil'',
            item->>''origem'',
            COALESCE((item->>''obrigatoriaMes'')::BOOLEAN, false),
            (item->>''departamentalizacaoNivel1'')::INTEGER,
            item->>''tipoCusto'',
            item->>''tipoRequisicao'',
            COALESCE((item->>''diaMes'')::INTEGER, 0),
            COALESCE((item->>''consideraDespesaReal'')::BOOLEAN, false),
            COALESCE((item->>''consideraDespesaDF'')::BOOLEAN, false),
            COALESCE((item->>''consideraDespesaCustoMensal'')::BOOLEAN, false),
            NOW()
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (id)
        DO UPDATE SET
            descricao = EXCLUDED.descricao,
            classificacao = EXCLUDED.classificacao,
            vencimento_dia_nao_util = EXCLUDED.vencimento_dia_nao_util,
            origem = EXCLUDED.origem,
            obrigatoria_mes = EXCLUDED.obrigatoria_mes,
            departamentalizacao_nivel1 = EXCLUDED.departamentalizacao_nivel1,
            tipo_custo = EXCLUDED.tipo_custo,
            tipo_requisicao = EXCLUDED.tipo_requisicao,
            dia_mes = EXCLUDED.dia_mes,
            considera_despesa_real = EXCLUDED.considera_despesa_real,
            considera_despesa_df = EXCLUDED.considera_despesa_df,
            considera_despesa_custo_mensal = EXCLUDED.considera_despesa_custo_mensal,
            updated_at = NOW()',
        p_schema_name
    ) USING p_data_json;

    RAISE NOTICE 'Tipos de despesa carregados com sucesso (UPSERT)';
END;
$_$;


--
-- Name: FUNCTION processar_carga_tipos_despesa(p_data_json jsonb, p_schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.processar_carga_tipos_despesa(p_data_json jsonb, p_schema_name text) IS 'Carrega tipos de despesa usando UPSERT - insere novos ou atualiza existentes';


--
-- Name: processar_carga_vendas(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_vendas(data_json jsonb, schema_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '300s'
    AS $_$
DECLARE
  registros_inseridos INT;
BEGIN
  EXECUTE format('
    INSERT INTO %I.vendas (
      id_produto, filial_id, data_venda, id_oferta,
      quantidade, preco_medio, valor_vendas, aliquota_icms,
      custo_com_encargos, custo_sem_icms, custo_compra,
      custo_medio, custo_fiscal_medio, created_at, updated_at
    )
    SELECT
      (rec->>''id_produto'')::BIGINT,
      (rec->>''filial_id'')::BIGINT,
      (rec->>''data_venda'')::DATE,
      rec->>''id_oferta'',
      (rec->>''quantidade'')::NUMERIC,
      (rec->>''preco_medio'')::NUMERIC,
      (rec->>''valor_vendas'')::NUMERIC,
      (rec->>''aliquota_icms'')::NUMERIC,
      (rec->>''custo_com_encargos'')::NUMERIC,
      (rec->>''custo_sem_icms'')::NUMERIC,
      (rec->>''custo_compra'')::NUMERIC,
      (rec->>''custo_medio'')::NUMERIC,
      (rec->>''custo_fiscal_medio'')::NUMERIC,
      NOW(), NOW()
    FROM jsonb_array_elements($1) AS rec
    ON CONFLICT (id_produto, filial_id, data_venda, id_oferta)
    DO NOTHING
  ', schema_name) USING data_json;
  
  GET DIAGNOSTICS registros_inseridos = ROW_COUNT;
  RETURN format('Ins: %s', registros_inseridos);
END;
$_$;


--
-- Name: processar_carga_vendas_hoje(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_vendas_hoje(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    EXECUTE format('
        INSERT INTO %I.vendas_hoje (filial_id, cupom, caixa, horario, cancelada, valor_total, data_extracao)
        SELECT
            (item->>''filialId'')::INTEGER,
            (item->>''cupom'')::INTEGER,
            (item->>''caixa'')::INTEGER,
            (item->>''horario'')::TIME,
            COALESCE((item->>''cancelada'')::BOOLEAN, FALSE),
            COALESCE((item->>''valorTotal'')::DECIMAL(15,2), 0),
            (item->>''dataExtracao'')::DATE
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (filial_id, cupom) DO UPDATE SET
            caixa = EXCLUDED.caixa,
            horario = EXCLUDED.horario,
            cancelada = EXCLUDED.cancelada,
            valor_total = EXCLUDED.valor_total,
            data_extracao = EXCLUDED.data_extracao
    ', p_schema_name) USING p_data_json;
END;
$_$;


--
-- Name: processar_carga_vendas_hoje_itens(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_carga_vendas_hoje_itens(p_data_json jsonb, p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    EXECUTE format('
        INSERT INTO %I.vendas_hoje_itens (filial_id, cupom, produto_id, ordem, quantidade_vendida, preco_venda, valor_desconto, valor_acrescimo, cancelado, oferta_id, data_extracao)
        SELECT
            (item->>''filialId'')::INTEGER,
            (item->>''cupom'')::INTEGER,
            (item->>''produtoId'')::BIGINT,
            COALESCE((item->>''ordem'')::INTEGER, 1),
            COALESCE((item->>''quantidadeVendida'')::DECIMAL(15,3), 0),
            COALESCE((item->>''precoVenda'')::DECIMAL(15,2), 0),
            COALESCE((item->>''valorDesconto'')::DECIMAL(15,2), 0),
            COALESCE((item->>''valorAcrescimo'')::DECIMAL(15,2), 0),
            COALESCE((item->>''cancelado'')::BOOLEAN, FALSE),
            (item->>''idOferta'')::TEXT,
            (item->>''dataExtracao'')::DATE
        FROM jsonb_array_elements($1) AS item
        ON CONFLICT (filial_id, cupom, produto_id, ordem) DO UPDATE SET
            quantidade_vendida = EXCLUDED.quantidade_vendida,
            preco_venda = EXCLUDED.preco_venda,
            valor_desconto = EXCLUDED.valor_desconto,
            valor_acrescimo = EXCLUDED.valor_acrescimo,
            cancelado = EXCLUDED.cancelado,
            oferta_id = EXCLUDED.oferta_id,
            data_extracao = EXCLUDED.data_extracao
    ', p_schema_name) USING p_data_json;
END;
$_$;


--
-- Name: processar_produtos_em_staging(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.processar_produtos_em_staging() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    rows_in_staging INT;
    rows_affected INT;
BEGIN
    -- Verifica se há algo para processar
    SELECT COUNT(*) INTO rows_in_staging FROM paraiso.staging_produtos;
    IF rows_in_staging = 0 THEN
        RETURN 'Nenhum produto em staging para processar.';
    END IF;

    -- 1. Reconstrói o mapa de hierarquia (rápido com a tabela de departamentos já carregada)
    TRUNCATE TABLE paraiso.departamento_hierarquia;
    INSERT INTO paraiso.departamento_hierarquia
    WITH RECURSIVE department_paths AS (
        SELECT id AS original_id, id, parent_id, nivel FROM paraiso.departamentos
        UNION ALL
        SELECT p.original_id, d.id, d.parent_id, d.nivel FROM paraiso.departamentos d
        JOIN department_paths p ON p.parent_id = d.id
    )
    SELECT
        original_id,
        MAX(CASE WHEN nivel = 1 THEN id END), MAX(CASE WHEN nivel = 2 THEN id END),
        MAX(CASE WHEN nivel = 3 THEN id END), MAX(CASE WHEN nivel = 4 THEN id END),
        MAX(CASE WHEN nivel = 5 THEN id END), MAX(CASE WHEN nivel = 6 THEN id END)
    FROM department_paths
    GROUP BY original_id;

    -- 2. Insere/Atualiza na tabela de produção usando o mapa
    INSERT INTO paraiso.produtos (
        id, filial_id, descricao, ativo, balanca, unidade_de_medida, curva_abc, ultimo_fornecedor, 
        preco_de_venda_1, preco_de_venda_2, preco_de_custo, custo_real, custo_fiscal, custo_com_encargos, 
        custo_medio, estoque_atual, qtde_por_embalagem_ultima_entrada, data_cadastro, data_alteracao_preco,
        data_alteracao_custo, data_alteracao_cadastro, marca_id, classe_id, agrupamento_id, departamento_id,
        dep_nivel_1_id, dep_nivel_2_id, dep_nivel_3_id, dep_nivel_4_id, dep_nivel_5_id, dep_nivel_6_id
    )
    SELECT 
        s.id, s.filial_id, s.descricao, s.ativo, s.balanca, s.unidade_de_medida, s.curva_abc, s.ultimo_fornecedor,
        s.preco_de_venda_1, s.preco_de_venda_2, s.preco_de_custo, s.custo_real, s.custo_fiscal, s.custo_com_encargos,
        s.custo_medio, s.estoque_atual, s.qtde_por_embalagem_ultima_entrada, s.data_cadastro, s.data_alteracao_preco,
        s.data_alteracao_custo, s.data_alteracao_cadastro, s.marca_id, s.classe_id, s.agrupamento_id, s.departamento_id,
        h.dep_nivel_1_id, h.dep_nivel_2_id, h.dep_nivel_3_id, h.dep_nivel_4_id, h.dep_nivel_5_id, h.dep_nivel_6_id
    FROM paraiso.staging_produtos s
    LEFT JOIN paraiso.departamento_hierarquia h ON s.departamento_id = h.departamento_id
    ON CONFLICT (id, filial_id) DO UPDATE SET
        descricao = EXCLUDED.descricao, ativo = EXCLUDED.ativo, balanca = EXCLUDED.balanca, unidade_de_medida = EXCLUDED.unidade_de_medida,
        curva_abc = EXCLUDED.curva_abc, ultimo_fornecedor = EXCLUDED.ultimo_fornecedor, preco_de_venda_1 = EXCLUDED.preco_de_venda_1,
        preco_de_venda_2 = EXCLUDED.preco_de_venda_2, preco_de_custo = EXCLUDED.preco_de_custo, custo_real = EXCLUDED.custo_real,
        custo_fiscal = EXCLUDED.custo_fiscal, custo_com_encargos = EXCLUDED.custo_com_encargos, custo_medio = EXCLUDED.custo_medio,
        estoque_atual = EXCLUDED.estoque_atual, qtde_por_embalagem_ultima_entrada = EXCLUDED.qtde_por_embalagem_ultima_entrada,
        data_cadastro = EXCLUDED.data_cadastro, data_alteracao_preco = EXCLUDED.data_alteracao_preco,
        data_alteracao_custo = EXCLUDED.data_alteracao_custo, data_alteracao_cadastro = EXCLUDED.data_alteracao_cadastro,
        marca_id = EXCLUDED.marca_id, classe_id = EXCLUDED.classe_id, agrupamento_id = EXCLUDED.agrupamento_id,
        departamento_id = EXCLUDED.departamento_id, dep_nivel_1_id = EXCLUDED.dep_nivel_1_id,
        dep_nivel_2_id = EXCLUDED.dep_nivel_2_id, dep_nivel_3_id = EXCLUDED.dep_nivel_3_id,
        dep_nivel_4_id = EXCLUDED.dep_nivel_4_id, dep_nivel_5_id = EXCLUDED.dep_nivel_5_id,
        dep_nivel_6_id = EXCLUDED.dep_nivel_6_id, updated_at = NOW();
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    -- 3. Limpa a staging para a próxima execução
    TRUNCATE TABLE paraiso.staging_produtos;
    
    RETURN 'Processados ' || rows_affected || ' produtos a partir do staging.';
END;
$$;


--
-- Name: rebuild_sales_summary(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_sales_summary(schema_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '300s'
    AS $$
BEGIN
  EXECUTE format('TRUNCATE TABLE %I.vendas_diarias_por_filial;', schema_name);
  EXECUTE format('INSERT INTO %I.vendas_diarias_por_filial (filial_id, data_venda, valor_total, quantidade_total, total_transacoes) SELECT filial_id, data_venda, SUM(valor_vendas), SUM(quantidade), COUNT(*) FROM %I.vendas GROUP BY filial_id, data_venda;', schema_name, schema_name, schema_name);
  RETURN 'Tabela de resumo de vendas para o schema ' || schema_name || ' reconstruída com sucesso.';
END;
$$;


--
-- Name: refresh_report_curva_abcd(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_report_curva_abcd(p_schema_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- 1. Variável para capturar o tempo de início
    start_time timestamptz := clock_timestamp();
BEGIN
    -- Comando principal para atualizar a view
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I.vw_report_curva_abcd;', p_schema_name);

    -- 2. Registra o SUCESSO na sua tabela de logs
    PERFORM public.log_job(
        'refresh_report_curva_abcd', -- Nome da função/job
        p_schema_name,               -- Contexto (schema)
        'SUCCESS',                   -- Status da execução
        'Materialized View vw_report_curva_abcd atualizada.', -- Mensagem
        start_time                   -- Tempo de início para calcular a duração
    );

    RETURN format('Visão vw_report_curva_abcd para o schema %L atualizada.', p_schema_name);

EXCEPTION
    -- 3. Captura QUALQUER erro que possa ocorrer
    WHEN OTHERS THEN
        -- Registra o ERRO na sua tabela de logs
        PERFORM public.log_job(
            'refresh_report_curva_abcd', -- Nome da função/job
            p_schema_name,               -- Contexto (schema)
            'ERROR',                     -- Status da execução
            SQLERRM,                     -- Mensagem de erro capturada pelo sistema
            start_time                   -- Tempo de início
        );

        -- Re-lança o erro para interromper a transação
        RAISE;
END;
$$;


--
-- Name: refresh_vendas_agregadas_30d(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_vendas_agregadas_30d(p_schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    dyn_sql text;
    start_time timestamptz := clock_timestamp();
BEGIN
    -- <<< ALTERAÇÃO AQUI >>>
    -- Aumenta o timeout para 10 minutos (600s) APENAS para esta transação.
    SET statement_timeout = '600s';

    -- Monta o comando dinâmico para dar refresh na materialized view
    dyn_sql := format('REFRESH MATERIALIZED VIEW %I.vendas_agregadas_30d;', p_schema_name);

    -- Executa o comando
    EXECUTE dyn_sql;

    -- Grava o log de sucesso
    PERFORM public.log_job(
        'refresh_vendas_agregadas_30d',
        p_schema_name,
        'SUCCESS',
        'Materialized view atualizada com sucesso.',
        start_time
    );

EXCEPTION
    -- Em caso de erro, grava o log de falha
    WHEN OTHERS THEN
        PERFORM public.log_job(
            'refresh_vendas_agregadas_30d',
            p_schema_name,
            'ERROR',
            SQLERRM,
            start_time
        );
        RAISE; -- Re-lança o erro
END;
$$;


--
-- Name: refresh_vendas_agregadas_60d(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_vendas_agregadas_60d(p_schema_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    dyn_sql text;
    start_time timestamptz := clock_timestamp();
    rows_count bigint;
BEGIN
    -- Aumenta o timeout para 10 minutos (600s) APENAS para esta transação
    SET statement_timeout = '600s';
    
    -- Monta o comando dinâmico para dar refresh na materialized view
    dyn_sql := format('REFRESH MATERIALIZED VIEW %I.vendas_agregadas_60d;', p_schema_name);
    
    -- Executa o comando
    EXECUTE dyn_sql;
    
    -- Conta quantos registros foram gerados (opcional, para log)
    EXECUTE format('SELECT COUNT(*) FROM %I.vendas_agregadas_60d', p_schema_name) 
    INTO rows_count;
    
    -- Grava o log de sucesso
    PERFORM public.log_job(
        'refresh_vendas_agregadas_60d',
        p_schema_name,
        'SUCCESS',
        format('Materialized view atualizada com sucesso. %s registros gerados.', rows_count),
        start_time
    );
    
    RETURN format('MV vendas_agregadas_60d atualizada com sucesso em %s segundos. %s registros.',
                  EXTRACT(EPOCH FROM (clock_timestamp() - start_time))::INT,
                  rows_count);
EXCEPTION
    -- Em caso de erro, grava o log de falha
    WHEN OTHERS THEN
        PERFORM public.log_job(
            'refresh_vendas_agregadas_60d',
            p_schema_name,
            'ERROR',
            SQLERRM,
            start_time
        );
        RAISE; -- Re-lança o erro
END;
$$;


--
-- Name: FUNCTION refresh_vendas_agregadas_60d(p_schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.refresh_vendas_agregadas_60d(p_schema_name text) IS 'Atualiza a Materialized View vendas_agregadas_60d para o schema especificado';


--
-- Name: refresh_vw_relatorio_ruptura_estoque(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_vw_relatorio_ruptura_estoque() RETURNS void
    LANGUAGE sql
    AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY paraiso.vw_relatorio_ruptura_estoque;
$$;


--
-- Name: refresh_vw_relatorio_sem_venda_recente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_vw_relatorio_sem_venda_recente() RETURNS void
    LANGUAGE sql
    AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY paraiso.vw_relatorio_sem_venda_recente;
$$;


--
-- Name: registrar_execucao(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_execucao(registros_json jsonb, schema_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_sql text;
BEGIN
    -- Construir SQL dinâmico com o schema correto
    v_sql := format(
        'INSERT INTO %I.etl_controle (
            filial_id,
            data_execucao,
            processo_nome,  -- ✅ ADICIONAR processo_nome
            status,
            executado_em,
            total_departamentos,
            total_produtos,
            total_vendas  -- ✅ ADICIONAR total_vendas
        )
        SELECT
            (rec->>''filial_id'')::BIGINT,
            (rec->>''data_execucao'')::DATE,
            rec->>''processo_nome'',  -- ✅ ADICIONAR
            rec->>''status'',
            NOW(),
            COALESCE((rec->>''total_departamentos'')::INT, 0),
            COALESCE((rec->>''total_produtos'')::INT, 0),
            COALESCE((rec->>''total_vendas'')::INT, 0)  -- ✅ ADICIONAR
        FROM jsonb_array_elements($1) AS rec
        ON CONFLICT (filial_id, data_execucao, processo_nome)  -- ✅ TODAS AS 3 COLUNAS!
        DO UPDATE SET
            status = EXCLUDED.status,
            executado_em = EXCLUDED.executado_em,
            total_departamentos = EXCLUDED.total_departamentos,
            total_produtos = EXCLUDED.total_produtos,
            total_vendas = EXCLUDED.total_vendas',  -- ✅ ADICIONAR
        schema_name
    );
    
    -- Executar o SQL dinâmico
    EXECUTE v_sql USING registros_json;
    
    RETURN 'Registro de execução concluído para o schema ' || schema_name || '.';
END;
$_$;


--
-- Name: FUNCTION registrar_execucao(registros_json jsonb, schema_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.registrar_execucao(registros_json jsonb, schema_name text) IS 'Registra ou atualiza execuções do ETL na tabela etl_controle do schema especificado';


--
-- Name: reprocessar_vendas_mensais_por_cliente(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reprocessar_vendas_mensais_por_cliente(p_schema_name text, p_cliente_id text, p_ano integer, p_mes integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    mes_inicio DATE;
    mes_fim DATE;
BEGIN
    -- Calcula o primeiro e o último dia do mês/ano fornecido
    mes_inicio := make_date(p_ano, p_mes, 1);
    mes_fim := (mes_inicio + INTERVAL '1 month') - INTERVAL '1 day';

    RAISE NOTICE 'Reprocessando dados para o cliente % no período de % a %', p_cliente_id, mes_inicio, mes_fim;

    -- 1. Apaga os dados antigos APENAS para o mês/ano especificado
    RAISE NOTICE 'Deletando dados antigos da tabela %I.vendas_produto_mes...', p_schema_name;
    EXECUTE format(
        'DELETE FROM %I.vendas_produto_mes WHERE mes_referencia = %L;',
        p_schema_name, mes_inicio
    );

    -- 2. Recalcula e insere os novos dados para o mesmo período
    RAISE NOTICE 'Recalculando e inserindo novos dados...';
    EXECUTE format('
        INSERT INTO %I.vendas_produto_mes (
            mes_referencia,
            filial_id,
            id_produto,
            quantidade_total,
            valor_total,
            ticket_medio,
            updated_at
        )
        SELECT
            date_trunc(''month'', v.data_venda)::date,
            v.filial_id,
            v.id_produto,
            SUM(v.quantidade) AS quantidade_total,
            SUM(v.valor_vendas) AS valor_total,
            SUM(v.valor_vendas) / SUM(v.quantidade) AS ticket_medio,
            NOW()
        FROM
            %I.vendas v
        WHERE
            v.data_venda BETWEEN %L::DATE AND %L::DATE
        GROUP BY
            date_trunc(''month'', v.data_venda),
            v.filial_id,
            v.id_produto;
    ', p_schema_name, p_schema_name, mes_inicio, mes_fim);

    -- 3. (IMPORTANTE) Atualiza a Visão Materializada para refletir a mudança
    RAISE NOTICE 'Atualizando a visão materializada %I.vw_report_curva_abcd...', p_schema_name; -- <<< CORREÇÃO AQUI
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I.vw_report_curva_abcd;', p_schema_name);

    RETURN format('Reprocessamento para %s no mês %s/%s concluído.', p_cliente_id, p_mes, p_ano);
END;
$$;


--
-- Name: set_superadmin_tenant_null(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_superadmin_tenant_null() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.role = 'superadmin' THEN
    NEW.tenant_id = NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION set_superadmin_tenant_null(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_superadmin_tenant_null() IS 'Automaticamente define tenant_id = NULL quando role = superadmin';


--
-- Name: setup_criar_mvs_clientes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.setup_criar_mvs_clientes() RETURNS text
    LANGUAGE plpgsql
    AS $_$
DECLARE
    schema_rec RECORD;
    query_text TEXT;
BEGIN
    -- MUDANÇA CRÍTICA: Em vez de excluir, agora incluímos APENAS os schemas de clientes.
    FOR schema_rec IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name IN ('okilao', 'paraiso', 'saoluiz') -- << ESTRATÉGIA CORRIGIDA
    LOOP
        RAISE NOTICE 'Processando setup para o schema: %', schema_rec.schema_name;

        EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.vendas_agregadas_60d CASCADE;', schema_rec.schema_name);

        query_text := format(
            $CREATE_MV$
            CREATE MATERIALIZED VIEW %I.vendas_agregadas_60d AS
            SELECT
                p.id as id_produto, p.filial_id, p.departamento_id,
                SUM(v.valor_vendas) as total_valor_produto
            FROM %I.vendas v
            JOIN %I.produtos p ON v.id_produto = p.id AND v.filial_id = p.filial_id
            WHERE v.data_venda >= (CURRENT_DATE - interval '60 days') AND v.data_venda < CURRENT_DATE
              AND v.valor_vendas > 0
            GROUP BY p.id, p.filial_id, p.departamento_id;
            $CREATE_MV$,
            schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name
        );
        EXECUTE query_text;

        EXECUTE format('CREATE UNIQUE INDEX idx_vendas_agregadas_pk ON %I.vendas_agregadas_60d (filial_id, id_produto);', schema_rec.schema_name);
        EXECUTE format('CREATE INDEX idx_vendas_agregadas_calculo ON %I.vendas_agregadas_60d (filial_id, departamento_id, total_valor_produto DESC);', schema_rec.schema_name);

        RAISE NOTICE '✔️ Visão Materializada e índices criados para o schema %.', schema_rec.schema_name;
    END LOOP;

    RETURN 'Setup das visões materializadas concluído para os schemas de clientes.';
END;
$_$;


--
-- Name: truncate_table(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.truncate_table(schema_name text, table_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE format('TRUNCATE TABLE %I.%I;', schema_name, table_name);
  RETURN table_name || ' truncada com sucesso.';
END;
$$;


--
-- Name: update_branches_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_branches_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_desconto_venda(text, uuid, integer, date, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_desconto_venda(p_schema text, p_id uuid, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_observacao text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_result json;
BEGIN
  -- Validar valor
  IF p_valor_desconto < 0 THEN
    RAISE EXCEPTION 'Valor do desconto deve ser maior ou igual a zero';
  END IF;

  -- Atualizar desconto
  EXECUTE format('
    UPDATE %I.descontos_venda
    SET 
      filial_id = $2,
      data_desconto = $3,
      valor_desconto = $4,
      observacao = $5,
      updated_at = NOW()
    WHERE id = $1
    RETURNING json_build_object(
      ''id'', id,
      ''filial_id'', filial_id,
      ''data_desconto'', data_desconto,
      ''valor_desconto'', valor_desconto,
      ''observacao'', observacao,
      ''created_at'', created_at,
      ''updated_at'', updated_at,
      ''created_by'', created_by
    )
  ', p_schema)
  USING p_id, p_filial_id, p_data_desconto, p_valor_desconto, p_observacao
  INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Desconto não encontrado';
  END IF;
  
  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um desconto lançado para esta filial nesta data';
END;
$_$;


--
-- Name: update_desconto_venda(text, uuid, integer, date, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_desconto_venda(p_schema text, p_id uuid, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_desconto_custo numeric, p_observacao text DEFAULT NULL::text) RETURNS TABLE(id uuid, filial_id integer, data_desconto date, valor_desconto numeric, desconto_custo numeric, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  -- Atualizar desconto
  EXECUTE format(
    'UPDATE %I.descontos_venda
    SET 
      filial_id = $2,
      data_desconto = $3,
      valor_desconto = $4,
      desconto_custo = $5,
      observacao = $6,
      updated_at = NOW()
    WHERE id = $1',
    p_schema
  ) USING p_id, p_filial_id, p_data_desconto, p_valor_desconto, p_desconto_custo, p_observacao;
  
  -- Retornar registro atualizado
  RETURN QUERY EXECUTE format(
    'SELECT 
      id, filial_id, data_desconto, valor_desconto, desconto_custo, observacao, created_at, updated_at
    FROM %I.descontos_venda
    WHERE id = $1',
    p_schema
  ) USING p_id;
END;
$_$;


--
-- Name: FUNCTION update_desconto_venda(p_schema text, p_id uuid, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_desconto_custo numeric, p_observacao text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_desconto_venda(p_schema text, p_id uuid, p_filial_id integer, p_data_desconto date, p_valor_desconto numeric, p_desconto_custo numeric, p_observacao text) IS 'Atualiza um desconto_venda existente em um schema específico';


--
-- Name: update_meta_mensal(text, integer, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_meta_mensal(p_schema text, p_meta_id integer, p_valor_meta numeric, p_meta_percentual numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_sql TEXT;
  v_id INTEGER;
  v_valor_meta NUMERIC;
  v_meta_percentual NUMERIC;
  v_valor_realizado NUMERIC;
  v_custo_realizado NUMERIC;
  v_lucro_realizado NUMERIC;
  v_diferenca NUMERIC;
  v_diferenca_percentual NUMERIC;
  v_rows_updated INT;
BEGIN
  -- Validar schema
  IF p_schema IS NULL OR p_schema = '' THEN
    RAISE EXCEPTION 'Schema não pode ser vazio';
  END IF;

  -- Validar meta_id
  IF p_meta_id IS NULL THEN
    RAISE EXCEPTION 'ID da meta não pode ser vazio';
  END IF;

  -- Buscar valor_realizado, custo e lucro atuais antes do update
  v_sql := format('
    SELECT 
      COALESCE(valor_realizado, 0),
      COALESCE(custo_realizado, 0),
      COALESCE(lucro_realizado, 0)
    FROM %I.metas_mensais
    WHERE id = $1
  ', p_schema);

  EXECUTE v_sql
  INTO v_valor_realizado, v_custo_realizado, v_lucro_realizado
  USING p_meta_id;

  -- Se não encontrou o registro, retornar erro
  IF v_valor_realizado IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Meta não encontrada com ID: ' || p_meta_id
    );
  END IF;

  -- Calcular diferenças com os novos valores
  v_diferenca := v_valor_realizado - COALESCE(p_valor_meta, 0);
  v_diferenca_percentual := CASE
    WHEN COALESCE(p_valor_meta, 0) > 0 THEN (v_diferenca / p_valor_meta) * 100
    ELSE 0
  END;

  -- Construir e executar query de update
  v_sql := format('
    UPDATE %I.metas_mensais
    SET 
      valor_meta = $1,
      meta_percentual = $2,
      diferenca = $3,
      diferenca_percentual = $4,
      updated_at = NOW()
    WHERE id = $5
    RETURNING id, valor_meta, meta_percentual, diferenca, diferenca_percentual
  ', p_schema);

  -- Executar update
  EXECUTE v_sql
  USING p_valor_meta, p_meta_percentual, v_diferenca, v_diferenca_percentual, p_meta_id
  INTO v_id, v_valor_meta, v_meta_percentual, v_diferenca, v_diferenca_percentual;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- Verificar se atualizou
  IF v_rows_updated = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Nenhum registro foi atualizado. Meta ID: ' || p_meta_id
    );
  END IF;

  -- Retornar resultado com sucesso
  RETURN json_build_object(
    'success', true,
    'message', 'Meta atualizada com sucesso',
    'data', json_build_object(
      'id', v_id,
      'valor_meta', v_valor_meta,
      'meta_percentual', v_meta_percentual,
      'diferenca', v_diferenca,
      'diferenca_percentual', v_diferenca_percentual
    ),
    'calculated', json_build_object(
      'valor_realizado', v_valor_realizado,
      'custo_realizado', v_custo_realizado,
      'lucro_realizado', v_lucro_realizado
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$_$;


--
-- Name: FUNCTION update_meta_mensal(p_schema text, p_meta_id integer, p_valor_meta numeric, p_meta_percentual numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_meta_mensal(p_schema text, p_meta_id integer, p_valor_meta numeric, p_meta_percentual numeric) IS 'Atualiza uma meta mensal individual.
Parâmetros:
  - p_schema: Schema do tenant
  - p_meta_id: ID da meta (INTEGER, não UUID)
  - p_valor_meta: Novo valor da meta
  - p_meta_percentual: Novo percentual da meta
Retorna: JSON com success, message, data e calculated';


--
-- Name: update_meta_setor(text, integer, integer, date, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_meta_setor(p_schema text, p_setor_id integer, p_filial_id integer, p_data date, p_meta_percentual numeric, p_valor_meta numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  DECLARE
    v_sql TEXT;
    v_result JSON;
    v_valor_realizado NUMERIC;
    v_diferenca NUMERIC;
    v_diferenca_percentual NUMERIC;
    v_rows_updated INT;
  BEGIN
    -- Validações...
    IF p_schema IS NULL OR p_schema = '' THEN
      RAISE EXCEPTION 'Schema não pode ser vazio';
    END IF;

    -- Buscar valor_realizado atual
    EXECUTE format('
      SELECT COALESCE(valor_realizado, 0)
      FROM %I.metas_setor
      WHERE setor_id = $1 AND filial_id = $2 AND data = $3
    ', p_schema)
    INTO v_valor_realizado
    USING p_setor_id, p_filial_id, p_data;

    IF v_valor_realizado IS NULL THEN
      v_valor_realizado := 0;
    END IF;

    -- Calcular diferenças
    v_diferenca := v_valor_realizado - COALESCE(p_valor_meta, 0);
    v_diferenca_percentual := CASE
      WHEN COALESCE(p_valor_meta, 0) > 0 THEN (v_diferenca / p_valor_meta) * 100
      ELSE 0
    END;

    -- UPDATE com diferenças
    v_sql := format('
      UPDATE %I.metas_setor
      SET meta_percentual = $1, valor_meta = $2, diferenca = $3, diferenca_percentual = $4, updated_at = NOW()
      WHERE setor_id = $5 AND filial_id = $6 AND data = $7
      RETURNING setor_id, filial_id, data, meta_percentual, valor_meta, diferenca, diferenca_percentual
    ', p_schema);

    EXECUTE v_sql
    USING p_meta_percentual, p_valor_meta, v_diferenca, v_diferenca_percentual, p_setor_id, p_filial_id, p_data
    INTO v_result;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      RETURN json_build_object('success', false, 'error', 'Nenhum registro encontrado');
    END IF;

    RETURN json_build_object(
      'success', true,
      'message', 'Meta de setor atualizada com sucesso',
      'data', v_result,
      'calculated', json_build_object('valor_realizado', v_valor_realizado, 'diferenca', v_diferenca, 'diferenca_percentual', v_diferenca_percentual)
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', SQLERRM);
  END;
  $_$;


--
-- Name: FUNCTION update_meta_setor(p_schema text, p_setor_id integer, p_filial_id integer, p_data date, p_meta_percentual numeric, p_valor_meta numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_meta_setor(p_schema text, p_setor_id integer, p_filial_id integer, p_data date, p_meta_percentual numeric, p_valor_meta numeric) IS 'Atualiza meta_percentual e valor_meta de uma meta de setor específica em qualquer schema';


--
-- Name: update_tenant_parameters_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tenant_parameters_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_tenants_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tenants_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: upsert_departments_final(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_final(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    EXECUTE format('
        INSERT INTO %I.departments (source_id, source_level, description, parent_id, parent_source_id, parent_source_level)
        SELECT
            (d->>''source_id'')::integer,
            (d->>''source_level'')::integer,
            d->>''description'',
            (d->>''parent_id'')::integer,
            (d->>''parent_source_id'')::integer,
            (d->>''parent_source_level'')::integer
        FROM jsonb_array_elements(%L) AS d
        ON CONFLICT (source_id, source_level) DO UPDATE SET
            description = EXCLUDED.description,
            parent_id = EXCLUDED.parent_id,
            parent_source_id = EXCLUDED.parent_source_id,
            parent_source_level = EXCLUDED.parent_source_level,
            updated_at = NOW();
    ', schema_name, data_json);
END;
$$;


--
-- Name: upsert_departments_l1(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_l1(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('
    INSERT INTO %I.departments_level_1 (
      id,
      departamento_id,
      pai_level_2_id,
      descricao,
      created_at
    )
    SELECT 
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''pai_level_2_id'')::BIGINT,
      elem->>''descricao'',
      NOW()
    FROM jsonb_array_elements($1) AS elem
    WHERE (elem->>''departamento_id'') IS NOT NULL
    ON CONFLICT (id)
    DO UPDATE SET
      departamento_id = EXCLUDED.departamento_id,
      descricao = EXCLUDED.descricao,
      pai_level_2_id = EXCLUDED.pai_level_2_id,
      created_at = NOW()
  ', schema_name)
  USING data_json;
END;
$_$;


--
-- Name: upsert_departments_l2(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_l2(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('
    INSERT INTO %I.departments_level_2 (
      id,
      departamento_id,
      pai_level_3_id,
      descricao,
      created_at
    )
    SELECT 
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''pai_level_3_id'')::BIGINT,
      elem->>''descricao'',
      NOW()
    FROM jsonb_array_elements($1) AS elem
    WHERE (elem->>''departamento_id'') IS NOT NULL
    ON CONFLICT (id)
    DO UPDATE SET
      departamento_id = EXCLUDED.departamento_id,
      descricao = EXCLUDED.descricao,
      pai_level_3_id = EXCLUDED.pai_level_3_id,
      created_at = NOW()
  ', schema_name)
  USING data_json;
END;
$_$;


--
-- Name: upsert_departments_l3(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_l3(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('
    INSERT INTO %I.departments_level_3 (
      id,
      departamento_id,
      pai_level_4_id,
      descricao,
      created_at
    )
    SELECT 
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''pai_level_4_id'')::BIGINT,
      elem->>''descricao'',
      NOW()
    FROM jsonb_array_elements($1) AS elem
    WHERE (elem->>''departamento_id'') IS NOT NULL
    ON CONFLICT (id)
    DO UPDATE SET
      departamento_id = EXCLUDED.departamento_id,
      descricao = EXCLUDED.descricao,
      pai_level_4_id = EXCLUDED.pai_level_4_id,
      created_at = NOW()
  ', schema_name)
  USING data_json;
END;
$_$;


--
-- Name: upsert_departments_l4(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_l4(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('
    INSERT INTO %I.departments_level_4 (
      id,
      departamento_id,
      pai_level_5_id,
      descricao,
      created_at
    )
    SELECT 
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''pai_level_5_id'')::BIGINT,
      elem->>''descricao'',
      NOW()
    FROM jsonb_array_elements($1) AS elem
    WHERE (elem->>''departamento_id'') IS NOT NULL
    ON CONFLICT (id)
    DO UPDATE SET
      departamento_id = EXCLUDED.departamento_id,
      descricao = EXCLUDED.descricao,
      pai_level_5_id = EXCLUDED.pai_level_5_id,
      created_at = NOW()
  ', schema_name)
  USING data_json;
END;
$_$;


--
-- Name: upsert_departments_l5(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_l5(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('
    INSERT INTO %I.departments_level_5 (
      id,
      departamento_id,
      pai_level_6_id,
      descricao,
      created_at
    )
    SELECT 
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''pai_level_6_id'')::BIGINT,
      elem->>''descricao'',
      NOW()
    FROM jsonb_array_elements($1) AS elem
    WHERE (elem->>''departamento_id'') IS NOT NULL
    ON CONFLICT (id)
    DO UPDATE SET
      departamento_id = EXCLUDED.departamento_id,
      descricao = EXCLUDED.descricao,
      pai_level_6_id = EXCLUDED.pai_level_6_id,
      created_at = NOW()
  ', schema_name)
  USING data_json;
END;
$_$;


--
-- Name: upsert_departments_l6(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_l6(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('
    INSERT INTO %I.departments_level_6 (
      id,
      departamento_id,
      descricao,
      created_at
    )
    SELECT 
      (elem->>''departamento_id'')::BIGINT,
      (elem->>''departamento_id'')::BIGINT,
      elem->>''descricao'',
      NOW()
    FROM jsonb_array_elements($1) AS elem
    WHERE (elem->>''departamento_id'') IS NOT NULL
    ON CONFLICT (id)
    DO UPDATE SET
      departamento_id = EXCLUDED.departamento_id,
      descricao = EXCLUDED.descricao,
      created_at = NOW()
  ', schema_name)
  USING data_json;
END;
$_$;


--
-- Name: upsert_departments_level_1(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_level_1(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('TRUNCATE TABLE %I.departments RESTART IDENTITY CASCADE;', schema_name);
  EXECUTE format(
    'INSERT INTO %I.departments (departamento_id, descricao, nivel, departamentalizacaoNivel2, departamento_pai)
     SELECT
       (d->>''departamento_id'')::BIGINT,
       d->>''descricao'',
       (d->>''nivel'')::INT,
       (d->>''departamentalizacaoNivel2'')::BIGINT,
       (d->>''departamento_pai'')::BIGINT
     FROM jsonb_array_elements($1) AS d',
    schema_name
  ) USING data_json;
END;
$_$;


--
-- Name: upsert_departments_level_2(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_departments_level_2(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  EXECUTE format('TRUNCATE TABLE %I.departments_nivel_2 RESTART IDENTITY CASCADE;', schema_name);
  EXECUTE format(
    'INSERT INTO %I.departments_nivel_2 (departamento_id, descricao, nivel)
     SELECT
       (d->>''departamento_id'')::BIGINT,
       d->>''descricao'',
       (d->>''nivel'')::INT
     FROM jsonb_array_elements($1) AS d',
    schema_name
  ) USING data_json;
END;
$_$;


--
-- Name: upsert_produtos(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_produtos(data_json jsonb, schema_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
    EXECUTE format(
        'INSERT INTO %I.produtos (' ||
        '    id, filial_id, descricao, ativo, balanca, unidade_de_medida, curva_abc,' ||
        '    ultimo_fornecedor, preco_de_venda_1, preco_de_venda_2, preco_de_custo, custo_real,' ||
        '    custo_fiscal, custo_com_encargos, custo_medio, estoque_atual, ' ||
        '    qtde_por_embalagem_ultima_entrada, data_cadastro, data_alteracao_preco,' ||
        '    data_alteracao_custo, data_alteracao_cadastro, marca_id, classe_id, ' ||
        '    agrupamento_id, departamento_id' ||
        ') SELECT ' ||
        '    (rec->>''id'')::BIGINT, (rec->>''filial_id'')::INT, rec->>''descricao'', ' ||
        '    (rec->>''ativo'')::BOOLEAN, (rec->>''balanca'')::BOOLEAN, rec->>''unidade_de_medida'', ' ||
        '    rec->>''curva_abc'', (rec->>''ultimo_fornecedor'')::BIGINT, (rec->>''preco_de_venda_1'')::NUMERIC, ' ||
        '    (rec->>''preco_de_venda_2'')::NUMERIC, (rec->>''preco_de_custo'')::NUMERIC, ' ||
        '    (rec->>''custo_real'')::NUMERIC, (rec->>''custo_fiscal'')::NUMERIC, ' ||
        '    (rec->>''custo_com_encargos'')::NUMERIC, (rec->>''custo_medio'')::NUMERIC, ' ||
        '    (rec->>''estoque_atual'')::NUMERIC, (rec->>''qtde_por_embalagem_ultima_entrada'')::NUMERIC, ' ||
        '    (rec->>''data_cadastro'')::TIMESTAMPTZ, (rec->>''data_alteracao_preco'')::TIMESTAMPTZ, ' ||
        '    (rec->>''data_alteracao_custo'')::TIMESTAMPTZ, (rec->>''data_alteracao_cadastro'')::TIMESTAMPTZ, ' ||
        '    (rec->>''marca_id'')::BIGINT, (rec->>''classe_id'')::BIGINT, ' ||
        '    (rec->>''agrupamento_id'')::BIGINT, (rec->>''departamento_id'')::BIGINT ' ||
        'FROM jsonb_array_elements($1) AS rec ' ||
        'ON CONFLICT (id, filial_id) DO UPDATE SET ' ||
        '    descricao = EXCLUDED.descricao, ativo = EXCLUDED.ativo, balanca = EXCLUDED.balanca, ' ||
        '    unidade_de_medida = EXCLUDED.unidade_de_medida, curva_abc = EXCLUDED.curva_abc, ' ||
        '    ultimo_fornecedor = EXCLUDED.ultimo_fornecedor, preco_de_venda_1 = EXCLUDED.preco_de_venda_1, ' ||
        '    preco_de_venda_2 = EXCLUDED.preco_de_venda_2, preco_de_custo = EXCLUDED.preco_de_custo, ' ||
        '    custo_real = EXCLUDED.custo_real, custo_fiscal = EXCLUDED.custo_fiscal, ' ||
        '    custo_com_encargos = EXCLUDED.custo_com_encargos, custo_medio = EXCLUDED.custo_medio, ' ||
        '    estoque_atual = EXCLUDED.estoque_atual, ' ||
        '    qtde_por_embalagem_ultima_entrada = EXCLUDED.qtde_por_embalagem_ultima_entrada, ' ||
        '    data_cadastro = EXCLUDED.data_cadastro, data_alteracao_preco = EXCLUDED.data_alteracao_preco, ' ||
        '    data_alteracao_custo = EXCLUDED.data_alteracao_custo, ' ||
        '    data_alteracao_cadastro = EXCLUDED.data_alteracao_cadastro, marca_id = EXCLUDED.marca_id, ' ||
        '    classe_id = EXCLUDED.classe_id, agrupamento_id = EXCLUDED.agrupamento_id, ' ||
        '    departamento_id = EXCLUDED.departamento_id, updated_at = NOW();',
        schema_name
    ) USING data_json;
END;
$_$;


--
-- Name: user_has_branch_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_branch_access(p_user_id uuid, p_branch_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_has_restrictions BOOLEAN;
  v_has_access BOOLEAN;
BEGIN
  -- Check if user has any branch restrictions
  SELECT EXISTS (
    SELECT 1 FROM public.user_authorized_branches
    WHERE user_id = p_user_id
  ) INTO v_has_restrictions;

  -- If no restrictions, user has access to all branches
  IF NOT v_has_restrictions THEN
    RETURN TRUE;
  END IF;

  -- Check if user has access to this specific branch
  SELECT EXISTS (
    SELECT 1 FROM public.user_authorized_branches
    WHERE user_id = p_user_id AND branch_id = p_branch_id
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;


--
-- Name: FUNCTION user_has_branch_access(p_user_id uuid, p_branch_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_has_branch_access(p_user_id uuid, p_branch_id uuid) IS 'Checks if user has access to a specific branch. Returns true if no restrictions or if branch is authorized.';


--
-- Name: user_has_module_access(uuid, public.system_module); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_module_access(p_user_id uuid, p_module public.system_module) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
  v_has_access boolean;
BEGIN
  -- Obter role do usuário
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = p_user_id;

  -- Superadmin e Admin sempre têm acesso
  IF v_role IN ('superadmin', 'admin') THEN
    RETURN true;
  END IF;

  -- Para role = user, verificar na tabela
  IF v_role = 'user' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_authorized_modules
      WHERE user_id = p_user_id
      AND module = p_module
    ) INTO v_has_access;

    RETURN v_has_access;
  END IF;

  -- Viewer não tem acesso por padrão (ou pode ter lógica específica)
  RETURN false;
END;
$$;


--
-- Name: FUNCTION user_has_module_access(p_user_id uuid, p_module public.system_module); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_has_module_access(p_user_id uuid, p_module public.system_module) IS 'Verifica se um usuário tem acesso a um módulo específico. Superadmin e Admin sempre têm acesso full.';


--
-- Name: validar_mv_schemas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_mv_schemas() RETURNS TABLE(schema_name text, mv_name text, expected_schema text, actual_schema text, status text)
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RETURN QUERY
    SELECT
      m.schemaname::text,
      m.matviewname::text,
      m.schemaname::text AS expected,
      -- Regex ajustada para capturar schema com ou sem parenteses
      (regexp_match(m.definition, '(?:FROM|from)\s*\(?(\w+)\.vendas', 'i'))[1]::text AS actual,
      CASE
        WHEN m.schemaname = (regexp_match(m.definition, '(?:FROM|from)\s*\(?(\w+)\.vendas', 'i'))[1]
        THEN 'OK'
        ELSE 'ERRADO'
      END AS status
    FROM pg_matviews m
    WHERE m.matviewname IN ('vendas_agregadas_60d', 'vendas_agregadas_30d')
    ORDER BY m.matviewname, m.schemaname;
  END;
  $$;


--
-- Name: FUNCTION validar_mv_schemas(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validar_mv_schemas() IS 'Valida se todas as MVs vendas_agregadas_60d e vendas_agregadas_30d estao apontando para o schema correto.
Uso: SELECT * FROM public.validar_mv_schemas();';


--
-- Name: validate_cnpj_format(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_cnpj_format(cnpj text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
BEGIN
  -- Verifica formato: XX.XXX.XXX/XXXX-XX
  RETURN cnpj ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$';
END;
$_$;


--
-- Name: verificar_execucao_completa(date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_execucao_completa(data_alvo date, schema_name text, p_nome_processo text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    existe boolean;
BEGIN
    EXECUTE format(
        -- Apontando para a sua tabela correta: etl_controle
        'SELECT EXISTS (SELECT 1 FROM %I.etl_controle WHERE data_execucao = %L AND processo_nome = %L AND status = %L)',
        schema_name,
        data_alvo,
        p_nome_processo,
        'SUCESSO'
    ) INTO existe;
    RETURN existe;
END;
$$;


--
-- Name: verificar_execucao_diaria(text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_execucao_diaria(p_schema_name text, p_filial_id integer, p_processo_nome text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    tabela_existe boolean;
    registro_encontrado boolean;
BEGIN
    -- Verifica se a tabela de controle existe no schema especificado
    EXECUTE format('SELECT EXISTS (
        SELECT FROM pg_tables WHERE schemaname = %L AND tablename = %L
    )', p_schema_name, 'etl_controle') INTO tabela_existe;

    IF NOT tabela_existe THEN
        -- Se a tabela não existe, não pode haver registro.
        RETURN FALSE;
    END IF;

    -- Se a tabela existe, verifica o registro
    EXECUTE format('SELECT EXISTS (
        SELECT 1
        FROM %I.etl_controle
        WHERE filial_id = %L
          AND processo_nome = %L
          AND status = ''SUCESSO''
          AND data_execucao = CURRENT_DATE
    )', p_schema_name, p_filial_id, p_processo_nome) INTO registro_encontrado;

    RETURN registro_encontrado;
END;
$$;


--
-- Name: verificar_execucao_diaria_processo(text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_execucao_diaria_processo(schema_name text, p_nome_processo text, data_atual date) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM etl_controle -- O RLS (Row Level Security) do Supabase garantirá o acesso ao schema correto
    WHERE processo_nome = p_nome_processo
      AND data_execucao = data_atual
      AND status = 'SUCESSO'
  );
END;
$$;


--
-- Name: verificar_execucoes_diarias(date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_execucoes_diarias(data_atual date, schema_name text, p_nome_processo text) RETURNS TABLE(filial_id_concluida bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY EXECUTE format(
        'SELECT filial_id FROM %I.etl_controle WHERE data_execucao = %L AND processo_nome = %L AND status = %L',
        schema_name,
        data_atual,
        p_nome_processo,
        'SUCESSO'
    );
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid,
    module text NOT NULL,
    sub_module text,
    action text DEFAULT 'access'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo'::text) NOT NULL,
    user_name text,
    user_email text,
    CONSTRAINT audit_logs_module_check CHECK ((module = ANY (ARRAY['dashboard'::text, 'usuarios'::text, 'relatorios'::text, 'configuracoes'::text])))
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Central audit log table for tracking user access to modules';


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    branch_code character varying(50) NOT NULL,
    tenant_id uuid NOT NULL,
    store_code character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    descricao character varying(255),
    cep character varying(10),
    rua character varying(255),
    numero character varying(20),
    bairro character varying(100),
    cidade character varying(100),
    estado character varying(2),
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE branches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.branches IS 'Filiais de cada empresa (tenant). Cada filial é identificada por um código único.';


--
-- Name: COLUMN branches.branch_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.branch_code IS 'Código da filial (Primary Key)';


--
-- Name: COLUMN branches.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.tenant_id IS 'ID da empresa (tenant) dona desta filial';


--
-- Name: COLUMN branches.store_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.store_code IS 'Código da loja (opcional)';


--
-- Name: COLUMN branches.descricao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.descricao IS 'Nome/descrição da filial';


--
-- Name: COLUMN branches.cep; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.cep IS 'CEP do endereço da filial';


--
-- Name: COLUMN branches.rua; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.rua IS 'Rua/Logradouro da filial';


--
-- Name: COLUMN branches.numero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.numero IS 'Número do endereço da filial';


--
-- Name: COLUMN branches.bairro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.bairro IS 'Bairro da filial';


--
-- Name: COLUMN branches.cidade; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.cidade IS 'Cidade da filial';


--
-- Name: COLUMN branches.estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.estado IS 'UF/Estado da filial';


--
-- Name: COLUMN branches.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.branches.id IS 'ID único da filial (UUID)';


--
-- Name: departamentos_nivel1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departamentos_nivel1 (
    id integer NOT NULL,
    descricao text NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE departamentos_nivel1; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.departamentos_nivel1 IS 'Dimensão de Departamentos Nível 1';


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id bigint NOT NULL,
    source_id integer NOT NULL,
    source_level integer NOT NULL,
    description text,
    parent_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    parent_source_id integer,
    parent_source_level integer
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.departments ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.departments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: filiais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.filiais (
    id integer NOT NULL,
    codigo integer NOT NULL,
    nome character varying(100) NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: filiais_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.filiais_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: filiais_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.filiais_id_seq OWNED BY public.filiais.id;


--
-- Name: jobs_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs_log (
    id bigint NOT NULL,
    function_name text NOT NULL,
    schema_name text,
    executed_at timestamp with time zone DEFAULT now(),
    status text NOT NULL,
    error_message text,
    execution_time interval
);


--
-- Name: jobs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_log_id_seq OWNED BY public.jobs_log.id;


--
-- Name: logs_sincronizacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs_sincronizacao (
    id bigint NOT NULL,
    tenant_id text,
    etapa text,
    status text,
    mensagem text,
    executado_em timestamp without time zone DEFAULT now()
);


--
-- Name: logs_sincronizacao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logs_sincronizacao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logs_sincronizacao_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logs_sincronizacao_id_seq OWNED BY public.logs_sincronizacao.id;


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produtos (
    id bigint NOT NULL,
    descricao text NOT NULL,
    ativo boolean DEFAULT true,
    unidade_de_medida character varying(10),
    curva_abc character(1),
    balanca character(1),
    ultimo_fornecedor text,
    preco_de_venda_1 numeric(15,5),
    preco_de_venda_2 numeric(15,5),
    preco_de_custo numeric(15,5),
    custo_real numeric(15,5),
    custo_fiscal numeric(15,5),
    custo_com_encargos numeric(15,5),
    custo_medio numeric(15,5),
    estoque_atual numeric(18,6),
    qtde_por_embalagem_ultima_entrada numeric(18,6),
    data_cadastro date,
    data_alteracao_preco date,
    data_alteracao_custo date,
    data_alteracao_cadastro date,
    marca_id bigint,
    classe_id bigint,
    agrupamento_id bigint,
    departamento_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staging_departamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_departamentos (
    id bigint NOT NULL,
    descricao text NOT NULL,
    nivel smallint NOT NULL,
    parent_id_original bigint,
    parent_id bigint
);


--
-- Name: staging_produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_produtos (
    id bigint NOT NULL,
    descricao text NOT NULL,
    ativo boolean,
    unidade_de_medida character varying(10),
    curva_abc character(1),
    balanca character(1),
    ultimo_fornecedor text,
    preco_de_venda_1 numeric(15,5),
    preco_de_venda_2 numeric(15,5),
    preco_de_custo numeric(15,5),
    custo_real numeric(15,5),
    custo_fiscal numeric(15,5),
    custo_com_encargos numeric(15,5),
    custo_medio numeric(15,5),
    estoque_atual numeric(18,6),
    qtde_por_embalagem_ultima_entrada numeric(18,6),
    data_cadastro date,
    data_alteracao_preco date,
    data_alteracao_custo date,
    data_alteracao_cadastro date,
    marca_id bigint,
    classe_id bigint,
    agrupamento_id bigint,
    departamento_id bigint
);


--
-- Name: tenant_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_parameters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    parameter_key text NOT NULL,
    parameter_value boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE tenant_parameters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_parameters IS 'Parâmetros configuráveis por tenant para controlar features e comportamentos do sistema';


--
-- Name: COLUMN tenant_parameters.parameter_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_parameters.parameter_key IS 'Chave do parâmetro (ex: enable_descontos_venda)';


--
-- Name: COLUMN tenant_parameters.parameter_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_parameters.parameter_value IS 'Valor booleano do parâmetro';


--
-- Name: tipos_despesa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_despesa (
    id integer NOT NULL,
    descricao text,
    classificacao text,
    vencimento_dia_nao_util text,
    origem text,
    obrigatoria_mes boolean,
    departamentalizacao_nivel1 integer,
    tipo_custo text,
    tipo_requisicao text,
    dia_mes integer,
    considera_despesa_real boolean,
    considera_despesa_df boolean,
    considera_despesa_custo_mensal boolean,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE tipos_despesa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tipos_despesa IS 'Dimensão de Tipos de Despesa do ERP';


--
-- Name: user_authorized_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_authorized_branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_authorized_branches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_authorized_branches IS 'Restricts user access to specific branches. Empty = access to all branches (default).';


--
-- Name: user_authorized_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_authorized_modules (
    user_id uuid NOT NULL,
    module public.system_module NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_authorized_modules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_authorized_modules IS 'Armazena os módulos autorizados para cada usuário. Apenas usuários com role = user precisam de configuração. Superadmin e Admin têm acesso full automático.';


--
-- Name: COLUMN user_authorized_modules.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_authorized_modules.user_id IS 'UUID do usuário (FK para user_profiles)';


--
-- Name: COLUMN user_authorized_modules.module; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_authorized_modules.module IS 'Identificador do módulo do sistema';


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    tenant_id uuid,
    full_name text NOT NULL,
    avatar_url text,
    role text DEFAULT 'user'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    can_switch_tenants boolean DEFAULT false,
    theme_preference text,
    CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'user'::text, 'viewer'::text]))),
    CONSTRAINT user_profiles_tenant_id_role_check CHECK (((tenant_id IS NOT NULL) OR (role = 'superadmin'::text))),
    CONSTRAINT user_profiles_theme_preference_check CHECK ((theme_preference = ANY (ARRAY['light'::text, 'dark'::text])))
);


--
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS 'Migration 003: Superadmin multi-tenant implementado - 2025-10-12';


--
-- Name: COLUMN user_profiles.can_switch_tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.can_switch_tenants IS 'Se TRUE, usuário pode trocar entre diferentes tenants (geralmente superadmins)';


--
-- Name: COLUMN user_profiles.theme_preference; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.theme_preference IS 'Preferência de tema do usuário: light ou dark. NULL usa preferência do sistema.';


--
-- Name: user_tenant_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tenant_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_tenant_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_tenant_access IS 'Migration 001: Sistema multi-empresa implementado - 2025-10-11';


--
-- Name: COLUMN user_tenant_access.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_tenant_access.user_id IS 'ID do usuário (geralmente superadmin)';


--
-- Name: COLUMN user_tenant_access.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_tenant_access.tenant_id IS 'ID do tenant que o usuário pode acessar';


--
-- Name: COLUMN user_tenant_access.granted_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_tenant_access.granted_by IS 'ID do usuário que concedeu o acesso';


--
-- Name: vendas_agregadas_60d; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.vendas_agregadas_60d AS
 SELECT p.id AS id_produto,
    p.filial_id,
    p.departamento_id,
    sum(v.valor_vendas) AS total_valor_produto
   FROM (okilao.vendas v
     JOIN okilao.produtos p ON (((v.id_produto = p.id) AND (v.filial_id = p.filial_id))))
  WHERE ((v.data_venda >= (CURRENT_DATE - '60 days'::interval)) AND (v.data_venda < CURRENT_DATE) AND (v.valor_vendas > (0)::numeric))
  GROUP BY p.id, p.filial_id, p.departamento_id
  WITH NO DATA;


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: filiais id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filiais ALTER COLUMN id SET DEFAULT nextval('public.filiais_id_seq'::regclass);


--
-- Name: jobs_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_log ALTER COLUMN id SET DEFAULT nextval('public.jobs_log_id_seq'::regclass);


--
-- Name: logs_sincronizacao id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_sincronizacao ALTER COLUMN id SET DEFAULT nextval('public.logs_sincronizacao_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: branches branches_tenant_branch_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_tenant_branch_code_key UNIQUE (tenant_id, branch_code);


--
-- Name: CONSTRAINT branches_tenant_branch_code_key ON branches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT branches_tenant_branch_code_key ON public.branches IS 'Garante que branch_code seja único apenas dentro de cada tenant/empresa';


--
-- Name: departamentos_nivel1 departamentos_nivel1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departamentos_nivel1
    ADD CONSTRAINT departamentos_nivel1_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: departments departments_source_id_source_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_source_id_source_level_key UNIQUE (source_id, source_level);


--
-- Name: filiais filiais_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filiais
    ADD CONSTRAINT filiais_codigo_key UNIQUE (codigo);


--
-- Name: filiais filiais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filiais
    ADD CONSTRAINT filiais_pkey PRIMARY KEY (id);


--
-- Name: jobs_log jobs_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_log
    ADD CONSTRAINT jobs_log_pkey PRIMARY KEY (id);


--
-- Name: logs_sincronizacao logs_sincronizacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_sincronizacao
    ADD CONSTRAINT logs_sincronizacao_pkey PRIMARY KEY (id);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- Name: staging_departamentos staging_departamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_departamentos
    ADD CONSTRAINT staging_departamentos_pkey PRIMARY KEY (id, nivel);


--
-- Name: staging_produtos staging_produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_produtos
    ADD CONSTRAINT staging_produtos_pkey PRIMARY KEY (id);


--
-- Name: tenant_parameters tenant_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_parameters
    ADD CONSTRAINT tenant_parameters_pkey PRIMARY KEY (id);


--
-- Name: tenant_parameters tenant_parameters_tenant_id_parameter_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_parameters
    ADD CONSTRAINT tenant_parameters_tenant_id_parameter_key_key UNIQUE (tenant_id, parameter_key);


--
-- Name: tenants tenants_cnpj_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_cnpj_key UNIQUE (cnpj);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: tenants tenants_supabase_schema_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_supabase_schema_key UNIQUE (supabase_schema);


--
-- Name: tipos_despesa tipos_despesa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_despesa
    ADD CONSTRAINT tipos_despesa_pkey PRIMARY KEY (id);


--
-- Name: user_authorized_branches user_authorized_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_authorized_branches
    ADD CONSTRAINT user_authorized_branches_pkey PRIMARY KEY (id);


--
-- Name: user_authorized_branches user_authorized_branches_user_id_branch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_authorized_branches
    ADD CONSTRAINT user_authorized_branches_user_id_branch_id_key UNIQUE (user_id, branch_id);


--
-- Name: user_authorized_modules user_authorized_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_authorized_modules
    ADD CONSTRAINT user_authorized_modules_pkey PRIMARY KEY (user_id, module);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_tenant_access user_tenant_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_access
    ADD CONSTRAINT user_tenant_access_pkey PRIMARY KEY (id);


--
-- Name: user_tenant_access user_tenant_access_user_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_access
    ADD CONSTRAINT user_tenant_access_user_id_tenant_id_key UNIQUE (user_id, tenant_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_module ON public.audit_logs USING btree (module);


--
-- Name: idx_audit_logs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_audit_logs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_branches_branch_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_branch_code ON public.branches USING btree (branch_code);


--
-- Name: idx_branches_store_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_store_code ON public.branches USING btree (store_code) WHERE (store_code IS NOT NULL);


--
-- Name: idx_branches_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_tenant_id ON public.branches USING btree (tenant_id);


--
-- Name: idx_produtos_departamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_departamento_id ON public.produtos USING btree (departamento_id);


--
-- Name: idx_tenant_parameters_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_parameters_key ON public.tenant_parameters USING btree (parameter_key);


--
-- Name: idx_tenant_parameters_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_parameters_tenant_id ON public.tenant_parameters USING btree (tenant_id);


--
-- Name: idx_tenant_parameters_tenant_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_parameters_tenant_key ON public.tenant_parameters USING btree (tenant_id, parameter_key);


--
-- Name: idx_tenants_cnpj; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_cnpj ON public.tenants USING btree (cnpj);


--
-- Name: idx_tenants_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_parent ON public.tenants USING btree (parent_tenant_id);


--
-- Name: idx_tenants_schema; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_schema ON public.tenants USING btree (supabase_schema);


--
-- Name: idx_tenants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_slug ON public.tenants USING btree (slug);


--
-- Name: idx_tenants_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_type ON public.tenants USING btree (tenant_type);


--
-- Name: idx_user_authorized_branches_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_authorized_branches_branch_id ON public.user_authorized_branches USING btree (branch_id);


--
-- Name: idx_user_authorized_branches_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_authorized_branches_user_id ON public.user_authorized_branches USING btree (user_id);


--
-- Name: idx_user_authorized_modules_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_authorized_modules_module ON public.user_authorized_modules USING btree (module);


--
-- Name: idx_user_authorized_modules_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_authorized_modules_user_id ON public.user_authorized_modules USING btree (user_id);


--
-- Name: idx_user_profiles_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_id ON public.user_profiles USING btree (id);


--
-- Name: idx_user_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);


--
-- Name: idx_user_profiles_role_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_role_tenant ON public.user_profiles USING btree (role, tenant_id);


--
-- Name: idx_user_profiles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_tenant ON public.user_profiles USING btree (tenant_id);


--
-- Name: idx_user_profiles_theme_preference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_theme_preference ON public.user_profiles USING btree (theme_preference) WHERE (theme_preference IS NOT NULL);


--
-- Name: idx_user_tenant_access_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tenant_access_tenant ON public.user_tenant_access USING btree (tenant_id);


--
-- Name: idx_user_tenant_access_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tenant_access_user ON public.user_tenant_access USING btree (user_id);


--
-- Name: idx_vendas_agregadas_calculo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_agregadas_calculo ON public.vendas_agregadas_60d USING btree (filial_id, departamento_id, total_valor_produto DESC);


--
-- Name: idx_vendas_agregadas_pk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vendas_agregadas_pk ON public.vendas_agregadas_60d USING btree (filial_id, id_produto);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: produtos on_produtos_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_produtos_update BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: tenant_parameters tenant_parameters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_parameters_updated_at BEFORE UPDATE ON public.tenant_parameters FOR EACH ROW EXECUTE FUNCTION public.update_tenant_parameters_updated_at();


--
-- Name: user_profiles trigger_set_superadmin_tenant_null; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_superadmin_tenant_null BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_superadmin_tenant_null();


--
-- Name: user_profiles trigger_superadmin_switch_tenants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_superadmin_switch_tenants BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.ensure_superadmin_can_switch();


--
-- Name: branches trigger_update_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_branches_updated_at();


--
-- Name: tenants trigger_update_tenants_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_tenants_timestamp BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_tenants_updated_at();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: branches branches_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id);


--
-- Name: tenant_parameters tenant_parameters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_parameters
    ADD CONSTRAINT tenant_parameters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenants tenants_parent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_parent_tenant_id_fkey FOREIGN KEY (parent_tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: user_authorized_branches user_authorized_branches_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_authorized_branches
    ADD CONSTRAINT user_authorized_branches_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: user_authorized_branches user_authorized_branches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_authorized_branches
    ADD CONSTRAINT user_authorized_branches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_authorized_modules user_authorized_modules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_authorized_modules
    ADD CONSTRAINT user_authorized_modules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_tenant_access user_tenant_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_access
    ADD CONSTRAINT user_tenant_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: user_tenant_access user_tenant_access_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_access
    ADD CONSTRAINT user_tenant_access_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_tenant_access user_tenant_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_access
    ADD CONSTRAINT user_tenant_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: branches Admin can delete branches in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can delete branches in their tenant" ON public.branches FOR DELETE USING ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));


--
-- Name: branches Admin can insert branches in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can insert branches in their tenant" ON public.branches FOR INSERT WITH CHECK ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));


--
-- Name: branches Admin can update branches in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update branches in their tenant" ON public.branches FOR UPDATE USING ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));


--
-- Name: user_authorized_branches Admins can delete authorized branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete authorized branches" ON public.user_authorized_branches FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: user_authorized_modules Admins can delete authorized modules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete authorized modules" ON public.user_authorized_modules FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: user_authorized_branches Admins can insert authorized branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert authorized branches" ON public.user_authorized_branches FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: user_authorized_modules Admins can insert authorized modules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert authorized modules" ON public.user_authorized_modules FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: tenant_parameters Admins can insert parameters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert parameters" ON public.tenant_parameters FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text])) AND ((user_profiles.role = 'superadmin'::text) OR (user_profiles.tenant_id = user_profiles.tenant_id))))));


--
-- Name: tenant_parameters Admins can update parameters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update parameters" ON public.tenant_parameters FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text])) AND ((user_profiles.role = 'superadmin'::text) OR (user_profiles.tenant_id = user_profiles.tenant_id))))));


--
-- Name: user_authorized_modules Admins can view all authorized modules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all authorized modules" ON public.user_authorized_modules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: user_authorized_branches Admins can view their tenant's authorized branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view their tenant's authorized branches" ON public.user_authorized_branches FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.user_profiles up1
     JOIN public.user_profiles up2 ON ((up1.tenant_id = up2.tenant_id)))
  WHERE ((up1.id = auth.uid()) AND (up1.role = ANY (ARRAY['admin'::text, 'superadmin'::text])) AND (up2.id = user_authorized_branches.user_id)))));


--
-- Name: audit_logs Authenticated users can insert logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert logs" ON public.audit_logs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: branches Superadmin can delete all branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmin can delete all branches" ON public.branches FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: branches Superadmin can insert branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmin can insert branches" ON public.branches FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: branches Superadmin can update all branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmin can update all branches" ON public.branches FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: branches Superadmin can view all branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmin can view all branches" ON public.branches FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: tenant_parameters Superadmins can delete parameters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can delete parameters" ON public.tenant_parameters FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: tenants Superadmins can delete tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can delete tenants" ON public.tenants FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: tenants Superadmins can insert tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can insert tenants" ON public.tenants FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: user_tenant_access Superadmins can manage access records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can manage access records" ON public.user_tenant_access TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: tenants Superadmins can update tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can update tenants" ON public.tenants FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: user_tenant_access Superadmins can view all access records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can view all access records" ON public.user_tenant_access FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: user_authorized_branches Superadmins can view all authorized branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can view all authorized branches" ON public.user_authorized_branches FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: audit_logs Superadmins can view all logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can view all logs" ON public.audit_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: tenant_parameters Superadmins can view all parameters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can view all parameters" ON public.tenant_parameters FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: tenants Superadmins can view all tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Superadmins can view all tenants" ON public.tenants FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'superadmin'::text)))));


--
-- Name: branches Users can view branches from their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view branches from their tenant" ON public.branches FOR SELECT USING ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: user_tenant_access Users can view own access records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own access records" ON public.user_tenant_access FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: tenants Users can view own tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own tenant" ON public.tenants FOR SELECT TO authenticated USING ((id IN ( SELECT user_profiles.tenant_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: user_authorized_branches Users can view their own authorized branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own authorized branches" ON public.user_authorized_branches FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_authorized_modules Users can view their own authorized modules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own authorized modules" ON public.user_authorized_modules FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: audit_logs Users can view their own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own logs" ON public.audit_logs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: tenant_parameters Users can view their tenant parameters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their tenant parameters" ON public.tenant_parameters FOR SELECT USING ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_parameters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_parameters ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_authorized_branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_authorized_branches ENABLE ROW LEVEL SECURITY;

--
-- Name: user_authorized_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_authorized_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles user_profiles_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_delete_policy ON public.user_profiles FOR DELETE TO authenticated USING (((public.get_my_role() = 'superadmin'::text) OR ((public.get_my_role() = 'admin'::text) AND (public.get_my_tenant_id() = tenant_id) AND (role <> 'superadmin'::text))));


--
-- Name: user_profiles user_profiles_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_insert_policy ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (((public.get_my_role() = 'superadmin'::text) OR ((public.get_my_role() = 'admin'::text) AND (public.get_my_tenant_id() = tenant_id) AND (role <> 'superadmin'::text))));


--
-- Name: user_profiles user_profiles_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_select_policy ON public.user_profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR (public.get_my_role() = 'superadmin'::text) OR ((public.get_my_tenant_id() = tenant_id) AND (role <> 'superadmin'::text))));


--
-- Name: user_profiles user_profiles_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_update_policy ON public.user_profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR (public.get_my_role() = 'superadmin'::text) OR ((public.get_my_role() = 'admin'::text) AND (public.get_my_tenant_id() = tenant_id) AND (role <> 'superadmin'::text))));


--
-- Name: user_tenant_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_tenant_access ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos zapdash; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zapdash ON public.produtos USING (true);


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Permitir Uploads do Servidor 1v79tfi_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir Uploads do Servidor 1v79tfi_0" ON storage.objects FOR SELECT USING ((bucket_id = 'relatorios'::text));


--
-- Name: objects Permitir Uploads do Servidor 1v79tfi_1; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir Uploads do Servidor 1v79tfi_1" ON storage.objects FOR INSERT WITH CHECK ((bucket_id = 'relatorios'::text));


--
-- Name: objects Permitir Uploads do Servidor 1v79tfi_2; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir Uploads do Servidor 1v79tfi_2" ON storage.objects FOR UPDATE USING ((bucket_id = 'relatorios'::text));


--
-- Name: objects Permitir acesso total para a service_role; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir acesso total para a service_role" ON storage.objects TO service_role USING (true) WITH CHECK (true);


--
-- Name: objects Permitir atualizações para usuários autenticados; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir atualizações para usuários autenticados" ON storage.objects FOR UPDATE TO authenticated USING (true);


--
-- Name: objects Permitir exclusões para usuários autenticados; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir exclusões para usuários autenticados" ON storage.objects FOR DELETE TO authenticated USING (true);


--
-- Name: objects Permitir leituras para usuários autenticados; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir leituras para usuários autenticados" ON storage.objects FOR SELECT TO authenticated USING (true);


--
-- Name: objects Permitir todos os uploads; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir todos os uploads" ON storage.objects FOR INSERT WITH CHECK (true);


--
-- Name: objects Permitir uploads para usuários autenticados; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Permitir uploads para usuários autenticados" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 1SawDsH8ffVdBdz8k0pXSQ4HM6E81SWsjZlI4LYr3VcbCE2r9qK0LLfMpD7gOVO
