# Funções RPC - Vendas por Curva

> Status: ✅ Implementado

## Função: `get_venda_curva_report`

### Assinatura

```sql
CREATE OR REPLACE FUNCTION public.get_venda_curva_report(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_id bigint DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  produto_codigo bigint,
  produto_descricao text,
  filial_id bigint,
  qtde numeric,
  valor_vendas numeric,
  valor_lucro numeric,
  percentual_lucro numeric,
  curva_venda text,
  curva_lucro text
)
LANGUAGE plpgsql
```

### Descrição

Retorna as vendas agregadas por produto e departamento para um período mensal, incluindo curvas de venda e lucro. A função executa uma consulta dinâmica baseada no schema, calcula lucro e percentual de lucro e aplica paginação por **departamento nível 3**.

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `p_schema` | text | sim | Schema do tenant | `demo` |
| `p_mes` | integer | sim | Mês (1-12) | `1` |
| `p_ano` | integer | sim | Ano (YYYY) | `2026` |
| `p_filial_id` | bigint | não | Filial específica | `1` |
| `p_page` | integer | não | Página (base 1) | `1` |
| `p_page_size` | integer | não | Tamanho da página | `50` |
| `p_data_fim_override` | date | não | Data fim exclusiva para corte do período | `2025-01-19` |

### Retorno

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `dept_nivel3` | text | Nome do departamento nível 3 |
| `dept_nivel2` | text | Nome do departamento nível 2 |
| `dept_nivel1` | text | Nome do departamento nível 1 |
| `produto_codigo` | bigint | Código do produto |
| `produto_descricao` | text | Descrição do produto |
| `filial_id` | bigint | ID da filial |
| `qtde` | numeric | Quantidade vendida |
| `valor_vendas` | numeric | Valor total vendido |
| `valor_lucro` | numeric | Lucro total |
| `percentual_lucro` | numeric | % de lucro |
| `curva_venda` | text | Curva de venda (A/B/C/D) |
| `curva_lucro` | text | Curva de lucro (A/B/C/D) |

### Regras de Cálculo

- **Período**: do 1º dia do mês até o 1º dia do mês seguinte (exclusivo).
  - Se `p_data_fim_override` for informado, ele substitui o fim do mês (uso em mês atual).
- **Quantidade**: `SUM(v.quantidade)`.
- **Valor Vendas**: `SUM(v.valor_vendas)`.
- **Lucro**: `SUM(valor_vendas - (custo_compra * quantidade))`.
- **% Lucro**: `(lucro / valor_vendas) * 100` (0 se valor_vendas = 0).
- **Curvas**:
  - `curva_venda` = `produtos.curva_abcd` (default `D`)
  - `curva_lucro` = `produtos.curva_lucro` (default `D`)

### Filtros Aplicados

- `v.data_venda` dentro do intervalo do mês
- `v.valor_vendas > 0`
- `p.ativo = true`
- `p_filial_id` se informado

### Ordenação

- Nível 3/2/1 por `total_vendas DESC`
- Produtos por:
  1. `curva_venda` (A → B → C → D → outros)
  2. `total_valor_vendas DESC`

### Paginação

- Baseada no total de **departamentos nível 3**.
- A função retorna apenas produtos pertencentes aos deptos nível 3 da página atual.

### Exemplo de Uso

```sql
select *
from public.get_venda_curva_report(
  p_schema => 'demo',
  p_mes => 1,
  p_ano => 2026,
  p_filial_id => 1,
  p_page => 1,
  p_page_size => 50
);
```

### Observações Importantes

- A função **não calcula** curva ABC; ela utiliza os dados já cadastrados em `produtos`.
- A função utiliza SQL dinâmico para suportar múltiplos schemas.

### Índices Relevantes

- `demo.vendas`: índices em `data_venda`, `filial_id`, `id_produto` com includes.
- `demo.produtos`: índices em `departamento_id`, `curva_abc`, `(id, filial_id)`.

---

## Função: `get_venda_curva_report_fast`

### Objetivo

Versão otimizada que usa a tabela de agregados mensais (`vendas_mensal_produto`) para reduzir drasticamente custo de CPU e IO. O comparativo do ano anterior é calculado dentro da própria função.

### Tabela de Agregados (base)

```sql
CREATE TABLE IF NOT EXISTS demo.vendas_mensal_produto (
  ano smallint not null,
  mes smallint not null,
  filial_id bigint not null,
  id_produto bigint not null,
  total_qtde numeric(15, 5) not null default 0,
  total_valor_vendas numeric(15, 5) not null default 0,
  total_lucro numeric(15, 5) not null default 0,
  primary key (ano, mes, filial_id, id_produto)
);
```

### Assinatura

```sql
CREATE OR REPLACE FUNCTION public.get_venda_curva_report_fast(
  p_schema text,
  p_mes integer,
  p_ano integer,
  p_filial_ids bigint[] DEFAULT NULL::bigint[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_data_fim_override date DEFAULT NULL::date
)
RETURNS TABLE(
  dept_nivel3 text,
  dept_nivel2 text,
  dept_nivel1 text,
  produto_codigo bigint,
  produto_descricao text,
  filial_id bigint,
  qtde numeric,
  valor_vendas numeric,
  valor_lucro numeric,
  percentual_lucro numeric,
  curva_venda text,
  curva_lucro text,
  qtde_ano_anterior numeric,
  valor_vendas_ano_anterior numeric,
  valor_lucro_ano_anterior numeric,
  percentual_lucro_ano_anterior numeric
)
LANGUAGE plpgsql
```

### Observações

- Mantém a mesma paginação por **departamento nível 3**.
- Evita varrer `vendas` a cada request.
- O comparativo do ano anterior é retornado na mesma linha, sem RPC adicional.
- Quando `p_data_fim_override` é informado, o comparativo do ano anterior é cortado até a mesma data (D-1), usando `vendas` apenas para o período necessário.

---

## Função: `get_venda_curva_totais`

### Objetivo

Retorna apenas os totais por departamento (níveis 3/2/1) para viabilizar lazy-load de produtos no frontend.

---

## Função: `get_venda_curva_produtos`

### Objetivo

Retorna produtos de um **subgrupo (nível 1)** com paginação (50 por vez). Suporta filtro de busca via `p_search`.
