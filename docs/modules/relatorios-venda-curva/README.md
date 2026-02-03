# Vendas por Curva

> Status: ✅ Implementado

## Visão Geral

Relatório que consolida as vendas do mês por produto e exibe a classificação por **curva de venda** e **curva de lucro**, organizadas em hierarquia de departamentos (nível 3 → nível 2 → nível 1 → produto).

## Funcionalidades

- ✅ Filtro por mês, ano e filiais (multi-seleção)
- ✅ Respeito às filiais autorizadas do usuário
- ✅ Hierarquia de departamentos com totais e margem
- ✅ Filtro por produto (código ou descrição, com debounce)
- ✅ Exportação em PDF
- ✅ Paginação por departamento nível 3
- ✅ Processamento otimizado via agregados mensais

## Componentes Principais

### Frontend
- **Página Principal**: `src/app/(dashboard)/relatorios/venda-curva/page.tsx`
- **Componentes**: `MultiSelect`, `Collapsible`, `Table`, `Pagination`, `Badge`
- **Hooks**: `useBranchesOptions`, `useTenantContext`

### Backend
- **API Route**: `src/app/api/relatorios/venda-curva/route.ts`
- **RPC Function**: `public.get_venda_curva_report_fast` (principal), `public.get_venda_curva_report` (fallback)
- **Reprocessamento**: `POST /api/admin/reprocess-vendas-mensal`
- **Lazy Load Totais**: `GET /api/relatorios/venda-curva/totais`
- **Lazy Load Produtos**: `GET /api/relatorios/venda-curva/produtos`

### Database
- **Tabelas**:
  - `demo.vendas`
  - `demo.produtos`
  - `demo.departments_level_1`
  - `demo.departments_level_2`
  - `demo.departments_level_3`
  - `demo.vendas_mensal_produto` (agregado mensal)

## Operação (Backfill)

### Script Local

Arquivo: `scripts/backfill-vendas-mensal.js`

Uso:

```bash
node scripts/backfill-vendas-mensal.js \
  --schema paraiso \
  --start 2025-01-01 \
  --end 2026-02-01 \
  --filiais "5,12,23,28,30,31,32,33,34,35,41,46,56,57,74,78,79,80,82,84,85,86" \
  --sleep 1
```

Parâmetros opcionais:
- `--cursor 0`
- `--limit 20`
- `--dry_run true`

### Endpoint de Reprocessamento

Somente `admin` e `superadmin`.

```http
POST /api/admin/reprocess-vendas-mensal
Content-Type: application/json

{
  "schema": "paraiso",
  "ano": 2025,
  "mes": 1,
  "filiais": [5, 12, 23]
}
```

### Edge Function (agendado)

Arquivo: `supabase/functions/vendas-mensal-backfill/index.ts`

Env necessários:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BACKFILL_TOKEN`

Exemplo de chamada:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/vendas-mensal-backfill" \
  -H "Content-Type: application/json" \
  -H "x-backfill-token: SEU_TOKEN" \
  -d '{"schema":"paraiso","start":"2025-01-01","end":"2026-02-01","max_operations":20,"sleep_seconds":1}'

Observação:
- `schema`, `start` e `end` são obrigatórios (sem defaults).

### Agendamento (mês atual + anterior)

A Edge Function suporta modo automático:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/vendas-mensal-backfill" \
  -H "Content-Type: application/json" \
  -H "x-backfill-token: SEU_TOKEN" \
  -d '{"schema":"paraiso","mode":"auto_current_prev","max_operations":40,"sleep_seconds":1}'
```

Isso processa o mês atual e o mês anterior (inteiros) sem precisar enviar `start/end`.
```

## Acesso Rápido

- 🔗 **Rota**: `/relatorios/venda-curva`
- 📄 **Regras de Negócio**: `docs/modules/relatorios-venda-curva/BUSINESS_RULES.md`
- 🗂️ **Estruturas de Dados**: `docs/modules/relatorios-venda-curva/DATA_STRUCTURES.md`
- 🔄 **Fluxo de Integração**: `docs/modules/relatorios-venda-curva/INTEGRATION_FLOW.md`

## Permissões

- Controle via **módulo autorizado**: `relatorios_venda_curva`
- Filiais são filtradas por `getUserAuthorizedBranchCodes` na API

## Versão

**Versão Atual**: 1.1.0
**Última Atualização**: 2026-02-03
