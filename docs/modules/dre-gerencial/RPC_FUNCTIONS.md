# DRE Gerencial - Funções RPC Supabase

## Índice

1. [Visão Geral](#visão-geral)
2. [Função: get_despesas_hierarquia](#função-get_despesas_hierarquia)
3. [Função: get_dashboard_data](#função-get_dashboard_data)
4. [Permissões e Segurança](#permissões-e-segurança)
5. [Exemplos de Uso](#exemplos-de-uso)
6. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O módulo DRE Gerencial utiliza **2 funções RPC (Remote Procedure Call)** no PostgreSQL via Supabase:

| Função | Responsabilidade | Schema | Retorno |
|--------|-----------------|---------|---------|
| `get_despesas_hierarquia` | Busca despesas com hierarquia (Dept→Tipo→Despesa) | Dinâmico (tenant) | TABLE (registros flat) |
| `get_dashboard_data` | Busca indicadores de vendas e lucros | Dinâmico (tenant) | RECORD (totais agregados) |

**Características**:
- Executam queries em schemas dinâmicos (multi-tenant)
- Respeitam permissões RLS (Row Level Security)
- Retornam dados otimizados para processamento

---

## Função: get_despesas_hierarquia

### Descrição

Retorna todas as despesas de uma filial em um período específico, incluindo informações de departamento e tipo para construção da hierarquia.

### Assinatura

```sql
CREATE OR REPLACE FUNCTION public.get_despesas_hierarquia(
  p_schema TEXT,              -- Nome do schema do tenant (ex: 'okilao')
  p_filial_id INTEGER,        -- ID da filial específica
  p_data_inicial DATE,        -- Data inicial do período (YYYY-MM-DD)
  p_data_final DATE,          -- Data final do período (YYYY-MM-DD)
  p_tipo_data TEXT DEFAULT 'data_despesa'  -- Campo de data para filtro
)
RETURNS TABLE (
  dept_id INTEGER,
  dept_descricao TEXT,
  tipo_id INTEGER,
  tipo_descricao TEXT,
  data_despesa DATE,
  data_emissao DATE,
  descricao_despesa TEXT,
  id_fornecedor INTEGER,      -- CORREÇÃO: INTEGER (não TEXT)
  numero_nota BIGINT,         -- CORREÇÃO: BIGINT (não INTEGER)
  serie_nota VARCHAR,         -- CORREÇÃO: VARCHAR (não TEXT)
  valor NUMERIC,
  usuario VARCHAR,            -- CORREÇÃO: VARCHAR (não TEXT)
  observacao TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql TEXT;
BEGIN
  -- Construir query dinâmica com nomes corretos de colunas
  -- IMPORTANTE: Usa data_despesa no filtro (não data_emissao como sugere o parâmetro)
  v_sql := format('
    SELECT
      d.id as dept_id,
      d.descricao as dept_descricao,
      td.id as tipo_id,
      td.descricao as tipo_descricao,
      desp.data_despesa,
      desp.data_emissao,
      desp.descricao_despesa,
      desp.id_fornecedor,
      desp.numero_nota,
      desp.serie_nota,
      desp.valor,
      desp.usuario,
      desp.observacao
    FROM %I.despesas desp
    INNER JOIN %I.tipos_despesa td
      ON desp.id_tipo_despesa = td.id
    INNER JOIN %I.departamentos_nivel1 d
      ON td.departamentalizacao_nivel1 = d.id
    WHERE desp.data_despesa BETWEEN $1 AND $2
      AND desp.filial_id = $3
    ORDER BY d.descricao, td.descricao, desp.data_despesa DESC
    LIMIT 1000
  ', p_schema, p_schema, p_schema);

  -- Executar query
  RETURN QUERY EXECUTE v_sql USING p_data_inicial, p_data_final, p_filial_id;
END;
$$;
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `p_schema` | TEXT | ✅ | Nome do schema do tenant | `'okilao'` |
| `p_filial_id` | INTEGER | ✅ | ID da filial | `1` |
| `p_data_inicial` | DATE | ✅ | Data inicial do período | `'2024-10-01'` |
| `p_data_final` | DATE | ✅ | Data final do período | `'2024-10-31'` |
| `p_tipo_data` | TEXT | ❌ (default: 'data_despesa') | Campo de data usado no filtro (`data_despesa` ou `data_emissao`) | `'data_despesa'` |

**⚠️ IMPORTANTE**: No DRE Gerencial, a API usa `p_tipo_data = 'data_despesa'`, então a listagem respeita a data de lançamento/competência da despesa.

### Retorno

**Tipo**: TABLE (conjunto de registros)

**Colunas**:

| Coluna | Tipo | Descrição | Exemplo |
|--------|------|-----------|---------|
| `dept_id` | INTEGER | ID do departamento (nível 1) | `2` |
| `dept_descricao` | TEXT | Nome do departamento | `'DESPESAS FIXAS'` |
| `tipo_id` | INTEGER | ID do tipo de despesa | `5` |
| `tipo_descricao` | TEXT | Nome do tipo | `'ENERGIA ELÉTRICA'` |
| `data_despesa` | DATE | Data de lançamento/competência da despesa | `'2024-10-15'` |
| `data_emissao` | DATE | Data de emissão da nota | `'2024-10-10'` |
| `descricao_despesa` | TEXT | Descrição da despesa | `'Energia Elétrica - Outubro'` |
| `id_fornecedor` | INTEGER | ID do fornecedor | `123` |
| `numero_nota` | BIGINT | Número da nota fiscal | `12345` |
| `serie_nota` | VARCHAR | Série da nota fiscal | `'A1'` |
| `valor` | NUMERIC | Valor da despesa | `3500.00` |
| `usuario` | VARCHAR | Usuário que cadastrou | `'admin'` |
| `observacao` | TEXT | Observações adicionais | `'Pagamento em dia'` |

**Observações**:
- `dept_id` vem de `departamentos_nivel1` (não `departamentos_despesas`)
- `tipo_id` vem de `tipos_despesa` (singular, não plural)
- Relacionamento: `despesas.id_tipo_despesa` → `tipos_despesa.id` → `tipos_despesa.departamentalizacao_nivel1` → `departamentos_nivel1.id`
- **LIMIT 1000**: A função retorna no máximo 1000 registros

### Exemplo de Retorno

```json
[
  {
    "dept_id": 2,
    "dept_descricao": "DESPESAS FIXAS",
    "tipo_id": 5,
    "tipo_descricao": "ENERGIA ELÉTRICA",
    "data_despesa": "2024-10-15",
    "data_emissao": "2024-10-10",
    "descricao_despesa": "Energia Elétrica - Matriz",
    "id_fornecedor": 123,
    "numero_nota": 12345,
    "serie_nota": "A1",
    "valor": 3500.00,
    "usuario": "admin",
    "observacao": null
  },
  {
    "dept_id": 2,
    "dept_descricao": "DESPESAS FIXAS",
    "tipo_id": 6,
    "tipo_descricao": "ÁGUA",
    "data_despesa": "2024-10-12",
    "data_emissao": "2024-10-12",
    "descricao_despesa": "Água - Outubro",
    "id_fornecedor": 456,
    "numero_nota": 54321,
    "serie_nota": "B",
    "valor": 800.00,
    "usuario": "admin",
    "observacao": null
  }
]
```

**Observações importantes**:
- Ordenado por: `departamento DESC, tipo DESC, data_despesa DESC`
- Máximo de 1000 registros retornados
- `id_fornecedor` é INTEGER (não string)

### Uso no Código

**API Route**: [hierarquia/route.ts](../../../src/app/api/dre-gerencial/hierarquia/route.ts:107-113)

```typescript
const { data: resultData, error: rpcError } = await (supabase.rpc as any)('get_despesas_hierarquia', {
  p_schema: schema,
  p_filial_id: finalFilialId,
  p_data_inicial: dataInicial,
  p_data_final: dataFinal,
  p_tipo_data: 'data_despesa'
})
```

### Processamento Pós-RPC

A API recebe dados **flat** (sem hierarquia) e processa em estrutura hierárquica:

```typescript
// Dados retornados pela RPC
const resultData = [
  { dept_id: 2, tipo_id: 5, valor: 3500, ... },
  { dept_id: 2, tipo_id: 5, valor: 1200, ... },
  { dept_id: 2, tipo_id: 6, valor: 800, ... }
]

// Processamento
const departamentosMap = new Map()
const tiposMap = new Map()

resultData.forEach(desp => {
  // Agrupar por departamento
  if (!departamentosMap.has(desp.dept_id)) {
    departamentosMap.set(desp.dept_id, { ... })
  }

  // Agrupar por tipo
  const tipoKey = `${desp.dept_id}-${desp.tipo_id}`
  if (!tiposMap.has(tipoKey)) {
    tiposMap.set(tipoKey, { despesas: [] })
  }

  // Adicionar despesa ao tipo
  tiposMap.get(tipoKey).despesas.push(desp)
})
```

### Índices Recomendados

Para performance otimizada, criar índices nas tabelas:

```sql
-- Tabela despesas (CRÍTICO)
CREATE INDEX idx_despesas_filial_data_despesa
ON {schema}.despesas(filial_id, data_despesa);
-- ⚠️ IMPORTANTE: Usar data_despesa (não data_emissao)

CREATE INDEX idx_despesas_tipo
ON {schema}.despesas(id_tipo_despesa);
-- ⚠️ IMPORTANTE: Usar id_tipo_despesa (não tipo_id)

-- Tabela tipos_despesa (singular)
CREATE INDEX idx_tipos_despesa_id
ON {schema}.tipos_despesa(id);

CREATE INDEX idx_tipos_despesa_dept
ON {schema}.tipos_despesa(departamentalizacao_nivel1);

-- Tabela departamentos_nivel1
CREATE INDEX idx_departamentos_nivel1_id
ON {schema}.departamentos_nivel1(id);
```

**Observações sobre índices**:
- Índice composto `(filial_id, data_despesa)` é essencial para o WHERE
- Tabelas corretas: `tipos_despesa` (singular), `departamentos_nivel1`
- Campo de relacionamento: `id_tipo_despesa` (não `tipo_id`)

---

## Função: get_dashboard_data

### Descrição

Retorna indicadores **completos** de vendas, lucros e comparações temporais (PAM - Período Anterior Mesmo mês, PAA - Período Anterior Acumulado, YTD - Year To Date) para um período e conjunto de filiais.

**⚠️ FUNÇÃO MUITO MAIS COMPLEXA DO QUE DOCUMENTADO ANTERIORMENTE**

Esta função calcula automaticamente:
- Indicadores do período atual
- Indicadores do mês anterior (PAM)
- Indicadores do ano anterior (PAA)
- Year-to-Date (YTD) atual e anterior
- Variações percentuais entre períodos
- Gráfico de vendas comparativo
- Descontos de venda (se tabela existir)

### Assinatura

```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_data(
  schema_name TEXT,           -- Nome do schema do tenant
  p_data_inicio DATE,         -- Data inicial do período
  p_data_fim DATE,            -- Data final do período
  p_filiais_ids TEXT[] DEFAULT NULL  -- Array de IDs de filiais (ou NULL para todas)
)
RETURNS TABLE (
  -- Período atual
  total_vendas NUMERIC,
  total_lucro NUMERIC,
  ticket_medio NUMERIC,
  margem_lucro NUMERIC,

  -- PAM (mês anterior)
  pa_vendas NUMERIC,
  pa_lucro NUMERIC,
  pa_ticket_medio NUMERIC,
  pa_margem_lucro NUMERIC,

  -- Variações vs mês anterior
  variacao_vendas_mes NUMERIC,
  variacao_lucro_mes NUMERIC,
  variacao_ticket_mes NUMERIC,
  variacao_margem_mes NUMERIC,

  -- Variações vs ano anterior
  variacao_vendas_ano NUMERIC,
  variacao_lucro_ano NUMERIC,
  variacao_ticket_ano NUMERIC,
  variacao_margem_ano NUMERIC,

  -- Year-to-Date
  ytd_vendas NUMERIC,
  ytd_vendas_ano_anterior NUMERIC,
  ytd_variacao_percent NUMERIC,

  -- Gráfico comparativo
  grafico_vendas JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  -- Cálculo de períodos comparativos
  periodo_dias INT := p_data_fim - p_data_inicio;
  data_inicio_mes_ant DATE := p_data_inicio - interval '1 month';
  data_fim_mes_ant DATE := data_inicio_mes_ant + periodo_dias;
  data_inicio_ano_ant DATE := p_data_inicio - interval '1 year';
  data_fim_ano_ant DATE := data_inicio_ano_ant + periodo_dias;

  -- YTD (Year To Date)
  data_inicio_ytd DATE := date_trunc('year', CURRENT_DATE)::DATE;
  data_fim_ytd DATE := CURRENT_DATE;
  data_inicio_ytd_ant DATE := date_trunc('year', CURRENT_DATE - interval '1 year')::DATE;
  data_fim_ytd_ant DATE := data_inicio_ytd_ant + (data_fim_ytd - data_inicio_ytd);

  -- Variáveis de dados atuais
  v_vendas_atual NUMERIC; v_lucro_atual NUMERIC; v_transacoes_atual BIGINT;
  v_ticket_medio_atual NUMERIC; v_margem_lucro_atual NUMERIC;

  -- Variáveis de dados mês anterior
  v_vendas_mes_ant NUMERIC; v_lucro_mes_ant NUMERIC; v_transacoes_mes_ant BIGINT;
  v_ticket_medio_mes_ant NUMERIC; v_margem_lucro_mes_ant NUMERIC;

  -- Variáveis de dados ano anterior
  v_vendas_ano_ant NUMERIC; v_lucro_ano_ant NUMERIC; v_transacoes_ano_ant BIGINT;
  v_ticket_medio_ano_ant NUMERIC; v_margem_lucro_ano_ant NUMERIC;

  -- YTD
  v_ytd_vendas NUMERIC;
  v_ytd_vendas_ant NUMERIC;
  v_ytd_variacao NUMERIC;

  -- Gráfico e filtros
  v_grafico_vendas JSONB;
  filter_clause TEXT;

  -- Descontos
  v_descontos_atual NUMERIC := 0;
  v_descontos_mes_ant NUMERIC := 0;
  v_descontos_ano_ant NUMERIC := 0;
  v_descontos_ytd NUMERIC := 0;
  v_descontos_ytd_ant NUMERIC := 0;
  v_tabela_descontos_existe BOOLEAN;
BEGIN
  -- Construir cláusula de filtro de filiais
  IF p_filiais_ids IS NOT NULL AND array_length(p_filiais_ids, 1) > 0 THEN
    filter_clause := format('AND filial_id::TEXT = ANY(%L)', p_filiais_ids);
  ELSE
    filter_clause := '';
  END IF;

  -- Buscar dados do período atual
  EXECUTE format('SELECT COALESCE(SUM(valor_total),0), COALESCE(SUM(total_lucro),0), COALESCE(SUM(total_transacoes),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, p_data_inicio, p_data_fim, filter_clause) INTO v_vendas_atual, v_lucro_atual, v_transacoes_atual;

  -- Buscar dados do mês anterior
  EXECUTE format('SELECT COALESCE(SUM(valor_total),0), COALESCE(SUM(total_lucro),0), COALESCE(SUM(total_transacoes),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_mes_ant, data_fim_mes_ant, filter_clause) INTO v_vendas_mes_ant, v_lucro_mes_ant, v_transacoes_mes_ant;

  -- Buscar dados do ano anterior
  EXECUTE format('SELECT COALESCE(SUM(valor_total),0), COALESCE(SUM(total_lucro),0), COALESCE(SUM(total_transacoes),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_ano_ant, data_fim_ano_ant, filter_clause) INTO v_vendas_ano_ant, v_lucro_ano_ant, v_transacoes_ano_ant;

  -- Buscar YTD atual e anterior
  EXECUTE format('SELECT COALESCE(SUM(valor_total),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_ytd, data_fim_ytd, filter_clause) INTO v_ytd_vendas;
  EXECUTE format('SELECT COALESCE(SUM(valor_total),0) FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s', schema_name, data_inicio_ytd_ant, data_fim_ytd_ant, filter_clause) INTO v_ytd_vendas_ant;

  -- Verificar se tabela de descontos existe
  BEGIN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = %L AND table_name = %L)', schema_name, 'descontos_venda') INTO v_tabela_descontos_existe;
  EXCEPTION WHEN OTHERS THEN
    v_tabela_descontos_existe := FALSE;
  END;

  -- Se tabela de descontos existir, buscar descontos e subtrair
  IF v_tabela_descontos_existe THEN
    -- Descontos período atual
    BEGIN
      EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, p_data_inicio, p_data_fim, filter_clause) INTO v_descontos_atual;
    EXCEPTION WHEN OTHERS THEN
      v_descontos_atual := 0;
    END;

    -- Descontos mês anterior
    BEGIN
      EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_mes_ant, data_fim_mes_ant, filter_clause) INTO v_descontos_mes_ant;
    EXCEPTION WHEN OTHERS THEN
      v_descontos_mes_ant := 0;
    END;

    -- Descontos ano anterior
    BEGIN
      EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_ano_ant, data_fim_ano_ant, filter_clause) INTO v_descontos_ano_ant;
    EXCEPTION WHEN OTHERS THEN
      v_descontos_ano_ant := 0;
    END;

    -- Descontos YTD
    BEGIN
      EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_ytd, data_fim_ytd, filter_clause) INTO v_descontos_ytd;
    EXCEPTION WHEN OTHERS THEN
      v_descontos_ytd := 0;
    END;

    BEGIN
      EXECUTE format('SELECT COALESCE(SUM(valor_desconto),0) FROM %I.descontos_venda WHERE data_desconto BETWEEN %L AND %L %s', schema_name, data_inicio_ytd_ant, data_fim_ytd_ant, filter_clause) INTO v_descontos_ytd_ant;
    EXCEPTION WHEN OTHERS THEN
      v_descontos_ytd_ant := 0;
    END;

    -- Aplicar descontos aos valores
    v_vendas_atual := v_vendas_atual - v_descontos_atual;
    v_lucro_atual := v_lucro_atual - v_descontos_atual;
    v_vendas_mes_ant := v_vendas_mes_ant - v_descontos_mes_ant;
    v_lucro_mes_ant := v_lucro_mes_ant - v_descontos_mes_ant;
    v_vendas_ano_ant := v_vendas_ano_ant - v_descontos_ano_ant;
    v_lucro_ano_ant := v_lucro_ano_ant - v_descontos_ano_ant;
    v_ytd_vendas := v_ytd_vendas - v_descontos_ytd;
    v_ytd_vendas_ant := v_ytd_vendas_ant - v_descontos_ytd_ant;
  END IF;

  -- Gerar gráfico comparativo (vendas diárias atual vs ano anterior)
  EXECUTE format(
    $CHART_QUERY$
    WITH days AS (SELECT generate_series(%L::DATE, %L::DATE, '1 day')::DATE as dia),
    vendas_atuais AS (SELECT data_venda, SUM(valor_total) as total FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s GROUP BY data_venda),
    vendas_ano_anterior AS (SELECT data_venda, SUM(valor_total) as total FROM %I.vendas_diarias_por_filial WHERE data_venda BETWEEN %L AND %L %s GROUP BY data_venda)
    SELECT jsonb_agg(jsonb_build_object('mes', to_char(d.dia, 'DD/MM'), 'ano_atual', COALESCE(va.total, 0), 'ano_anterior', COALESCE(vaa.total, 0)) ORDER BY d.dia)
    FROM days d LEFT JOIN vendas_atuais va ON d.dia = va.data_venda LEFT JOIN vendas_ano_anterior vaa ON d.dia = (vaa.data_venda + interval '1 year')
    $CHART_QUERY$,
    p_data_inicio, p_data_fim, schema_name, p_data_inicio, p_data_fim, filter_clause, schema_name, data_inicio_ano_ant, data_fim_ano_ant, filter_clause
  ) INTO v_grafico_vendas;

  -- Calcular métricas derivadas
  v_ticket_medio_atual := CASE WHEN v_transacoes_atual > 0 THEN v_vendas_atual / v_transacoes_atual ELSE 0 END;
  v_margem_lucro_atual := CASE WHEN v_vendas_atual > 0 THEN (v_lucro_atual / v_vendas_atual) * 100 ELSE 0 END;
  v_ticket_medio_mes_ant := CASE WHEN v_transacoes_mes_ant > 0 THEN v_vendas_mes_ant / v_transacoes_mes_ant ELSE 0 END;
  v_margem_lucro_mes_ant := CASE WHEN v_vendas_mes_ant > 0 THEN (v_lucro_mes_ant / v_vendas_mes_ant) * 100 ELSE 0 END;
  v_ticket_medio_ano_ant := CASE WHEN v_transacoes_ano_ant > 0 THEN v_vendas_ano_ant / v_transacoes_ano_ant ELSE 0 END;
  v_margem_lucro_ano_ant := CASE WHEN v_vendas_ano_ant > 0 THEN (v_lucro_ano_ant / v_vendas_ano_ant) * 100 ELSE 0 END;

  v_ytd_variacao := CASE WHEN v_ytd_vendas_ant > 0 THEN ((v_ytd_vendas - v_ytd_vendas_ant) / v_ytd_vendas_ant) * 100 ELSE 0 END;

  -- Atribuir valores de retorno
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

  grafico_vendas := v_grafico_vendas;

  RETURN NEXT;
END;
$$;
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `schema_name` | TEXT | ✅ | Nome do schema do tenant | `'okilao'` |
| `p_data_inicio` | DATE | ✅ | Data inicial do período | `'2024-10-01'` |
| `p_data_fim` | DATE | ✅ | Data final do período | `'2024-10-31'` |
| `p_filiais_ids` | TEXT[] | ❌ (default: NULL) | Array de IDs de filiais | `ARRAY['1','4','7']` ou `NULL` |

**Observação**: Se `p_filiais_ids` = `NULL`, retorna dados de **TODAS** as filiais.

### Retorno

**Tipo**: TABLE (registro único com totais)

**Colunas**:

| Coluna | Tipo | Descrição | Exemplo |
|--------|------|-----------|---------|
| `total_vendas` | NUMERIC | Soma de todas as vendas brutas | `500000.00` |
| `total_lucro` | NUMERIC | Soma de todos os lucros | `150000.00` |
| `margem_lucro` | NUMERIC | Percentual de margem de lucro | `30.00` |

**Cálculos**:
```sql
total_vendas = SUM(valor_bruto)
total_lucro = SUM(lucro)
margem_lucro = (total_lucro / total_vendas) × 100
```

### Exemplo de Retorno

```json
{
  "total_vendas": 500000.00,
  "total_lucro": 150000.00,
  "margem_lucro": 30.00
}
```

### Uso no Código

**API Route**: [dashboard/route.ts](../../../src/app/api/dashboard/route.ts:116)

```typescript
const { data, error } = await directSupabase.rpc('get_dashboard_data', {
  schema_name: requestedSchema,
  p_data_inicio: data_inicio,
  p_data_fim: data_fim,
  p_filiais_ids: finalFiliais  // ['1', '4', '7'] ou null
}).single()
```

### Processamento Pós-RPC

**Page Component**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:244-253)

```typescript
// 1. Buscar dados do dashboard
const paramsAtual = new URLSearchParams({
  schema: currentTenant.supabase_schema,
  data_inicio: dataInicio,
  data_fim: dataFim,
  filiais: filialIds || 'all'
})
const responseAtual = await fetch(`/api/dashboard?${paramsAtual}`)
const dashboardAtual = await responseAtual.json()

// 2. Processar indicadores
const processIndicadores = (dashboardData, despesasData) => {
  const receitaBruta = dashboardData?.total_vendas || 0
  const lucroBruto = dashboardData?.total_lucro || 0
  const cmv = receitaBruta - lucroBruto
  const margemLucroBruto = dashboardData?.margem_lucro || 0

  const totalDespesas = despesasData?.totalizador?.valorTotal || 0
  const lucroLiquido = lucroBruto - totalDespesas
  const margemLucroLiquido = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0

  return {
    receitaBruta,
    lucroBruto,
    cmv,
    totalDespesas,
    lucroLiquido,
    margemLucroBruto,
    margemLucroLiquido
  }
}
```

### Índices Recomendados

```sql
-- Tabela vendas
CREATE INDEX idx_vendas_data_filial
ON {schema}.vendas(data_venda, filial_id);

CREATE INDEX idx_vendas_valores
ON {schema}.vendas(valor_bruto, lucro);
```

---

## Permissões e Segurança

### Row Level Security (RLS)

As funções RPC devem ser criadas com `SECURITY DEFINER` para executar com privilégios do owner:

```sql
CREATE OR REPLACE FUNCTION get_despesas_hierarquia(...)
LANGUAGE plpgsql
SECURITY DEFINER  -- Executa com privilégios do owner da função
AS $$
...
$$;
```

### Permissões de Execução

```sql
-- Conceder permissão de execução para roles apropriados
GRANT EXECUTE ON FUNCTION get_despesas_hierarquia(TEXT, INTEGER, DATE, DATE, TEXT)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION get_dashboard_data(TEXT, DATE, DATE, TEXT[])
TO authenticated, service_role;
```

### Validação de Schema

As funções usam `format()` com `%I` (identificador) para prevenir SQL injection:

```sql
-- CORRETO (protegido)
EXECUTE format('SELECT * FROM %I.despesas WHERE ...', p_schema)

-- INCORRETO (vulnerável)
EXECUTE 'SELECT * FROM ' || p_schema || '.despesas WHERE ...'
```

### Validação de Acesso

A **validação de acesso** é feita na **camada da API**, não na RPC:

```typescript
// API valida se usuário tem acesso ao schema
const hasAccess = await validateSchemaAccess(supabase, user, requestedSchema)
if (!hasAccess) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// API valida se usuário tem acesso às filiais
const authorizedBranches = await getUserAuthorizedBranchCodes(supabase, user.id)
if (!authorizedBranches.includes(requestedFilialId)) {
  return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
}
```

---

## Exemplos de Uso

### Exemplo 1: Buscar Despesas de Uma Filial

**JavaScript/TypeScript**:
```typescript
const { data, error } = await supabase.rpc('get_despesas_hierarquia', {
  p_schema: 'okilao',
  p_filial_id: 1,
  p_data_inicial: '2024-10-01',
  p_data_final: '2024-10-31',
  p_tipo_data: 'data_emissao'
})

console.log(data)
// [
//   { dept_id: 2, tipo_id: 5, valor: 3500, ... },
//   { dept_id: 2, tipo_id: 6, valor: 800, ... }
// ]
```

**SQL direto**:
```sql
SELECT * FROM get_despesas_hierarquia(
  'okilao',
  1,
  '2024-10-01',
  '2024-10-31',
  'data_emissao'
);
```

---

### Exemplo 2: Buscar Indicadores de Múltiplas Filiais

**JavaScript/TypeScript**:
```typescript
const { data, error } = await supabase.rpc('get_dashboard_data', {
  schema_name: 'okilao',
  p_data_inicio: '2024-10-01',
  p_data_fim: '2024-10-31',
  p_filiais_ids: ['1', '4', '7']
}).single()

console.log(data)
// {
//   total_vendas: 500000.00,
//   total_lucro: 150000.00,
//   margem_lucro: 30.00
// }
```

**SQL direto**:
```sql
SELECT * FROM get_dashboard_data(
  'okilao',
  '2024-10-01',
  '2024-10-31',
  ARRAY['1','4','7']::TEXT[]
);
```

---

### Exemplo 3: Buscar Indicadores de Todas as Filiais

**JavaScript/TypeScript**:
```typescript
const { data, error } = await supabase.rpc('get_dashboard_data', {
  schema_name: 'okilao',
  p_data_inicio: '2024-10-01',
  p_data_fim: '2024-10-31',
  p_filiais_ids: null  // NULL = todas as filiais
}).single()
```

**SQL direto**:
```sql
SELECT * FROM get_dashboard_data(
  'okilao',
  '2024-10-01',
  '2024-10-31',
  NULL
);
```

---

## Troubleshooting

### Erro: "function get_despesas_hierarquia does not exist"

**Causa**: Função não criada ou criada em schema errado

**Solução**:
```sql
-- Verificar se função existe
SELECT * FROM pg_proc WHERE proname = 'get_despesas_hierarquia';

-- Se não existir, executar migration que cria a função
-- Se existir em schema errado, recriar no schema correto (public)
```

---

### Erro: "permission denied for function get_despesas_hierarquia"

**Causa**: Role não tem permissão de execução

**Solução**:
```sql
-- Conceder permissão
GRANT EXECUTE ON FUNCTION get_despesas_hierarquia(TEXT, INTEGER, DATE, DATE, TEXT)
TO authenticated, service_role;
```

---

### Erro: "schema okilao does not exist"

**Causa**: Schema do tenant não existe ou não está exposto

**Solução**:
1. Verificar se schema existe:
   ```sql
   SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'okilao';
   ```

2. Se não existir, criar schema:
   ```sql
   CREATE SCHEMA okilao;
   ```

3. Adicionar schema aos "Exposed schemas" no Supabase Dashboard:
   - Settings → API → Exposed schemas
   - Adicionar: `public, graphql_public, okilao, saoluiz, paraiso, lucia`

---

### Erro: "relation despesas does not exist"

**Causa**: Tabela `despesas` não existe no schema do tenant

**Solução**:
```sql
-- Verificar tabelas no schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'okilao';

-- Se não existir, executar migrations para criar tabelas
```

---

### Performance Lenta

**Causa**: Falta de índices ou muitos dados

**Solução**:
1. Criar índices recomendados (veja seções acima)
2. Adicionar `EXPLAIN ANALYZE` para identificar gargalos:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM get_despesas_hierarquia('okilao', 1, '2024-10-01', '2024-10-31', 'data_emissao');
   ```

3. Considerar adicionar mais filtros (ex: apenas despesas ativas)

---

### Dados Retornados Vazios

**Causa**: Sem dados no período ou filial incorreta

**Solução**:
```sql
-- Verificar se há dados
SELECT COUNT(*) FROM okilao.despesas
WHERE filial_id = 1
  AND data_emissao BETWEEN '2024-10-01' AND '2024-10-31';

-- Verificar filiais existentes
SELECT DISTINCT filial_id FROM okilao.despesas;
```

---

## Manutenção e Versionamento

### Modificando Funções RPC

1. **Backup da função atual**:
   ```sql
   -- Exportar definição da função
   SELECT pg_get_functiondef(oid)
   FROM pg_proc
   WHERE proname = 'get_despesas_hierarquia';
   ```

2. **Criar nova versão**:
   ```sql
   CREATE OR REPLACE FUNCTION get_despesas_hierarquia(...)
   ...
   ```

3. **Testar nova versão**:
   ```sql
   SELECT * FROM get_despesas_hierarquia('okilao', 1, '2024-10-01', '2024-10-31', 'data_emissao');
   ```

4. **Deploy gradual**:
   - Testar em ambiente de staging
   - Validar com dados reais
   - Deploy em produção

5. **Rollback (se necessário)**:
   ```sql
   -- Restaurar função antiga do backup
   CREATE OR REPLACE FUNCTION get_despesas_hierarquia(...)
   ...
   ```

---

### Logs e Monitoramento

**Adicionar logs na função**:
```sql
CREATE OR REPLACE FUNCTION get_despesas_hierarquia(...)
AS $$
BEGIN
  -- Log de entrada
  RAISE NOTICE 'get_despesas_hierarquia - Schema: %, Filial: %, Período: % a %',
    p_schema, p_filial_id, p_data_inicial, p_data_final;

  -- Executar query
  RETURN QUERY EXECUTE ...

  -- Log de saída
  RAISE NOTICE 'get_despesas_hierarquia - Retornou % registros',
    (SELECT COUNT(*) FROM resultado);
END;
$$;
```

**Monitorar performance**:
```sql
-- Ver estatísticas de execução
SELECT * FROM pg_stat_statements
WHERE query LIKE '%get_despesas_hierarquia%'
ORDER BY total_exec_time DESC;
```

---

## Referências

- **Supabase Docs**: https://supabase.com/docs/guides/database/functions
- **PostgreSQL format()**: https://www.postgresql.org/docs/current/functions-string.html#FUNCTIONS-STRING-FORMAT
- **PostgreSQL Dynamic SQL**: https://www.postgresql.org/docs/current/plpgsql-statements.html#PLPGSQL-STATEMENTS-EXECUTING-DYN

---

## Manutenção

**Última atualização**: 2025-01-11
**Versão**: 1.0.0
**Owner**: Equipe Backend

Para modificar funções RPC:
1. Documentar mudanças neste arquivo
2. Criar migration SQL
3. Testar em staging
4. Executar em produção
5. Monitorar performance
