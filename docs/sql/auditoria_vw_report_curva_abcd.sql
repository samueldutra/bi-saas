-- AUDITORIA COMPLETA: vw_report_curva_abcd
-- Objetivo: responder
-- 1) Qual a logica da MV
-- 2) Quais tabelas/objetos sao usados para montar
-- 3) Quais funcoes/procedures usam essa MV
-- 4) Onde ela eh utilizada (banco + codigo)
--
-- Execute por blocos no Supabase SQL Editor (role postgres).
-- Observacao: esta auditoria NAO altera estrutura, apenas leitura.

/* =====================================================================
   BLOCO 0) INVENTARIO: em quais schemas a MV existe
   ===================================================================== */
select
  schemaname as schema_name,
  matviewname
from pg_matviews
where matviewname = 'vw_report_curva_abcd'
order by schemaname;

/* =====================================================================
   BLOCO 1) DEFINICAO E LOGICA DA MV (SQL completo por schema)
   ===================================================================== */
select
  schemaname as schema_name,
  matviewname,
  definition
from pg_matviews
where matviewname = 'vw_report_curva_abcd'
order by schemaname;

/* =====================================================================
   BLOCO 2) COLUNAS EXPOSTAS PELA MV
   ===================================================================== */
select
  table_schema as schema_name,
  table_name as object_name,
  ordinal_position,
  column_name,
  data_type
from information_schema.columns
where table_name = 'vw_report_curva_abcd'
order by table_schema, ordinal_position;

/* =====================================================================
   BLOCO 3) OBJETOS UTILIZADOS PARA MONTAR (dependencias diretas)
   - relkind: r=tabela, v=view, m=matview, p=particionada
   ===================================================================== */
select distinct
  mv_ns.nspname as mv_schema,
  mv.relname as mv_name,
  dep_ns.nspname as dependency_schema,
  dep.relname as dependency_name,
  dep.relkind as dependency_type
from pg_depend d
join pg_rewrite rw on rw.oid = d.objid
join pg_class mv on mv.oid = rw.ev_class
join pg_namespace mv_ns on mv_ns.oid = mv.relnamespace
join pg_class dep on dep.oid = d.refobjid
join pg_namespace dep_ns on dep_ns.oid = dep.relnamespace
where mv.relname = 'vw_report_curva_abcd'
  and dep.relkind in ('r','v','m','p')
order by mv_schema, dependency_schema, dependency_name;

/* =====================================================================
   BLOCO 4) FUNCOES/PROCEDURES QUE USAM A MV (texto no corpo)
   - prokind: f=function, p=procedure
   ===================================================================== */
select
  n.nspname as routine_schema,
  p.proname as routine_name,
  case p.prokind when 'f' then 'function' when 'p' then 'procedure' end as routine_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prokind in ('f','p')
  and pg_get_functiondef(p.oid) ilike '%vw_report_curva_abcd%'
order by routine_schema, routine_name;

/* =====================================================================
   BLOCO 5) VIEWS/MATVIEWS QUE USAM A MV
   ===================================================================== */
select
  schemaname as object_schema,
  viewname as object_name,
  'view' as object_type
from pg_views
where definition ilike '%vw_report_curva_abcd%'
union all
select
  schemaname as object_schema,
  matviewname as object_name,
  'matview' as object_type
from pg_matviews
where definition ilike '%vw_report_curva_abcd%'
order by object_schema, object_type, object_name;

/* =====================================================================
   BLOCO 6) JOBS DE REFRESH/USO (pg_cron)
   - se cron.job nao existir no projeto, pode falhar; nesse caso ignore
   ===================================================================== */
select
  jobid,
  schedule,
  command,
  active
from cron.job
where command ilike '%vw_report_curva_abcd%'
order by jobid;

/* =====================================================================
   BLOCO 7) USO REAL DE DADOS (volume por schema)
   ===================================================================== */
select
  m.schemaname as schema_name,
  (
    select count(*)
    from pg_catalog.pg_class c
    where c.relname = 'vw_report_curva_abcd'
  ) as sanity_catalog,
  format('%I.vw_report_curva_abcd', m.schemaname) as object_ref
from pg_matviews m
where m.matviewname = 'vw_report_curva_abcd'
order by m.schemaname;

-- Para contar linhas por schema, execute o resultado da query abaixo:
select format(
  'select %L as schema_name, count(*) as row_count from %I.vw_report_curva_abcd;',
  schemaname,
  schemaname
) as sql_to_run
from pg_matviews
where matviewname = 'vw_report_curva_abcd'
order by schemaname;

/* =====================================================================
   BLOCO 8) VALIDACAO DE CROSS-SCHEMA (detecta origem fora do proprio schema)
   ===================================================================== */
with defs as (
  select
    schemaname,
    definition,
    substring(
      lower(definition)
      from 'from[[:space:]]+\\(*([a-z0-9_]+)\\.vendas_produto_mes'
    ) as source_schema
  from pg_matviews
  where matviewname = 'vw_report_curva_abcd'
)
select
  schemaname as mv_schema,
  source_schema,
  (source_schema = schemaname) as schema_match
from defs
order by mv_schema;

/* =====================================================================
   BLOCO 9) CONSULTAS PARA USO NO CODIGO (rodar no terminal do projeto)
   =====================================================================
   rg -n --hidden -S "vw_report_curva_abcd" src scripts supabase .
   rg -n --hidden -S "rpc\\(|from\\(" src scripts
   ===================================================================== */
