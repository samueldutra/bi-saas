# 📊 Release Notes - Versão 2.6.0

## Dashboard 360 com origem PDV baseada na API `/filial/vendas`

**Data de Lançamento:** 01 de Abril de 2026

---

## 🎯 Resumo

Esta versão adiciona suporte para trocar a origem dos dados de **vendas PDV** do `Dashboard 360` por tenant, usando o parâmetro `enable_api_filial_vendas`.

Quando o parâmetro estiver ativo, o módulo deixa de usar exclusivamente a base legada `vendas_diarias_por_filial` e passa a consumir uma nova família de RPCs baseada em `vendas_filiais_snapshot`, estrutura que espelha a API `/filial/vendas`.

---

## ✨ Novidades

### 1. Nova chave de comportamento por tenant

O parâmetro `enable_api_filial_vendas` agora possui efeito funcional real no sistema.

| Valor | Comportamento |
|---|---|
| `false` | Mantém o comportamento legado baseado em `vendas_diarias_por_filial` |
| `true` | Usa as novas RPCs baseadas em `vendas_filiais_snapshot` |

---

### 2. Dashboard 360 com chaveamento de origem PDV

As seguintes APIs do `Dashboard 360` agora selecionam dinamicamente a família de RPCs com base no tenant:

- `/api/dashboard`
- `/api/dashboard/ytd-metrics`
- `/api/dashboard/mtd-metrics`
- `/api/dashboard/vendas-por-filial`
- `/api/charts/sales-by-month`

Isso permite ativar a nova origem somente nos tenants desejados, sem quebrar o legado dos demais.

---

### 3. Novas RPCs paralelas para a fonte `/filial/vendas`

Foi criada uma migration dedicada com as versões novas das funções do módulo:

- `get_dashboard_data_api_filial_vendas`
- `get_dashboard_mtd_metrics_api_filial_vendas`
- `get_dashboard_ytd_metrics_api_filial_vendas`
- `get_sales_by_month_chart_api_filial_vendas`
- `get_lucro_by_month_chart_api_filial_vendas`
- `get_vendas_por_filial_api_filial_vendas`

**Arquivo**:
- [`supabase/migrations/20260401143000_dashboard_api_filial_vendas_flag.sql`](../supabase/migrations/20260401143000_dashboard_api_filial_vendas_flag.sql)

---

### 4. Nova regra de Ticket Médio

Quando a fonte `/filial/vendas` estiver ativa, o `ticket médio` do PDV passa a usar:

```text
ticket_medio = vendas / quantidade_clientes
```

Essa regra foi aplicada nas RPCs novas do `Dashboard 360`.

---

## 🧩 Origem dos dados

### Base legada

- `{schema}.vendas_diarias_por_filial`
- `{schema}.resumo_vendas_caixa`

### Nova base

- `{schema}.vendas_filiais_snapshot`

### Mapeamento principal da nova base

| Campo da nova base | Papel no Dashboard 360 |
|---|---|
| `valor` | Receita PDV |
| `custo_total_ajustado` | Custo PDV |
| `lucro_ajustado` | Lucro PDV |
| `margem_ajustada_percentual` | Margem PDV |
| `quantidade_unidades_vendidas` | Quantidade total |
| `quantidade_clientes` | Clientes/cupons para ticket médio e colunas operacionais equivalentes |

---

## 🔧 Alterações Técnicas

### Backend

- criação do helper server-side `isApiFilialVendasEnabled(schema)`
- chaveamento nas APIs do dashboard para escolha de RPC
- manutenção total da compatibilidade com a família legada

### Configurações

- o texto do toggle `Utiliza API /filial/vendas` foi atualizado para refletir o novo comportamento

### Documentação

Foram atualizadas as documentações oficiais de:

- `Dashboard 360`
- `Configurações > Parâmetros`

---

## 📋 Notas Importantes

- Esta release **não remove** nem altera as funções legadas do dashboard.
- A nova lógica depende da aplicação da migration SQL no banco.
- O tenant `paraiso` já foi identificado com `enable_api_filial_vendas = true` no ambiente analisado.
- Como `/api/dashboard` é compartilhada, consumidores indiretos dessa rota também passam a respeitar o parâmetro por tenant.

---

## 🚀 Passos para publicação

1. Aplicar a migration `20260401143000_dashboard_api_filial_vendas_flag.sql`
2. Revisar o diff final
3. Commitar as mudanças
4. Criar a tag/release da versão

### Sugestão de mensagem de commit

```bash
git commit -m "Release: prepara v2.6.0 com Dashboard 360 via API /filial/vendas"
```

### Sugestão de tag

```bash
git tag -a v2.6.0 -m "Dashboard 360 com origem PDV via API /filial/vendas"
```

---

## 🆘 Observação operacional

Sem aplicar a migration no Supabase, as APIs chaveadas por `enable_api_filial_vendas` tentarão usar funções que ainda não existirão no banco.
