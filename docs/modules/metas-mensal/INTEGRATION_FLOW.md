# Integration Flow - Metas Mensal

> Documentação completa dos fluxos de integração entre Frontend, API Routes, RPC Functions e Database do módulo de Metas Mensais.

## Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Fluxo 1: Geração de Metas](#fluxo-1-geração-de-metas)
3. [Fluxo 2: Visualização de Metas](#fluxo-2-visualização-de-metas)
4. [Fluxo 3: Edição Inline](#fluxo-3-edição-inline)
5. [Fluxo 4: Atualização de Valores Realizados](#fluxo-4-atualização-de-valores-realizados)
6. [Fluxo 5: Auto-Seleção de Filiais](#fluxo-5-auto-seleção-de-filiais)
7. [Fluxo 6: Agrupamento por Data](#fluxo-6-agrupamento-por-data)
8. [Autenticação e Autorização](#autenticação-e-autorização)
9. [Tratamento de Erros](#tratamento-de-erros)
10. [Diagramas de Sequência](#diagramas-de-sequência)

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  page.tsx (React Client Component)                        │  │
│  │  - Estados (metas, filtros, edição)                       │  │
│  │  - Hooks (useTenantContext, useBranchesOptions)           │  │
│  │  - Componentes (MetasFilters, Cards, Tables, Dialogs)     │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                    │ fetch()                                     │
└────────────────────┼─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES (Next.js)                        │
│                                                                   │
│  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ /api/metas/       │  │ /api/metas/      │  │ /api/metas/  │ │
│  │ generate          │  │ report           │  │ update       │ │
│  │ (POST)            │  │ (GET)            │  │ (POST)       │ │
│  └─────┬─────────────┘  └────┬─────────────┘  └───┬──────────┘ │
│        │ supabase.rpc()       │                    │            │
└────────┼──────────────────────┼────────────────────┼────────────┘
         │                      │                    │
         ▼                      ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (PostgreSQL)                        │
│                                                                   │
│  ┌────────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ generate_metas_    │  │ get_metas_      │  │ update_meta_ │ │
│  │ mensais()          │  │ mensais_report()│  │ mensal()     │ │
│  │ (RPC Function)     │  │ (RPC Function)  │  │ (RPC)        │ │
│  └─────┬──────────────┘  └────┬────────────┘  └───┬──────────┘ │
│        │ SQL                   │ SQL               │ SQL        │
│        ▼                       ▼                   ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            {schema}.metas_mensais (Table)               │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │ id, filial_id, data, dia_semana,                │   │   │
│  │  │ meta_percentual, data_referencia,                │   │   │
│  │  │ valor_referencia, valor_meta,                    │   │   │
│  │  │ valor_realizado, diferenca, diferenca_percentual │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────┬──────────────────────────┘   │
│                                  │                              │
│  ┌───────────────────────────────┴──────────────────────────┐  │
│  │    {schema}.vendas_diarias_por_filial (Table)            │  │
│  │  ┌───────────────────────────────────────────────────┐   │  │
│  │  │ filial_id, data_venda, total_vendas              │   │  │
│  │  └───────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Fluxo 1: Geração de Metas

### Descrição
Criação de metas para todos os dias de um mês específico, baseada no histórico de vendas do ano anterior.

### Trigger
Usuário clica em "Gerar Metas" → preenche formulário → clica em "Gerar Metas"

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [1] Usuário clica "Gerar Metas"
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Dialog abre com formulário                                       │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ • Filial: [Select]                                        │  │
│ │ • Mês: [Select]                                           │  │
│ │ • Ano: [Select]                                           │  │
│ │ • Meta Percentual: [Input] (ex: 105)                      │  │
│ │ • Data Referência: [Calendar] (ex: 01/01/2023)            │  │
│ │ [Gerar Metas] [Cancelar]                                  │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [2] Usuário clica "Gerar Metas"
  │     → handleGerarMetas()
  │     → setGenerating(true)
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/metas/generate                                         │
│ Body: {                                                          │
│   schema: "okilao",                                              │
│   filialId: 1,                                                   │
│   mes: 1,                                                        │
│   ano: 2024,                                                     │
│   metaPercentual: 105,                                           │
│   dataReferenciaInicial: "2023-01-01"                            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [3] API Route valida autenticação
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const { data: { user } } = await supabase.auth.getUser()        │
│ if (!user) return 401                                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [4] API Route valida autorização de filial
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const authorizedBranches =                                       │
│   await getUserAuthorizedBranchCodes(supabase, user.id)          │
│                                                                   │
│ IF authorizedBranches !== null THEN                              │
│   • Usuário tem restrições                                       │
│   • Valida se filialId está em authorizedBranches                │
│   • Se não estiver, usa primeira filial autorizada               │
│ ELSE                                                              │
│   • Usuário sem restrições                                       │
│   • Usa filialId do request                                      │
│ END IF                                                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [5] Chama RPC Function
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ supabase.rpc('generate_metas_mensais', {                         │
│   p_schema: 'okilao',                                            │
│   p_filial_id: 1,                                                │
│   p_mes: 1,                                                      │
│   p_ano: 2024,                                                   │
│   p_meta_percentual: 105,                                        │
│   p_data_referencia_inicial: '2023-01-01'                        │
│ })                                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [6] RPC Function executa lógica
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE RPC: generate_metas_mensais                             │
│                                                                   │
│ [6.1] DELETE metas existentes                                    │
│   DELETE FROM {schema}.metas_mensais                             │
│   WHERE filial_id = p_filial_id                                  │
│     AND EXTRACT(MONTH FROM data) = p_mes                         │
│     AND EXTRACT(YEAR FROM data) = p_ano                          │
│                                                                   │
│ [6.2] LOOP por cada dia do mês                                   │
│   FOR dia IN 1..ultimo_dia_mes LOOP                              │
│                                                                   │
│     [6.2.1] Monta data alvo e data referência                    │
│       data_alvo = MAKE_DATE(p_ano, p_mes, dia)                   │
│       data_ref = MAKE_DATE(p_ano - 1, p_mes, dia)                │
│                                                                   │
│     [6.2.2] Busca vendas do ano anterior                         │
│       SELECT COALESCE(SUM(total_vendas), 0)                      │
│       INTO v_valor_referencia                                    │
│       FROM {schema}.vendas_diarias_por_filial                    │
│       WHERE filial_id = p_filial_id                              │
│         AND data_venda = data_ref                                │
│                                                                   │
│     [6.2.3] Calcula valor da meta                                │
│       v_valor_meta = v_valor_referencia * (p_meta_percentual/100)│
│                                                                   │
│     [6.2.4] Busca vendas realizadas (se já passaram)             │
│       SELECT COALESCE(SUM(total_vendas), 0)                      │
│       INTO v_valor_realizado                                     │
│       FROM {schema}.vendas_diarias_por_filial                    │
│       WHERE filial_id = p_filial_id                              │
│         AND data_venda = data_alvo                               │
│                                                                   │
│     [6.2.5] Calcula diferenças                                   │
│       v_diferenca = v_valor_realizado - v_valor_meta             │
│       v_diferenca_pct = (v_diferenca / v_valor_meta) * 100       │
│                                                                   │
│     [6.2.6] Insere registro                                      │
│       INSERT INTO {schema}.metas_mensais (                       │
│         filial_id, data, dia_semana,                             │
│         meta_percentual, data_referencia, valor_referencia,      │
│         valor_meta, valor_realizado,                             │
│         diferenca, diferenca_percentual                          │
│       ) VALUES (...)                                             │
│                                                                   │
│     [6.2.7] Incrementa contador                                  │
│       v_metas_criadas = v_metas_criadas + 1                      │
│                                                                   │
│   END LOOP                                                       │
│                                                                   │
│ [6.3] Retorna resultado                                          │
│   RETURN JSONB_BUILD_OBJECT(                                     │
│     'mensagem', 'Metas geradas com sucesso',                     │
│     'metas_criadas', v_metas_criadas,                            │
│     'mes', p_mes,                                                │
│     'ano', p_ano,                                                │
│     'filial_id', p_filial_id                                     │
│   )                                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [7] Retorna para API Route
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ return NextResponse.json(data)                                   │
│ {                                                                │
│   "mensagem": "Metas geradas com sucesso",                       │
│   "metas_criadas": 31,                                           │
│   "mes": 1,                                                      │
│   "ano": 2024,                                                   │
│   "filial_id": 1                                                 │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [8] Retorna para Frontend
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                               │
│                                                                   │
│ [8.1] Exibe toast de sucesso                                     │
│   "31 metas foram geradas para Janeiro/2024"                     │
│                                                                   │
│ [8.2] Fecha dialog                                               │
│   setDialogOpen(false)                                           │
│                                                                   │
│ [8.3] Atualiza filtros para o mês gerado                         │
│   setMes(formMes)                                                │
│   setAno(formAno)                                                │
│   setFiliaisSelecionadas([filial gerada])                        │
│                                                                   │
│ [8.4] Busca relatório automaticamente                            │
│   → Trigger Fluxo 2 (Visualização)                               │
│                                                                   │
│ [8.5] setGenerating(false)                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Pontos de Atenção

1. **Substituição de Metas**: Gerar metas para um mês que já tem metas **DELETA** as existentes antes de criar novas.
2. **Validação de Filiais**: Usuários com restrições só podem gerar metas para filiais autorizadas.
3. **Valores Realizados**: Se a data já passou, a função busca valores realizados; senão, fica zerado.
4. **Transação Implícita**: O RPC executa dentro de uma transação automática do PostgreSQL.

---

## Fluxo 2: Visualização de Metas

### Descrição
Busca e exibição de metas existentes com valores realizados atualizados, aplicando filtros de filial, mês e ano.

### Trigger
- Usuário altera filtros e clica "Filtrar"
- Após gerar metas (Fluxo 1)
- Após editar meta (Fluxo 3)
- Ao carregar a página (useEffect inicial)

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [1] Usuário altera filtros
  │     • Seleciona filiais
  │     • Seleciona mês
  │     • Seleciona ano
  │     • Clica "Filtrar"
  │     → handleFilter()
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ [2] Validações pré-fetch                                         │
│   IF (!currentTenant) RETURN                                     │
│   IF (!mes || !ano) RETURN                                       │
│   IF (filiaisSelecionadas.length === 0) RETURN                   │
│                                                                   │
│   setLoading(true)                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [3] Prepara parâmetros
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const filialIds = filiaisSelecionadas                            │
│   .map(f => f.value)                                             │
│   .join(',')  // Ex: "1,2,3"                                     │
│                                                                   │
│ const params = new URLSearchParams({                             │
│   schema: currentTenant.supabase_schema,                         │
│   mes: mes.toString(),                                           │
│   ano: ano.toString(),                                           │
│   filial_id: filialIds                                           │
│ })                                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [4] Atualiza valores realizados (background)
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/metas/update (sem await - fire and forget)             │
│ Body: {                                                          │
│   schema: "okilao",                                              │
│   mes: 1,                                                        │
│   ano: 2024,                                                     │
│   filial_id: 1 (ou undefined para todas)                         │
│ }                                                                │
│                                                                   │
│ → Executa RPC atualizar_valores_realizados_metas                 │
│ → Atualiza vendas realizadas mais recentes                       │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [5] Busca relatório
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ GET /api/metas/report?schema=okilao&mes=1&ano=2024&             │
│                       filial_id=1,2,3                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [6] API Route valida autenticação
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const { data: { user } } = await supabase.auth.getUser()        │
│ if (!user) return 401                                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [7] API Route valida autorização de filiais
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const authorizedBranches =                                       │
│   await getUserAuthorizedBranchCodes(supabase, user.id)          │
│                                                                   │
│ IF authorizedBranches !== null THEN                              │
│   • Usuário tem restrições                                       │
│   • Filtra filial_id pelos IDs autorizados                       │
│   finalFilialIds = requestedIds                                  │
│     .filter(id => authorizedBranches.includes(id))               │
│   IF (finalFilialIds.length === 0) THEN                          │
│     • Usa todas as autorizadas                                   │
│     finalFilialIds = authorizedBranches                          │
│   END IF                                                         │
│ ELSE                                                              │
│   • Usuário sem restrições                                       │
│   • Usa todas as filiais do request                              │
│   finalFilialIds = requestedIds                                  │
│ END IF                                                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [8] Chama RPC Function
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const useApiFilialVendas = await isApiFilialVendasEnabled(schema)│
│ const rpcName = useApiFilialVendas                               │
│   ? 'get_metas_mensais_report_api_filial_vendas'                 │
│   : 'get_metas_mensais_report'                                   │
│                                                                   │
│ supabase.rpc(rpcName, {                                           │
│   p_schema: 'okilao',                                            │
│   p_mes: 1,                                                      │
│   p_ano: 2024,                                                   │
│   p_filial_id: null,         // Não usado quando há p_filial_ids │
│   p_filial_ids: [1, 2, 3]    // Array de IDs autorizados         │
│ })                                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [9] RPC Function executa query
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE RPC: get_metas_mensais_report                           │
│ ou get_metas_mensais_report_api_filial_vendas                    │
│                                                                   │
│ [9.1] Monta query base                                           │
│   SELECT                                                         │
│     mm.id,                                                       │
│     mm.filial_id,                                                │
│     mm.data,                                                     │
│     mm.dia_semana,                                               │
│     mm.meta_percentual,                                          │
│     mm.data_referencia,                                          │
│     mm.valor_referencia,                                         │
│     mm.valor_meta,                                               │
│     mm.valor_realizado,                                          │
│     mm.diferenca,                                                │
│     mm.diferenca_percentual                                      │
│   FROM {schema}.metas_mensais mm                                 │
│   WHERE EXTRACT(MONTH FROM mm.data) = p_mes                      │
│     AND EXTRACT(YEAR FROM mm.data) = p_ano                       │
│                                                                   │
│ [9.2] Aplica filtro de filiais                                   │
│   IF p_filial_ids IS NOT NULL THEN                               │
│     AND mm.filial_id = ANY(p_filial_ids)                         │
│   ELSIF p_filial_id IS NOT NULL THEN                             │
│     AND mm.filial_id = p_filial_id                               │
│   END IF                                                         │
│                                                                   │
│   ORDER BY mm.data, mm.filial_id                                 │
│                                                                   │
│ [9.3] Calcula totalizadores                                      │
│   SELECT                                                         │
│     COALESCE(SUM(valor_realizado), 0) AS total_realizado,        │
│     COALESCE(SUM(valor_meta), 0) AS total_meta                   │
│   FROM {schema}.metas_mensais                                    │
│   WHERE [mesmos filtros]                                         │
│                                                                   │
│   No modo api_filial_vendas, valor_realizado, custo_realizado,   │
│   lucro_realizado e margem_realizada são lidos de                 │
│   {schema}.vendas_filiais_snapshot.                              │
│                                                                   │
│ [9.4] Calcula percentual atingido                                │
│   IF v_total_meta > 0 THEN                                       │
│     v_percentual_atingido =                                      │
│       (v_total_realizado / v_total_meta) * 100                   │
│   ELSE                                                            │
│     v_percentual_atingido = 0                                    │
│   END IF                                                         │
│                                                                   │
│ [9.5] Retorna resultado                                          │
│   RETURN JSONB_BUILD_OBJECT(                                     │
│     'metas', metas_array,                                        │
│     'total_realizado', v_total_realizado,                        │
│     'total_meta', v_total_meta,                                  │
│     'percentual_atingido', v_percentual_atingido                 │
│   )                                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [10] Retorna para API Route
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ return NextResponse.json(data)                                   │
│ {                                                                │
│   "metas": [                                                     │
│     {                                                            │
│       "id": 1,                                                   │
│       "filial_id": 1,                                            │
│       "data": "2024-01-01",                                      │
│       "dia_semana": "Segunda",                                   │
│       "meta_percentual": 105,                                    │
│       "data_referencia": "2023-01-01",                           │
│       "valor_referencia": 15000.00,                              │
│       "valor_meta": 15750.00,                                    │
│       "valor_realizado": 16200.00,                               │
│       "diferenca": 450.00,                                       │
│       "diferenca_percentual": 2.86                               │
│     },                                                           │
│     // ... mais metas                                            │
│   ],                                                             │
│   "total_realizado": 450000.00,                                  │
│   "total_meta": 420000.00,                                       │
│   "percentual_atingido": 107.14                                  │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [11] Retorna para Frontend
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                               │
│                                                                   │
│ [11.1] Armazena dados                                            │
│   setReport(data)                                                │
│                                                                   │
│ [11.2] Processa agrupamento (se múltiplas filiais)               │
│   IF filiaisSelecionadas.length > 1 THEN                         │
│     → Trigger Fluxo 6 (Agrupamento por Data)                     │
│   END IF                                                         │
│                                                                   │
│ [11.3] Renderiza UI                                              │
│   • Cards de Resumo                                              │
│     - Vendas do Período (total_realizado vs total_meta)          │
│     - Progresso Mês Completo (percentual_atingido)               │
│     - Progresso D-1 (calculado no frontend)                      │
│                                                                   │
│   • Tabela de Metas                                              │
│     IF filial única:                                             │
│       → Lista detalhada dia a dia                                │
│     ELSE:                                                        │
│       → Agrupamento expansível por data                          │
│     END IF                                                       │
│                                                                   │
│ [11.4] setLoading(false)                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Cálculos Específicos do Frontend

#### Card "Progresso D-1"

```typescript
// [11.3.1] Filtrar metas até ontem
const hoje = new Date()
const ontem = subDays(hoje, 1)

const metasAteOntem = report.metas.filter(meta => {
  const dataMeta = parseISO(meta.data)
  return dataMeta <= ontem
})

// [11.3.2] Calcular totais D-1
const total_realizado_d1 = metasAteOntem.reduce(
  (sum, m) => sum + m.valor_realizado,
  0
)
const total_meta_d1 = metasAteOntem.reduce(
  (sum, m) => sum + m.valor_meta,
  0
)

// [11.3.3] Calcular percentual D-1
const percentual_atingido_d1 = total_meta_d1 > 0
  ? (total_realizado_d1 / total_meta_d1) * 100
  : 0

// [11.3.4] Determinar cor
const cor = percentual_atingido_d1 >= 100
  ? 'success'
  : percentual_atingido_d1 >= 80
  ? 'warning'
  : 'destructive'
```

---

## Fluxo 3: Edição Inline

### Descrição
Edição de valores de meta ou percentual diretamente na tabela, com atualização otimista da UI.

### Trigger
Usuário duplo-clica em célula de meta → edita valor → pressiona Enter ou perde foco

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [1] Usuário duplo-clica em célula
  │     (coluna "Meta %" ou "Valor Meta")
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ handleEditStart(meta, field)                                     │
│   setEditingCell({ id: meta.id, field })                         │
│   setEditingValue(field === 'percentual'                         │
│     ? meta.meta_percentual.toString()                            │
│     : meta.valor_meta.toString()                                 │
│   )                                                              │
│   → Input aparece no lugar da célula                             │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [2] Usuário digita novo valor
  │     onChange={(e) => setEditingValue(e.target.value)}
  │
  │ [3] Usuário pressiona Enter ou perde foco (onBlur)
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ handleEditSave(meta)                                             │
│                                                                   │
│ [3.1] Valida valor                                               │
│   const valor = parseFloat(editingValue)                         │
│   IF isNaN(valor) OR valor <= 0 THEN                             │
│     alert('Valor inválido')                                      │
│     RETURN                                                       │
│   END IF                                                         │
│                                                                   │
│ [3.2] Verifica se houve mudança                                  │
│   const valorAtual = editingCell.field === 'percentual'          │
│     ? meta.meta_percentual                                       │
│     : meta.valor_meta                                            │
│   IF valor === valorAtual THEN                                   │
│     → Cancela edição, nada a fazer                               │
│     RETURN                                                       │
│   END IF                                                         │
│                                                                   │
│ [3.3] Calcula valores correlatos                                 │
│   IF editingCell.field === 'percentual' THEN                     │
│     novoPercentual = valor                                       │
│     novoValorMeta = meta.valor_referencia * (valor / 100)        │
│   ELSE                                                            │
│     novoValorMeta = valor                                        │
│     novoPercentual = (valor / meta.valor_referencia) * 100       │
│   END IF                                                         │
│                                                                   │
│ [3.4] Atualização otimista da UI                                 │
│   const novasMetas = report.metas.map(m =>                       │
│     m.id === meta.id                                             │
│       ? {                                                        │
│           ...m,                                                  │
│           meta_percentual: novoPercentual,                       │
│           valor_meta: novoValorMeta,                             │
│           diferenca: m.valor_realizado - novoValorMeta,          │
│           diferenca_percentual:                                  │
│             ((m.valor_realizado - novoValorMeta) /               │
│              novoValorMeta) * 100                                │
│         }                                                        │
│       : m                                                        │
│   )                                                              │
│                                                                   │
│   setReport({                                                    │
│     ...report,                                                   │
│     metas: novasMetas,                                           │
│     total_meta: calcularTotalMeta(novasMetas)                    │
│   })                                                             │
│                                                                   │
│   → UI atualiza instantaneamente (antes do servidor)             │
│                                                                   │
│ [3.5] setSavingEdit(true)                                        │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [4] Envia atualização para servidor
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/metas/update                                           │
│ Body: {                                                          │
│   schema: "okilao",                                              │
│   metaId: 123,                                                   │
│   valorMeta: 18000.00,                                           │
│   metaPercentual: 108                                            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [5] API Route valida e chama RPC
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ supabase.rpc('update_meta_mensal', {                             │
│   p_schema: 'okilao',                                            │
│   p_meta_id: 123,                                                │
│   p_valor_meta: 18000.00,                                        │
│   p_meta_percentual: 108                                         │
│ })                                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [6] RPC Function atualiza banco
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE RPC: update_meta_mensal                                 │
│                                                                   │
│ [6.1] UPDATE registro                                            │
│   UPDATE {schema}.metas_mensais                                  │
│   SET                                                            │
│     valor_meta = p_valor_meta,                                   │
│     meta_percentual = p_meta_percentual,                         │
│     diferenca = valor_realizado - p_valor_meta,                  │
│     diferenca_percentual =                                       │
│       CASE                                                       │
│         WHEN p_valor_meta > 0 THEN                               │
│           ((valor_realizado - p_valor_meta) / p_valor_meta) * 100│
│         ELSE 0                                                   │
│       END,                                                       │
│     updated_at = NOW()                                           │
│   WHERE id = p_meta_id                                           │
│                                                                   │
│ [6.2] Retorna resultado                                          │
│   GET DIAGNOSTICS v_rows_affected = ROW_COUNT                    │
│   RETURN JSONB_BUILD_OBJECT('rows_affected', v_rows_affected)    │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [7] Retorna para Frontend
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                               │
│                                                                   │
│ [7.1] Verifica sucesso                                           │
│   IF response.success THEN                                       │
│     → Nada a fazer, UI já atualizada (otimistic)                 │
│   ELSE                                                            │
│     alert('Erro ao salvar')                                      │
│     → Reverte UI para valores anteriores                         │
│   END IF                                                         │
│                                                                   │
│ [7.2] Limpa estado de edição                                     │
│   setEditingCell(null)                                           │
│   setEditingValue('')                                            │
│   setSavingEdit(false)                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Teclas de Atalho

- **Enter**: Salva e sai do modo de edição
- **Escape**: Cancela edição sem salvar
- **Tab**: (Futuro) Navegar para próxima célula editável

---

## Fluxo 4: Atualização de Valores Realizados

### Descrição
Atualização em lote dos valores realizados de todas as metas de um período, sincronizando com a tabela de vendas diárias.

### Trigger
- Automaticamente antes de buscar relatório (Fluxo 2, passo 4)
- Pode ser chamado manualmente (se implementado botão "Atualizar Vendas")

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [1] Antes de buscar relatório (handleFilter)
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ fetch('/api/metas/update', {                                     │
│   method: 'POST',                                                │
│   body: JSON.stringify({                                         │
│     schema: currentTenant.supabase_schema,                       │
│     mes,                                                         │
│     ano,                                                         │
│     filial_id: filiaisSelecionadas.length === 1                  │
│       ? parseInt(filiaisSelecionadas[0].value)                   │
│       : undefined                                                │
│   })                                                             │
│ })                                                               │
│ → Fire and forget (sem await)                                    │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [2] API Route valida e chama RPC
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ supabase.rpc('atualizar_valores_realizados_metas', {             │
│   p_schema: 'okilao',                                            │
│   p_mes: 1,                                                      │
│   p_ano: 2024,                                                   │
│   p_filial_id: 1 (ou NULL para todas)                            │
│ })                                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [3] RPC Function executa atualização
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE RPC: atualizar_valores_realizados_metas                 │
│                                                                   │
│ [3.1] UPDATE com JOIN                                            │
│   UPDATE {schema}.metas_mensais mm                               │
│   SET                                                            │
│     valor_realizado = COALESCE(vd.total_vendas, 0),              │
│     diferenca = COALESCE(vd.total_vendas, 0) - mm.valor_meta,    │
│     diferenca_percentual =                                       │
│       CASE                                                       │
│         WHEN mm.valor_meta > 0 THEN                              │
│           ((COALESCE(vd.total_vendas, 0) - mm.valor_meta) /      │
│            mm.valor_meta) * 100                                  │
│         ELSE 0                                                   │
│       END,                                                       │
│     updated_at = NOW()                                           │
│   FROM (                                                         │
│     SELECT                                                       │
│       filial_id,                                                 │
│       data_venda,                                                │
│       SUM(total_vendas) AS total_vendas                          │
│     FROM {schema}.vendas_diarias_por_filial                      │
│     WHERE EXTRACT(MONTH FROM data_venda) = p_mes                 │
│       AND EXTRACT(YEAR FROM data_venda) = p_ano                  │
│       AND (p_filial_id IS NULL OR filial_id = p_filial_id)       │
│     GROUP BY filial_id, data_venda                               │
│   ) vd                                                           │
│   WHERE mm.filial_id = vd.filial_id                              │
│     AND mm.data = vd.data_venda                                  │
│     AND EXTRACT(MONTH FROM mm.data) = p_mes                      │
│     AND EXTRACT(YEAR FROM mm.data) = p_ano                       │
│     AND (p_filial_id IS NULL OR mm.filial_id = p_filial_id)      │
│                                                                   │
│ [3.2] Conta registros afetados                                   │
│   GET DIAGNOSTICS v_metas_atualizadas = ROW_COUNT                │
│                                                                   │
│ [3.3] Retorna resultado                                          │
│   RETURN JSONB_BUILD_OBJECT(                                     │
│     'mensagem', 'Valores atualizados com sucesso',               │
│     'metas_atualizadas', v_metas_atualizadas                     │
│   )                                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [4] Retorna para API Route (e é ignorado no frontend)
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ return NextResponse.json(data)                                   │
│ {                                                                │
│   "mensagem": "Valores atualizados com sucesso",                 │
│   "metas_atualizadas": 93                                        │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Observações

1. **Fire and Forget**: O frontend não aguarda o retorno desta chamada antes de buscar o relatório.
2. **Race Condition Possível**: Em teoria, a busca do relatório pode acontecer antes da atualização terminar, mas na prática isso raramente ocorre devido à latência de rede.
3. **Otimização**: Poderia ser melhorado com `await` e exibir loader durante a atualização.

---

## Fluxo 5: Auto-Seleção de Filiais

### Descrição
Ao carregar a página, todas as filiais autorizadas do usuário são automaticamente selecionadas no filtro.

### Trigger
`useEffect` inicial quando `branches` e `currentTenant` estão disponíveis

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [1] Hook useBranchesOptions carrega filiais
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const { branchOptions: branches, isLoading } =                   │
│   useBranchesOptions({                                           │
│     tenantId: currentTenant?.id,                                 │
│     enabled: !!currentTenant,                                    │
│     includeAll: false                                            │
│   })                                                             │
│                                                                   │
│ → Usa SWR para fetch                                             │
│ → Aplica filtro de filiais autorizadas automaticamente           │
│ → Retorna FilialOption[]                                         │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [2] useEffect detecta que branches mudou
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ useEffect(() => {                                                │
│   if (branches && branches.length > 0 &&                         │
│       filiaisSelecionadas.length === 0) {                        │
│     // Auto-seleciona todas as filiais                           │
│     setFiliaisSelecionadas(branches)                             │
│   }                                                              │
│ }, [branches])                                                   │
│                                                                   │
│ → Executa apenas na primeira vez (quando array está vazio)       │
│ → Popula filtro com todas as filiais disponíveis                 │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [3] useEffect detecta que filtros estão prontos
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ useEffect(() => {                                                │
│   if (currentTenant && mes && ano && filiaisSelecionadas.length > 0) {│
│     handleFilter()  // Busca metas automaticamente               │
│   }                                                              │
│ }, [currentTenant, mes, ano, filiaisSelecionadas])               │
│                                                                   │
│ → Dispara busca automática quando todos os filtros estão prontos │
│ → Trigger Fluxo 2 (Visualização)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Benefícios

1. **UX Melhorada**: Usuário vê dados imediatamente ao abrir a página
2. **Menos Cliques**: Não precisa selecionar filiais manualmente
3. **Consistência**: Sempre mostra todas as filiais disponíveis por padrão

---

## Fluxo 6: Agrupamento por Data

### Descrição
Quando múltiplas filiais são selecionadas, as metas são agrupadas por data com totalizadores diários e interface expansível.

### Trigger
- Após buscar relatório (Fluxo 2) com múltiplas filiais selecionadas
- Quando usuário clica para expandir/colapsar grupo

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: page.tsx                                              │
│ (Após receber MetasReport do servidor)                           │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [1] Verifica se deve agrupar
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ IF filiaisSelecionadas.length > 1 THEN                           │
│   // Modo multi-filial - agrupar                                 │
│   → Processa agrupamento                                         │
│ ELSE                                                              │
│   // Modo filial única - lista simples                           │
│   → Renderiza tabela direta                                      │
│ END IF                                                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [2] Agrupa metas por data
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const grouped: GroupedByDate = report.metas.reduce((acc, meta) => {│
│   const dateKey = meta.data  // "2024-01-01"                     │
│                                                                   │
│   IF (!acc[dateKey]) THEN                                        │
│     // Inicializa grupo para esta data                           │
│     acc[dateKey] = {                                             │
│       data: meta.data,                                           │
│       dia_semana: meta.dia_semana,                               │
│       metas: [],                                                 │
│       total_valor_referencia: 0,                                 │
│       total_meta: 0,                                             │
│       total_realizado: 0,                                        │
│       total_diferenca: 0,                                        │
│       media_meta_percentual: 0,                                  │
│       diferenca_percentual: 0                                    │
│     }                                                            │
│   END IF                                                         │
│                                                                   │
│   // Adiciona meta ao grupo                                      │
│   acc[dateKey].metas.push(meta)                                  │
│                                                                   │
│   // Acumula totais                                              │
│   acc[dateKey].total_valor_referencia += meta.valor_referencia   │
│   acc[dateKey].total_meta += meta.valor_meta                     │
│   acc[dateKey].total_realizado += meta.valor_realizado           │
│   acc[dateKey].total_diferenca =                                 │
│     acc[dateKey].total_realizado - acc[dateKey].total_meta       │
│                                                                   │
│   return acc                                                     │
│ }, {})                                                           │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [3] Calcula médias e percentuais por grupo
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Object.values(grouped).forEach(grupo => {                        │
│   const numMetas = grupo.metas.length                            │
│                                                                   │
│   // Média dos percentuais                                       │
│   grupo.media_meta_percentual =                                  │
│     grupo.metas.reduce((sum, m) => sum + m.meta_percentual, 0) / │
│     numMetas                                                     │
│                                                                   │
│   // Percentual de diferença                                     │
│   grupo.diferenca_percentual = grupo.total_meta > 0              │
│     ? (grupo.total_diferenca / grupo.total_meta) * 100           │
│     : 0                                                          │
│ })                                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [4] Ordena grupos por data
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const sortedDates = Object.keys(grouped).sort()                  │
│ // ["2024-01-01", "2024-01-02", "2024-01-03", ...]              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [5] Renderiza UI com grupos expansíveis
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ {sortedDates.map(dateKey => {                                    │
│   const grupo = grouped[dateKey]                                 │
│   const isExpanded = expandedDates[dateKey]                      │
│                                                                   │
│   return (                                                       │
│     <Fragment key={dateKey}>                                     │
│       {/* LINHA DE CABEÇALHO DO GRUPO */}                        │
│       <TableRow                                                  │
│         className="cursor-pointer hover:bg-muted/50"             │
│         onClick={() => toggleExpanded(dateKey)}                  │
│       >                                                          │
│         <TableCell>                                              │
│           {isExpanded ? <ChevronDown /> : <ChevronRight />}      │
│           {format(parseISO(grupo.data), 'dd/MM/yyyy')}           │
│           <span className="text-muted-foreground">              │
│             {grupo.dia_semana}                                   │
│           </span>                                                │
│         </TableCell>                                             │
│         <TableCell>{grupo.metas.length} filiais</TableCell>      │
│         <TableCell>                                              │
│           {formatCurrency(grupo.total_valor_referencia)}         │
│         </TableCell>                                             │
│         <TableCell>                                              │
│           {grupo.media_meta_percentual.toFixed(2)}%              │
│         </TableCell>                                             │
│         <TableCell>                                              │
│           {formatCurrency(grupo.total_meta)}                     │
│         </TableCell>                                             │
│         <TableCell>                                              │
│           {formatCurrency(grupo.total_realizado)}                │
│         </TableCell>                                             │
│         <TableCell className={getDiferencaColor(grupo.total_diferenca)}>│
│           {formatCurrency(grupo.total_diferenca)}                │
│           <span className="text-xs">                             │
│             ({grupo.diferenca_percentual.toFixed(2)}%)           │
│           </span>                                                │
│         </TableCell>                                             │
│       </TableRow>                                                │
│                                                                   │
│       {/* LINHAS EXPANDIDAS (METAS POR FILIAL) */}               │
│       {isExpanded && grupo.metas.map(meta => (                   │
│         <TableRow key={meta.id} className="bg-muted/30">         │
│           <TableCell className="pl-12">                          │
│             → {getFilialNome(meta.filial_id)}                    │
│           </TableCell>                                           │
│           <TableCell>-</TableCell>                               │
│           <TableCell>                                            │
│             {formatCurrency(meta.valor_referencia)}              │
│           </TableCell>                                           │
│           <TableCell>{meta.meta_percentual}%</TableCell>         │
│           <TableCell                                             │
│             onDoubleClick={() => handleEditStart(meta, 'valor')} │
│           >                                                      │
│             {editingCell?.id === meta.id ? (                     │
│               <Input ... />                                      │
│             ) : (                                                │
│               formatCurrency(meta.valor_meta)                    │
│             )}                                                   │
│           </TableCell>                                           │
│           <TableCell>                                            │
│             {formatCurrency(meta.valor_realizado)}               │
│           </TableCell>                                           │
│           <TableCell className={getDiferencaColor(meta.diferenca)}>│
│             {formatCurrency(meta.diferenca)}                     │
│             <span className="text-xs">                           │
│               ({meta.diferenca_percentual.toFixed(2)}%)          │
│             </span>                                              │
│           </TableCell>                                           │
│         </TableRow>                                              │
│       ))}                                                        │
│     </Fragment>                                                  │
│   )                                                              │
│ })}                                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [6] Usuário clica no cabeçalho do grupo
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const toggleExpanded = (dateKey: string) => {                    │
│   setExpandedDates(prev => ({                                    │
│     ...prev,                                                     │
│     [dateKey]: !prev[dateKey]                                    │
│   }))                                                            │
│ }                                                                │
│                                                                   │
│ → Alterna estado expandido/colapsado                             │
│ → Re-renderiza UI com novo estado                                │
└─────────────────────────────────────────────────────────────────┘
```

### Layout Visual

**Colapsado**:
```
┌─────────────────────────────────────────────────────────────────┐
│ ▶ 01/01/2024 Segunda  │ 3 filiais │ R$ 53.000 │ 107,67% │ ...  │
│ ▶ 02/01/2024 Terça    │ 3 filiais │ R$ 48.000 │ 105,00% │ ...  │
│ ▶ 03/01/2024 Quarta   │ 3 filiais │ R$ 51.500 │ 106,50% │ ...  │
└─────────────────────────────────────────────────────────────────┘
```

**Expandido**:
```
┌─────────────────────────────────────────────────────────────────┐
│ ▼ 01/01/2024 Segunda  │ 3 filiais │ R$ 53.000 │ 107,67% │ ...  │
│   → Filial Centro     │ -         │ R$ 15.000 │ 105%    │ ...  │
│   → Filial Norte      │ -         │ R$ 20.000 │ 110%    │ ...  │
│   → Filial Sul        │ -         │ R$ 18.000 │ 108%    │ ...  │
│ ▶ 02/01/2024 Terça    │ 3 filiais │ R$ 48.000 │ 105,00% │ ...  │
│ ▶ 03/01/2024 Quarta   │ 3 filiais │ R$ 51.500 │ 106,50% │ ...  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Autenticação e Autorização

### Fluxo de Autenticação

```
┌─────────────────────────────────────────────────────────────────┐
│ TODAS AS API ROUTES                                              │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [1] Obter usuário autenticado
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const supabase = await createClient()                            │
│ const { data: { user } } = await supabase.auth.getUser()        │
│                                                                   │
│ IF (!user) THEN                                                  │
│   return NextResponse.json(                                      │
│     { error: 'Não autorizado' },                                 │
│     { status: 401 }                                              │
│   )                                                              │
│ END IF                                                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [2] Obter filiais autorizadas do usuário
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ const authorizedBranches =                                       │
│   await getUserAuthorizedBranchCodes(supabase, user.id)          │
│                                                                   │
│ IF (authorizedBranches === null) THEN                            │
│   // Usuário SEM restrições (admin/superadmin)                   │
│   → Pode acessar TODAS as filiais do tenant                      │
│ ELSE                                                              │
│   // Usuário COM restrições                                      │
│   → authorizedBranches = ['1', '2', '5']  (exemplo)              │
│   → Pode acessar APENAS essas filiais                            │
│ END IF                                                            │
└─────────────────────────────────────────────────────────────────┘
  │
  │ [3] Validar filiais do request
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ IF (authorizedBranches !== null) THEN                            │
│   // Filtrar filiais do request por autorizadas                  │
│   requestedFilialIds = requestedFilialIds.filter(id =>           │
│     authorizedBranches.includes(id.toString())                   │
│   )                                                              │
│                                                                   │
│   IF (requestedFilialIds.length === 0) THEN                      │
│     // Nenhuma filial válida - usar todas as autorizadas         │
│     requestedFilialIds = authorizedBranches.map(id => parseInt(id))│
│   END IF                                                         │
│ END IF                                                            │
│                                                                   │
│ → Garante que usuário nunca acesse filiais não autorizadas       │
└─────────────────────────────────────────────────────────────────┘
```

### Matriz de Permissões

| Ação | superadmin | admin | user | viewer |
|------|-----------|-------|------|--------|
| Gerar Metas | ✅ Todas | ✅ Todas (tenant) | ✅ Autorizadas | ❌ |
| Visualizar Metas | ✅ Todas | ✅ Todas (tenant) | ✅ Autorizadas | ✅ Autorizadas |
| Editar Metas | ✅ Todas | ✅ Todas (tenant) | ✅ Autorizadas | ❌ |
| Atualizar Valores | ✅ Todas | ✅ Todas (tenant) | ✅ Autorizadas | ❌ |

**Observação**: Restrições por filial são aplicadas através de `user_authorized_branches`. Se não houver registros, o usuário tem acesso a todas as filiais do seu tenant.

---

## Tratamento de Erros

### Erros Comuns e Respostas

#### 1. Não Autenticado (401)

```json
{
  "error": "Não autorizado"
}
```

**Causa**: Token de autenticação inválido ou expirado
**Ação do Frontend**: Redirecionar para `/login`

---

#### 2. Parâmetros Inválidos (400)

```json
{
  "error": "Parâmetros inválidos"
}
```

**Causa**: Campos obrigatórios faltando ou com formato incorreto
**Ação do Frontend**: Validar inputs antes de enviar

---

#### 3. Sem Acesso à Filial (403)

```json
{
  "error": "Usuário não tem acesso a nenhuma filial"
}
```

**Causa**: Usuário não tem filiais autorizadas
**Ação do Frontend**: Exibir mensagem amigável e orientar contato com administrador

---

#### 4. Erro de RPC (500)

```json
{
  "error": "Erro ao gerar metas",
  "details": "relation \"okilao.metas_mensais\" does not exist",
  "hint": "Verifique se as migrations foram aplicadas"
}
```

**Causa**: Tabela não existe, schema não exposto, ou erro SQL
**Ação do Frontend**: Exibir erro técnico e sugerir contato com suporte

---

#### 5. Schema Não Exposto (PGRST106)

```json
{
  "error": "The schema must be one of the following: public, graphql_public"
}
```

**Causa**: Schema do tenant não foi adicionado em "Exposed schemas" no Supabase Dashboard
**Ação**: Administrador deve adicionar o schema nas configurações

---

### Fluxo de Tratamento no Frontend

```typescript
try {
  const response = await fetch('/api/metas/...')
  const data = await response.json()

  if (!response.ok) {
    // Erro HTTP
    if (response.status === 401) {
      // Redirecionar para login
      router.push('/login')
    } else if (response.status === 403) {
      // Sem permissão
      alert('Você não tem permissão para acessar esta funcionalidade')
    } else if (response.status === 500) {
      // Erro do servidor
      console.error('Server error:', data)
      alert(`Erro: ${data.error}`)
    } else {
      // Outros erros
      alert(`Erro ${response.status}: ${data.error}`)
    }
    return
  }

  // Sucesso
  setReport(data)
} catch (error) {
  // Erro de rede ou parse
  console.error('Network error:', error)
  alert('Erro de conexão. Verifique sua internet.')
}
```

---

## Diagramas de Sequência

### Diagrama 1: Ciclo Completo (Gerar → Visualizar → Editar)

```
User          Frontend         API Routes        Supabase DB
 │                │                 │                 │
 │ Gerar Metas    │                 │                 │
 │───────────────>│                 │                 │
 │                │ POST /generate  │                 │
 │                │────────────────>│                 │
 │                │                 │ RPC generate... │
 │                │                 │────────────────>│
 │                │                 │                 │ INSERT metas
 │                │                 │<────────────────│
 │                │<────────────────│                 │
 │<───────────────│                 │                 │
 │ "31 metas      │                 │                 │
 │  criadas"      │                 │                 │
 │                │                 │                 │
 │                │ GET /report     │                 │
 │                │────────────────>│                 │
 │                │                 │ RPC get_report  │
 │                │                 │────────────────>│
 │                │                 │                 │ SELECT metas
 │                │                 │<────────────────│
 │                │<────────────────│                 │
 │<───────────────│                 │                 │
 │ [Tabela com    │                 │                 │
 │  metas]        │                 │                 │
 │                │                 │                 │
 │ Edita valor    │                 │                 │
 │───────────────>│                 │                 │
 │                │ (update local)  │                 │
 │<───────────────│                 │                 │
 │ [UI atualiza]  │                 │                 │
 │                │ POST /update    │                 │
 │                │────────────────>│                 │
 │                │                 │ RPC update...   │
 │                │                 │────────────────>│
 │                │                 │                 │ UPDATE meta
 │                │                 │<────────────────│
 │                │<────────────────│                 │
 │<───────────────│                 │                 │
 │ "Salvo"        │                 │                 │
 │                │                 │                 │
```

---

### Diagrama 2: Fluxo de Autorização

```
Frontend         API Route         getUserAuthorizedBranchCodes      Supabase
 │                   │                          │                        │
 │ Request com       │                          │                        │
 │ filial_id=5       │                          │                        │
 │──────────────────>│                          │                        │
 │                   │ Obter user               │                        │
 │                   │─────────────────────────────────────────────────>│
 │                   │<──────────────────────────────────────────────────│
 │                   │ user.id                  │                        │
 │                   │                          │                        │
 │                   │ Obter branches autorizadas                        │
 │                   │─────────────────────────>│                        │
 │                   │                          │ SELECT branches        │
 │                   │                          │───────────────────────>│
 │                   │                          │<───────────────────────│
 │                   │<─────────────────────────│                        │
 │                   │ authorizedBranches=['1','2','3']                  │
 │                   │                          │                        │
 │                   │ IF 5 NOT IN ['1','2','3']                         │
 │                   │   → Usar filial 1 (primeira autorizada)           │
 │                   │                          │                        │
 │                   │ RPC com filial_id=1      │                        │
 │                   │─────────────────────────────────────────────────>│
 │                   │<──────────────────────────────────────────────────│
 │<──────────────────│                          │                        │
 │ Dados apenas da   │                          │                        │
 │ filial 1          │                          │                        │
 │                   │                          │                        │
```

---

## Versão

**Integration Flow Version**: 1.0.0
**Última Atualização**: 2025-01-11
**Compatível com**: Metas Mensal v1.5.0

---

## Referências

- [README.md](./README.md) - Visão geral do módulo
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Regras de negócio detalhadas
- [DATA_STRUCTURES.md](./DATA_STRUCTURES.md) - Estruturas de dados e tipos
- [RPC_FUNCTIONS.md](./RPC_FUNCTIONS.md) - Documentação das funções RPC
- [CHANGELOG.md](./CHANGELOG.md) - Histórico de versões
