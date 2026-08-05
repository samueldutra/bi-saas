# RPC Functions - Metas Mensal

> Documentação completa das funções PostgreSQL RPC (Remote Procedure Call) utilizadas pelo módulo de Metas Mensais.

## Índice

1. [Visão Geral](#visão-geral)
2. [generate_metas_mensais](#generate_metas_mensais)
3. [get_metas_mensais_report](#get_metas_mensais_report)
4. [update_meta_mensal](#update_meta_mensal)
5. [atualizar_valores_realizados_metas](#atualizar_valores_realizados_metas)
6. [Dependências e Relacionamentos](#dependências-e-relacionamentos)
7. [Performance e Otimizações](#performance-e-otimizações)
8. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O módulo de Metas Mensais utiliza **4 funções RPC** para encapsular lógica de negócio complexa no banco de dados:

| Função | Tipo | Propósito |
|--------|------|-----------|
| `generate_metas_mensais` | INSERT | Gera metas para todos os dias de um mês |
| `get_metas_mensais_report` | SELECT | Busca metas com valores realizados |
| `get_metas_mensais_report_api_filial_vendas` | SELECT | Busca metas com realizados em `vendas_filiais_snapshot` |
| `get_metas_mensais_summary_by_filial_api_filial_vendas` | SELECT | Resume metas por filial com lucro/margem ajustados |
| `update_meta_mensal` | UPDATE | Atualiza meta individual (edição inline) |
| `atualizar_valores_realizados_metas` | UPDATE | Atualiza valores realizados em lote |

**Características Comuns**:
- Todas recebem `p_schema` como primeiro parâmetro para multi-tenancy
- Retornam `JSONB` para facilitar integração com JavaScript
- Executam dentro de transações automáticas do PostgreSQL
- Tratam NULL e edge cases

### Fonte alternativa `api_filial_vendas`

As funções com sufixo `_api_filial_vendas` são paralelas às legadas e só devem ser chamadas pelas APIs quando `enable_api_filial_vendas = true` para o schema corrente.

Elas mantêm o contrato JSON usado pela tela, mas substituem os realizados por:

| Campo no retorno | Origem |
|------------------|--------|
| `valor_realizado` | `{schema}.vendas_filiais_snapshot.valor` |
| `custo_realizado` | `{schema}.vendas_filiais_snapshot.custo_total_ajustado` |
| `lucro_realizado` | `{schema}.vendas_filiais_snapshot.lucro_ajustado` |
| `margem_realizada` / `margem_bruta` | `{schema}.vendas_filiais_snapshot.margem_ajustada_percentual` |

`get_metas_mensais_report_api_filial_vendas` e `get_metas_mensais_summary_by_filial_api_filial_vendas` retornam também `sales_source = api_filial_vendas` e `profit_source = vendas_filiais_snapshot`.

---

## generate_metas_mensais

### Descrição
Gera metas para todos os dias de um mês específico, baseadas no histórico de vendas do ano anterior. Substitui metas existentes para o mesmo período.

### Assinatura SQL

```sql
CREATE OR REPLACE FUNCTION generate_metas_mensais(
  p_schema TEXT,                    -- Schema do tenant (ex: "okilao")
  p_filial_id INTEGER,              -- ID da filial
  p_mes INTEGER,                    -- Mês (1-12)
  p_ano INTEGER,                    -- Ano (ex: 2024)
  p_meta_percentual NUMERIC,        -- Percentual da meta (ex: 105)
  p_data_referencia_inicial DATE    -- Data inicial de referência do ano anterior
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_metas_criadas INTEGER := 0;
  v_data_alvo DATE;
  v_data_ref DATE;
  v_valor_referencia NUMERIC;
  v_valor_meta NUMERIC;
  v_valor_realizado NUMERIC;
  v_diferenca NUMERIC;
  v_diferenca_pct NUMERIC;
  v_dia_semana TEXT;
  v_ultimo_dia INTEGER;
BEGIN
  -- Validações
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês inválido: %', p_mes;
  END IF;

  IF p_meta_percentual < 0 OR p_meta_percentual > 1000 THEN
    RAISE EXCEPTION 'Percentual inválido: %', p_meta_percentual;
  END IF;

  -- Deletar metas existentes
  EXECUTE format(
    'DELETE FROM %I.metas_mensais
     WHERE filial_id = $1
       AND EXTRACT(MONTH FROM data) = $2
       AND EXTRACT(YEAR FROM data) = $3',
    p_schema
  ) USING p_filial_id, p_mes, p_ano;

  -- Obter último dia do mês
  v_ultimo_dia := EXTRACT(DAY FROM (
    DATE_TRUNC('MONTH', MAKE_DATE(p_ano, p_mes, 1)) + INTERVAL '1 MONTH - 1 DAY'
  )::DATE);

  -- Loop por cada dia do mês
  FOR dia IN 1..v_ultimo_dia LOOP
    -- Construir data alvo e data de referência
    v_data_alvo := MAKE_DATE(p_ano, p_mes, dia);
    v_data_ref := MAKE_DATE(p_ano - 1, EXTRACT(MONTH FROM p_data_referencia_inicial)::INTEGER, dia);

    -- Obter dia da semana
    v_dia_semana := TO_CHAR(v_data_alvo, 'Day', 'pt_BR');
    v_dia_semana := TRIM(v_dia_semana);

    -- Buscar vendas do ano anterior (referência)
    EXECUTE format(
      'SELECT COALESCE(SUM(total_vendas), 0)
       FROM %I.vendas_diarias_por_filial
       WHERE filial_id = $1
         AND data_venda = $2',
      p_schema
    ) INTO v_valor_referencia
    USING p_filial_id, v_data_ref;

    -- Calcular valor da meta
    v_valor_meta := v_valor_referencia * (p_meta_percentual / 100);

    -- Buscar vendas realizadas (se a data já passou)
    IF v_data_alvo <= CURRENT_DATE THEN
      EXECUTE format(
        'SELECT COALESCE(SUM(total_vendas), 0)
         FROM %I.vendas_diarias_por_filial
         WHERE filial_id = $1
           AND data_venda = $2',
        p_schema
      ) INTO v_valor_realizado
      USING p_filial_id, v_data_alvo;
    ELSE
      v_valor_realizado := 0;
    END IF;

    -- Calcular diferenças
    v_diferenca := v_valor_realizado - v_valor_meta;

    IF v_valor_meta > 0 THEN
      v_diferenca_pct := (v_diferenca / v_valor_meta) * 100;
    ELSE
      v_diferenca_pct := 0;
    END IF;

    -- Inserir meta
    EXECUTE format(
      'INSERT INTO %I.metas_mensais (
         filial_id, data, dia_semana,
         meta_percentual, data_referencia, valor_referencia,
         valor_meta, valor_realizado,
         diferenca, diferenca_percentual,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())',
      p_schema
    ) USING
      p_filial_id, v_data_alvo, v_dia_semana,
      p_meta_percentual, v_data_ref, v_valor_referencia,
      v_valor_meta, v_valor_realizado,
      v_diferenca, v_diferenca_pct;

    v_metas_criadas := v_metas_criadas + 1;
  END LOOP;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'mensagem', 'Metas geradas com sucesso',
    'metas_criadas', v_metas_criadas,
    'mes', p_mes,
    'ano', p_ano,
    'filial_id', p_filial_id
  );
END;
$$;
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `p_schema` | TEXT | ✅ | Schema do tenant | `'okilao'` |
| `p_filial_id` | INTEGER | ✅ | ID da filial | `1` |
| `p_mes` | INTEGER | ✅ | Mês (1-12) | `1` |
| `p_ano` | INTEGER | ✅ | Ano | `2024` |
| `p_meta_percentual` | NUMERIC | ✅ | Percentual da meta | `105.0` |
| `p_data_referencia_inicial` | DATE | ✅ | Data inicial de referência | `'2023-01-01'` |

### Retorno

```json
{
  "mensagem": "Metas geradas com sucesso",
  "metas_criadas": 31,
  "mes": 1,
  "ano": 2024,
  "filial_id": 1
}
```

### Regras de Negócio

1. **Substituição**: DELETA todas as metas existentes para filial/mês/ano antes de criar novas
2. **Dias do Mês**: Gera 1 meta para cada dia do mês (28-31 dias dependendo do mês)
3. **Data de Referência**: Usa mesmo dia do mês do ano anterior
4. **Valores Realizados**: Se a data já passou, busca vendas; senão, fica zero
5. **Validações**:
   - Mês deve estar entre 1 e 12
   - Percentual deve estar entre 0 e 1000

### Exemplo de Uso

```sql
-- Gerar metas de Janeiro/2024 para Filial 1, com 105% de meta
SELECT generate_metas_mensais(
  'okilao',           -- p_schema
  1,                  -- p_filial_id
  1,                  -- p_mes (Janeiro)
  2024,               -- p_ano
  105.0,              -- p_meta_percentual (105%)
  '2023-01-01'        -- p_data_referencia_inicial
);
```

**Resultado**:
- 31 registros criados em `okilao.metas_mensais`
- Cada registro com `valor_meta = valor_referencia × 1.05`

### Chamada via API

```typescript
const response = await fetch('/api/metas/generate', {
  method: 'POST',
  body: JSON.stringify({
    schema: 'okilao',
    filialId: 1,
    mes: 1,
    ano: 2024,
    metaPercentual: 105,
    dataReferenciaInicial: '2023-01-01'
  })
})
```

---

## get_metas_mensais_report

### Descrição
Busca todas as metas de um período com valores realizados atualizados e calcula totalizadores gerais.

### Assinatura SQL

```sql
CREATE OR REPLACE FUNCTION get_metas_mensais_report(
  p_schema TEXT,                    -- Schema do tenant
  p_mes INTEGER,                    -- Mês (1-12)
  p_ano INTEGER,                    -- Ano
  p_filial_id INTEGER DEFAULT NULL, -- ID da filial (opcional)
  p_filial_ids INTEGER[] DEFAULT NULL -- Array de IDs (opcional)
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_metas JSONB;
  v_total_realizado NUMERIC := 0;
  v_total_meta NUMERIC := 0;
  v_percentual_atingido NUMERIC := 0;
  v_query TEXT;
BEGIN
  -- Construir query base
  v_query := format(
    'SELECT jsonb_agg(
       jsonb_build_object(
         ''id'', id,
         ''filial_id'', filial_id,
         ''data'', data,
         ''dia_semana'', dia_semana,
         ''meta_percentual'', meta_percentual,
         ''data_referencia'', data_referencia,
         ''valor_referencia'', valor_referencia,
         ''valor_meta'', valor_meta,
         ''valor_realizado'', valor_realizado,
         ''diferenca'', diferenca,
         ''diferenca_percentual'', diferenca_percentual
       ) ORDER BY data, filial_id
     )
     FROM %I.metas_mensais
     WHERE EXTRACT(MONTH FROM data) = $1
       AND EXTRACT(YEAR FROM data) = $2',
    p_schema
  );

  -- Adicionar filtro de filiais
  IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
    v_query := v_query || ' AND filial_id = ANY($3)';
    EXECUTE v_query INTO v_metas USING p_mes, p_ano, p_filial_ids;
  ELSIF p_filial_id IS NOT NULL THEN
    v_query := v_query || ' AND filial_id = $3';
    EXECUTE v_query INTO v_metas USING p_mes, p_ano, p_filial_id;
  ELSE
    EXECUTE v_query INTO v_metas USING p_mes, p_ano;
  END IF;

  -- Se não há metas, retornar vazio
  IF v_metas IS NULL THEN
    RETURN jsonb_build_object(
      'metas', '[]'::jsonb,
      'total_realizado', 0,
      'total_meta', 0,
      'percentual_atingido', 0
    );
  END IF;

  -- Calcular totalizadores
  v_query := format(
    'SELECT
       COALESCE(SUM(valor_realizado), 0),
       COALESCE(SUM(valor_meta), 0)
     FROM %I.metas_mensais
     WHERE EXTRACT(MONTH FROM data) = $1
       AND EXTRACT(YEAR FROM data) = $2',
    p_schema
  );

  -- Aplicar mesmo filtro de filiais
  IF p_filial_ids IS NOT NULL AND array_length(p_filial_ids, 1) > 0 THEN
    v_query := v_query || ' AND filial_id = ANY($3)';
    EXECUTE v_query INTO v_total_realizado, v_total_meta USING p_mes, p_ano, p_filial_ids;
  ELSIF p_filial_id IS NOT NULL THEN
    v_query := v_query || ' AND filial_id = $3';
    EXECUTE v_query INTO v_total_realizado, v_total_meta USING p_mes, p_ano, p_filial_id;
  ELSE
    EXECUTE v_query INTO v_total_realizado, v_total_meta USING p_mes, p_ano;
  END IF;

  -- Calcular percentual atingido
  IF v_total_meta > 0 THEN
    v_percentual_atingido := (v_total_realizado / v_total_meta) * 100;
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'metas', v_metas,
    'total_realizado', v_total_realizado,
    'total_meta', v_total_meta,
    'percentual_atingido', v_percentual_atingido
  );
END;
$$;
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `p_schema` | TEXT | ✅ | Schema do tenant | `'okilao'` |
| `p_mes` | INTEGER | ✅ | Mês (1-12) | `1` |
| `p_ano` | INTEGER | ✅ | Ano | `2024` |
| `p_filial_id` | INTEGER | ❌ | Filial única | `1` |
| `p_filial_ids` | INTEGER[] | ❌ | Array de filiais | `ARRAY[1,2,3]` |

**Lógica de Filiais**:
- Se `p_filial_ids` fornecido: filtra por array
- Senão, se `p_filial_id` fornecido: filtra por ID único
- Senão: retorna todas as filiais do tenant

### Retorno

```json
{
  "metas": [
    {
      "id": 1,
      "filial_id": 1,
      "data": "2024-01-01",
      "dia_semana": "Segunda",
      "meta_percentual": 105.0,
      "data_referencia": "2023-01-01",
      "valor_referencia": 15000.00,
      "valor_meta": 15750.00,
      "valor_realizado": 16200.00,
      "diferenca": 450.00,
      "diferenca_percentual": 2.86
    },
    {
      "id": 2,
      "filial_id": 1,
      "data": "2024-01-02",
      "dia_semana": "Terça",
      "meta_percentual": 105.0,
      "data_referencia": "2023-01-02",
      "valor_referencia": 17000.00,
      "valor_meta": 17850.00,
      "valor_realizado": 16500.00,
      "diferenca": -1350.00,
      "diferenca_percentual": -7.56
    }
  ],
  "total_realizado": 450000.00,
  "total_meta": 420000.00,
  "percentual_atingido": 107.14
}
```

### Ordenação

- **Primário**: `data` (ASC) - Ordena por data cronologicamente
- **Secundário**: `filial_id` (ASC) - Em caso de múltiplas filiais

### Exemplo de Uso

```sql
-- Filial única
SELECT get_metas_mensais_report(
  'okilao',           -- p_schema
  1,                  -- p_mes
  2024,               -- p_ano
  1,                  -- p_filial_id
  NULL                -- p_filial_ids
);

-- Múltiplas filiais
SELECT get_metas_mensais_report(
  'okilao',           -- p_schema
  1,                  -- p_mes
  2024,               -- p_ano
  NULL,               -- p_filial_id
  ARRAY[1, 2, 3]      -- p_filial_ids
);

-- Todas as filiais
SELECT get_metas_mensais_report(
  'okilao',           -- p_schema
  1,                  -- p_mes
  2024,               -- p_ano
  NULL,               -- p_filial_id
  NULL                -- p_filial_ids
);
```

### Chamada via API

```typescript
// Filial única
const response = await fetch(
  `/api/metas/report?schema=okilao&mes=1&ano=2024&filial_id=1`
)

// Múltiplas filiais
const response = await fetch(
  `/api/metas/report?schema=okilao&mes=1&ano=2024&filial_id=1,2,3`
)
```

---

## update_meta_mensal

### Descrição
Atualiza valor de meta individual (edição inline) e recalcula campos derivados.

### Assinatura SQL

```sql
CREATE OR REPLACE FUNCTION update_meta_mensal(
  p_schema TEXT,              -- Schema do tenant
  p_meta_id INTEGER,          -- ID da meta a atualizar
  p_valor_meta NUMERIC,       -- Novo valor da meta
  p_meta_percentual NUMERIC   -- Novo percentual
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_affected INTEGER;
BEGIN
  -- Validações (aplicadas na API Next.js, não na função SQL — ver nota abaixo)
  -- Atualizar meta
  EXECUTE format(
    'UPDATE %I.metas_mensais
     SET valor_meta = $1,
         meta_percentual = $2,
         diferenca = valor_realizado - $1,
         diferenca_percentual = CASE
           WHEN $1 > 0 THEN ((valor_realizado - $1) / $1) * 100
           ELSE 0
         END,
         updated_at = NOW()
     WHERE id = $3',
    p_schema
  ) USING p_valor_meta, p_meta_percentual, p_meta_id;

  -- Verificar se atualizou
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'Meta com ID % não encontrada', p_meta_id;
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'rows_affected', v_rows_affected
  );
END;
$$;
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `p_schema` | TEXT | ✅ | Schema do tenant | `'okilao'` |
| `p_meta_id` | INTEGER | ✅ | ID da meta | `123` |
| `p_valor_meta` | NUMERIC | ✅ | Novo valor da meta | `18000.00` |
| `p_meta_percentual` | NUMERIC | ✅ | Novo percentual | `108.0` |

### Retorno

```json
{
  "rows_affected": 1
}
```

### Campos Atualizados

- ✅ `valor_meta` - Novo valor informado
- ✅ `meta_percentual` - Novo percentual informado
- ✅ `diferenca` - Recalculado: `valor_realizado - valor_meta`
- ✅ `diferenca_percentual` - Recalculado: `(diferenca / valor_meta) × 100`
- ✅ `updated_at` - Timestamp da atualização

### Validações

A função SQL em si não valida `p_valor_meta`/`p_meta_percentual` (apenas verifica que a meta existe). Quem valida é a API `POST /api/metas/update` ([route.ts](../../../src/app/api/metas/update/route.ts)):

1. `meta_percentual` deve ser ≥ -100% (não há teto superior de negócio — é um valor derivado de `valorMeta / valor_referencia`, que pode ser bem alto para filiais/dias com referência baixa)
2. Meta com `p_meta_id` deve existir (verificado antes de chamar a RPC)
3. **Limite físico**: a coluna `metas_mensais.meta_percentual` é `numeric(9, 2)` (desde 2026-08-05; era `numeric(5, 2)`, limitado a 999.99%) — ver [migration 20260805120000](../../../supabase/migrations/20260805120000_widen_meta_percentual_metas_mensais.sql). Valores acima disso ainda falham com `numeric field overflow` (SQLSTATE `22003`).

### Exemplo de Uso

```sql
-- Atualizar meta ID 123 para R$ 18.000 (108%)
SELECT update_meta_mensal(
  'okilao',    -- p_schema
  123,         -- p_meta_id
  18000.00,    -- p_valor_meta
  108.0        -- p_meta_percentual
);
```

**Antes**:
```
id | valor_meta | meta_percentual | valor_realizado | diferenca | diferenca_pct
123| 15750.00   | 105.0           | 16200.00        | 450.00    | 2.86
```

**Depois**:
```
id | valor_meta | meta_percentual | valor_realizado | diferenca | diferenca_pct
123| 18000.00   | 108.0           | 16200.00        | -1800.00  | -10.00
```

### Chamada via API

```typescript
const response = await fetch('/api/metas/update', {
  method: 'POST',
  body: JSON.stringify({
    schema: 'okilao',
    metaId: 123,
    valorMeta: 18000.00,
    metaPercentual: 108
  })
})
```

---

## atualizar_valores_realizados_metas

### Descrição
Atualiza valores realizados de todas as metas de um período em lote, sincronizando com a tabela de vendas diárias.

### Assinatura SQL

```sql
CREATE OR REPLACE FUNCTION atualizar_valores_realizados_metas(
  p_schema TEXT,                    -- Schema do tenant
  p_mes INTEGER,                    -- Mês (1-12)
  p_ano INTEGER,                    -- Ano
  p_filial_id INTEGER DEFAULT NULL  -- Filial específica (opcional)
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_metas_atualizadas INTEGER;
  v_query TEXT;
BEGIN
  -- Construir query de atualização com JOIN
  v_query := format(
    'UPDATE %I.metas_mensais mm
     SET valor_realizado = COALESCE(vd.total_vendas, 0),
         diferenca = COALESCE(vd.total_vendas, 0) - mm.valor_meta,
         diferenca_percentual = CASE
           WHEN mm.valor_meta > 0 THEN
             ((COALESCE(vd.total_vendas, 0) - mm.valor_meta) / mm.valor_meta) * 100
           ELSE 0
         END,
         updated_at = NOW()
     FROM (
       SELECT
         filial_id,
         data_venda,
         SUM(total_vendas) AS total_vendas
       FROM %I.vendas_diarias_por_filial
       WHERE EXTRACT(MONTH FROM data_venda) = $1
         AND EXTRACT(YEAR FROM data_venda) = $2',
    p_schema, p_schema
  );

  -- Adicionar filtro de filial se fornecido
  IF p_filial_id IS NOT NULL THEN
    v_query := v_query || ' AND filial_id = $3';
  END IF;

  v_query := v_query || format(
    '     GROUP BY filial_id, data_venda
     ) vd
     WHERE mm.filial_id = vd.filial_id
       AND mm.data = vd.data_venda
       AND EXTRACT(MONTH FROM mm.data) = $1
       AND EXTRACT(YEAR FROM mm.data) = $2'
  );

  -- Adicionar filtro de filial no WHERE também
  IF p_filial_id IS NOT NULL THEN
    v_query := v_query || ' AND mm.filial_id = $3';
  END IF;

  -- Executar atualização
  IF p_filial_id IS NOT NULL THEN
    EXECUTE v_query USING p_mes, p_ano, p_filial_id;
  ELSE
    EXECUTE v_query USING p_mes, p_ano;
  END IF;

  -- Contar registros afetados
  GET DIAGNOSTICS v_metas_atualizadas = ROW_COUNT;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'mensagem', 'Valores atualizados com sucesso',
    'metas_atualizadas', v_metas_atualizadas
  );
END;
$$;
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `p_schema` | TEXT | ✅ | Schema do tenant | `'okilao'` |
| `p_mes` | INTEGER | ✅ | Mês (1-12) | `1` |
| `p_ano` | INTEGER | ✅ | Ano | `2024` |
| `p_filial_id` | INTEGER | ❌ | Filial específica | `1` |

### Retorno

```json
{
  "mensagem": "Valores atualizados com sucesso",
  "metas_atualizadas": 93
}
```

### Lógica de Atualização

```sql
-- Para cada meta do período
UPDATE metas_mensais mm
SET
  valor_realizado = SUM(vendas.total_vendas),  -- Soma das vendas do dia
  diferenca = valor_realizado - valor_meta,
  diferenca_percentual = (diferenca / valor_meta) * 100
FROM vendas_diarias_por_filial vendas
WHERE mm.filial_id = vendas.filial_id
  AND mm.data = vendas.data_venda
```

### Comportamento

- **LEFT JOIN Implícito**: Se não houver vendas para um dia, `valor_realizado` fica `0`
- **Agrupamento**: Agrupa vendas por `filial_id + data_venda`
- **Recálculo Automático**: Atualiza `diferenca` e `diferenca_percentual`

### Exemplo de Uso

```sql
-- Atualizar todas as filiais de Janeiro/2024
SELECT atualizar_valores_realizados_metas(
  'okilao',    -- p_schema
  1,           -- p_mes
  2024,        -- p_ano
  NULL         -- p_filial_id (todas)
);

-- Atualizar apenas Filial 1 de Janeiro/2024
SELECT atualizar_valores_realizados_metas(
  'okilao',    -- p_schema
  1,           -- p_mes
  2024,        -- p_ano
  1            -- p_filial_id
);
```

### Chamada via API

```typescript
// Background update (fire and forget)
fetch('/api/metas/update', {
  method: 'POST',
  body: JSON.stringify({
    schema: 'okilao',
    mes: 1,
    ano: 2024,
    filial_id: 1  // Opcional
  })
})
```

**Nota**: No frontend, esta chamada é feita sem `await` antes de buscar o relatório.

---

## Dependências e Relacionamentos

### Tabelas Utilizadas

```
{schema}.metas_mensais
├── PRIMARY KEY: id
├── FOREIGN KEY: filial_id → {schema}.filiais.id
├── UNIQUE: (filial_id, data)
└── INDEXES:
    - idx_metas_filial_data (filial_id, data)
    - idx_metas_data (data)

{schema}.vendas_diarias_por_filial
├── PRIMARY KEY: (filial_id, data_venda)
└── INDEXES:
    - idx_vendas_data (data_venda)
```

### Fluxo de Dependências

```
vendas_diarias_por_filial (ano anterior)
         │
         ▼
generate_metas_mensais → metas_mensais
         │
         ▼
vendas_diarias_por_filial (ano atual)
         │
         ▼
atualizar_valores_realizados_metas → metas_mensais
         │
         ▼
get_metas_mensais_report → MetasReport
```

---

## Performance e Otimizações

### Índices Recomendados

```sql
-- Metas Mensais
CREATE INDEX idx_metas_mensais_filial_data
  ON {schema}.metas_mensais(filial_id, data);

CREATE INDEX idx_metas_mensais_data
  ON {schema}.metas_mensais(data);

CREATE INDEX idx_metas_mensais_mes_ano
  ON {schema}.metas_mensais((EXTRACT(MONTH FROM data)), (EXTRACT(YEAR FROM data)));

-- Vendas Diárias
CREATE INDEX idx_vendas_filial_data
  ON {schema}.vendas_diarias_por_filial(filial_id, data_venda);

CREATE INDEX idx_vendas_data
  ON {schema}.vendas_diarias_por_filial(data_venda);
```

### Tempos Estimados

| Função | Registros | Tempo Médio |
|--------|-----------|-------------|
| `generate_metas_mensais` | 31 | 200-500ms |
| `get_metas_mensais_report` | 93 (3 filiais) | 50-150ms |
| `update_meta_mensal` | 1 | 10-30ms |
| `atualizar_valores_realizados_metas` | 93 | 100-300ms |

**Observação**: Tempos variam com volume de dados e infraestrutura.

### Otimizações Aplicadas

1. **JSONB Aggregation**: Usa `jsonb_agg` para retornar arrays diretamente
2. **Índices Compostos**: Busca por `(filial_id, data)` é eficiente
3. **COALESCE**: Trata NULL em agregações
4. **Dynamic SQL**: Usa `format()` para multi-tenancy sem overhead
5. **Batch Updates**: `atualizar_valores_realizados_metas` atualiza múltiplos registros em 1 query

---

## Troubleshooting

### Erro: "relation does not exist"

**Causa**: Tabela `metas_mensais` não existe no schema

**Solução**:
```sql
-- Verificar se tabela existe
SELECT tablename
FROM pg_tables
WHERE schemaname = 'okilao'
  AND tablename = 'metas_mensais';

-- Se não existir, aplicar migration
CREATE TABLE okilao.metas_mensais (
  -- ... definição completa
);
```

---

### Erro: "schema must be one of the following"

**Causa**: Schema não está em "Exposed schemas" no Supabase

**Solução**:
1. Supabase Dashboard → Settings → API
2. Adicionar schema à lista: `public, okilao, saoluiz, ...`
3. Aguardar 1-2 minutos

---

### Erro: "Mês inválido"

**Causa**: Parâmetro `p_mes` fora do range 1-12

**Solução**:
```typescript
// Validar no frontend
if (mes < 1 || mes > 12) {
  alert('Mês deve estar entre 1 e 12')
  return
}
```

---

### Performance Lenta

**Causa**: Falta de índices

**Solução**:
```sql
-- Analisar query plan
EXPLAIN ANALYZE
SELECT * FROM okilao.metas_mensais
WHERE filial_id = 1
  AND data BETWEEN '2024-01-01' AND '2024-01-31';

-- Se mostrar Seq Scan, criar índice
CREATE INDEX idx_metas_filial_data
  ON okilao.metas_mensais(filial_id, data);
```

---

### Metas com Valor Realizado Zerado

**Causa**: Tabela `vendas_diarias_por_filial` não tem dados ou JOIN não encontrou correspondência

**Diagnóstico**:
```sql
-- Verificar se há vendas
SELECT COUNT(*)
FROM okilao.vendas_diarias_por_filial
WHERE filial_id = 1
  AND data_venda BETWEEN '2024-01-01' AND '2024-01-31';

-- Se retornar 0, faltam dados de vendas
-- Se retornar > 0, executar atualização manual
SELECT atualizar_valores_realizados_metas('okilao', 1, 2024, 1);
```

---

## Versionamento

**RPC Functions Version**: 1.0.0
**Última Atualização**: 2025-01-11
**Compatível com**: Metas Mensal v1.5.0

---

## Referências

- [README.md](./README.md) - Visão geral do módulo
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Regras de negócio detalhadas
- [DATA_STRUCTURES.md](./DATA_STRUCTURES.md) - Estruturas de dados e tipos
- [INTEGRATION_FLOW.md](./INTEGRATION_FLOW.md) - Fluxo de integração completo
- [CHANGELOG.md](./CHANGELOG.md) - Histórico de versões

---

## Notas de Migração

### v1.0.0 → v1.1.0 (Futuro)

Mudanças planejadas:
- [ ] Adicionar suporte a `p_data_referencia_final` em `generate_metas_mensais`
- [ ] Otimizar `get_metas_mensais_report` com CTE
- [ ] Adicionar função `delete_metas_mensais(p_schema, p_filial_id, p_mes, p_ano)`
- [ ] Implementar soft delete com campo `deleted_at`
