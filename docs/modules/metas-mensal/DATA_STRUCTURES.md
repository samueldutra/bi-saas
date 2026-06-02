# Data Structures - Metas Mensal

> Documentação completa das estruturas de dados, tipos TypeScript e interfaces de API do módulo de Metas Mensais.

## Índice

1. [Tipos Principais](#tipos-principais)
2. [Interfaces de API](#interfaces-de-api)
3. [Estruturas Hierárquicas](#estruturas-hierárquicas)
4. [Tipos de Resposta RPC](#tipos-de-resposta-rpc)
5. [Enums e Constantes](#enums-e-constantes)
6. [Exemplos de Dados](#exemplos-de-dados)

---

## Tipos Principais

### Meta

Representa uma meta diária individual para uma filial específica.

```typescript
interface Meta {
  // Identificação
  id: number                    // ID único da meta
  filial_id: number            // ID da filial (FK para filiais)

  // Data e temporalidade
  data: string                 // Data da meta (formato ISO: "YYYY-MM-DD")
  dia_semana: string           // Dia da semana ("Segunda", "Terça", etc.)

  // Configuração da meta
  meta_percentual: number      // Percentual aplicado (ex: 105 = 105%)
  data_referencia: string      // Data do ano anterior usada como base
  valor_referencia: number     // Valor de venda do ano anterior

  // Valores calculados
  valor_meta: number           // Meta calculada: valor_referencia × (meta_percentual / 100)
  valor_realizado: number      // Valor de vendas efetivamente realizado
  custo_realizado: number      // Custo realizado
  lucro_realizado: number      // Lucro realizado; no modo snapshot representa lucro líquido ajustado
  margem_realizada?: number    // Margem realizada; no modo snapshot vem de margem_ajustada_percentual

  // Indicadores de performance
  diferenca: number            // Diferença absoluta: valor_realizado - valor_meta
  diferenca_percentual: number // Diferença relativa: (diferenca / valor_meta) × 100
}
```

**Campos Derivados (Frontend)**:
- `diferenca`: Sempre recalculado no frontend
- `diferenca_percentual`: Sempre recalculado no frontend

**Relacionamentos**:
- `filial_id` → `{schema}.filiais.id`
- `data` relaciona-se com `{schema}.vendas_diarias_por_filial.data_venda`

---

### MetasReport

Estrutura de resposta consolidada do relatório de metas.

```typescript
interface MetasReport {
  // Array de metas individuais
  metas: Meta[]                // Lista de todas as metas do período/filtro

  // Totalizadores gerais
  total_realizado: number      // Soma de todos os valores_realizados
  total_meta: number           // Soma de todos os valores_meta
  total_custo: number          // Soma dos custos realizados
  total_lucro: number          // Soma dos lucros realizados

  // Indicador de performance geral
  percentual_atingido: number  // (total_realizado / total_meta) × 100
  margem_bruta: number         // Margem consolidada do período
  sales_source?: 'legacy' | 'api_filial_vendas'
  profit_source?: string
}
```

**Regras de Cálculo**:
- `total_realizado` = Σ(meta.valor_realizado)
- `total_meta` = Σ(meta.valor_meta)
- `percentual_atingido` = (total_realizado / total_meta) × 100

**Uso**: Retornado pela RPC `get_metas_mensais_report`

Quando `sales_source = 'api_filial_vendas'`, os campos de realizado vêm de `{schema}.vendas_filiais_snapshot` e o frontend exibe `lucro_realizado` como Lucro Líquido e `margem_realizada` como Margem Realizada.

---

### GroupedByDate

Estrutura para agrupamento de metas por data (modo múltiplas filiais).

```typescript
interface GroupedByDate {
  [date: string]: {            // Chave: data no formato "YYYY-MM-DD"
    // Identificação
    data: string               // Data do grupo (mesma da chave)
    dia_semana: string         // Dia da semana comum

    // Metas do grupo
    metas: Meta[]              // Array de metas de todas as filiais para essa data

    // Totalizadores do dia
    total_valor_referencia: number  // Soma dos valores de referência do dia
    total_meta: number               // Soma das metas do dia
    total_realizado: number          // Soma dos valores realizados do dia
    total_diferenca: number          // total_realizado - total_meta

    // Indicadores do dia
    media_meta_percentual: number    // Média dos percentuais aplicados
    diferenca_percentual: number     // (total_diferenca / total_meta) × 100
  }
}
```

**Exemplo de Uso**:
```typescript
const grouped: GroupedByDate = {
  "2024-01-01": {
    data: "2024-01-01",
    dia_semana: "Segunda",
    metas: [meta1, meta2, meta3],  // 3 filiais
    total_valor_referencia: 45000,
    total_meta: 47250,
    total_realizado: 50000,
    total_diferenca: 2750,
    media_meta_percentual: 105,
    diferenca_percentual: 5.82
  },
  "2024-01-02": { /* ... */ }
}
```

**Processamento**: Criado no frontend a partir do array `MetasReport.metas`

---

## Interfaces de API

### POST /api/metas/generate

Gera metas para todos os dias do mês baseado em histórico do ano anterior.

#### Request Body

```typescript
interface GenerateMetasRequest {
  schema: string                  // Schema do tenant (ex: "okilao")
  filialId: number                // ID da filial ou 'all'
  mes: number                     // Mês (1-12)
  ano: number                     // Ano (ex: 2024)
  metaPercentual: number          // Percentual da meta (ex: 105)
  dataReferenciaInicial: string   // Data inicial do período de referência (ISO)
}
```

**Exemplo**:
```json
{
  "schema": "okilao",
  "filialId": 1,
  "mes": 1,
  "ano": 2024,
  "metaPercentual": 105,
  "dataReferenciaInicial": "2023-01-01"
}
```

#### Response Success

```typescript
interface GenerateMetasResponse {
  mensagem: string               // Mensagem de sucesso
  metas_criadas: number         // Quantidade de metas criadas/substituídas
  mes: number                   // Mês processado
  ano: number                   // Ano processado
  filial_id: number             // Filial processada
}
```

**Exemplo**:
```json
{
  "mensagem": "Metas geradas com sucesso",
  "metas_criadas": 31,
  "mes": 1,
  "ano": 2024,
  "filial_id": 1
}
```

#### Response Error

```typescript
interface ErrorResponse {
  error: string                  // Mensagem de erro
  details?: string               // Detalhes adicionais (opcional)
  hint?: string                  // Dica para correção (opcional)
}
```

**Status Codes**:
- `400`: Parâmetros inválidos
- `401`: Não autenticado
- `403`: Sem permissão para a filial
- `500`: Erro interno

---

### GET /api/metas/report

Busca relatório de metas com valores realizados atualizados.

#### Query Parameters

```typescript
interface GetMetasReportParams {
  schema: string                 // Schema do tenant (obrigatório)
  mes: string                    // Mês (1-12) (obrigatório)
  ano: string                    // Ano (obrigatório)
  filial_id?: string             // ID(s) da(s) filial(is) - pode ser múltiplo separado por vírgula
}
```

**Exemplos**:
```
# Filial única
GET /api/metas/report?schema=okilao&mes=1&ano=2024&filial_id=1

# Múltiplas filiais
GET /api/metas/report?schema=okilao&mes=1&ano=2024&filial_id=1,2,3

# Todas as filiais autorizadas
GET /api/metas/report?schema=okilao&mes=1&ano=2024
```

#### Response Success

Retorna `MetasReport` (ver [Tipos Principais](#metasreport)).

**Exemplo**:
```json
{
  "metas": [
    {
      "id": 1,
      "filial_id": 1,
      "data": "2024-01-01",
      "dia_semana": "Segunda",
      "meta_percentual": 105,
      "data_referencia": "2023-01-01",
      "valor_referencia": 15000.00,
      "valor_meta": 15750.00,
      "valor_realizado": 16500.00,
      "diferenca": 750.00,
      "diferenca_percentual": 4.76
    }
  ],
  "total_realizado": 450000.00,
  "total_meta": 420000.00,
  "percentual_atingido": 107.14
}
```

#### Response Empty

```json
{
  "metas": [],
  "total_realizado": 0,
  "total_meta": 0,
  "percentual_atingido": 0
}
```

**Comportamento**: Retorna vazio se não houver metas geradas para o período/filiais.

---

### POST /api/metas/update

Atualiza valores de meta (edição inline) ou atualiza valores realizados em lote.

#### Request Body - Atualização Individual

```typescript
interface UpdateMetaIndividualRequest {
  schema: string                 // Schema do tenant
  metaId: number                 // ID da meta a atualizar
  valorMeta: number              // Novo valor da meta
  metaPercentual: number         // Novo percentual
}
```

**Exemplo**:
```json
{
  "schema": "okilao",
  "metaId": 123,
  "valorMeta": 18000.00,
  "metaPercentual": 110
}
```

#### Request Body - Atualização em Lote

```typescript
interface UpdateValoresRealizadosRequest {
  schema: string                 // Schema do tenant
  mes: number                    // Mês para atualizar
  ano: number                    // Ano para atualizar
  filial_id?: number             // Filial específica (opcional)
}
```

**Exemplo**:
```json
{
  "schema": "okilao",
  "mes": 1,
  "ano": 2024,
  "filial_id": 1
}
```

#### Response Success

**Individual**:
```typescript
interface UpdateMetaResponse {
  message: string                // "Meta atualizada com sucesso"
  success: boolean               // true
  data: {
    rows_affected: number        // Sempre 1
  }
}
```

**Em Lote**:
```typescript
interface UpdateValoresRealizadosResponse {
  mensagem: string               // "Valores atualizados com sucesso"
  metas_atualizadas: number      // Quantidade de registros atualizados
}
```

---

## Estruturas Hierárquicas

### Agrupamento por Data (Frontend)

Quando múltiplas filiais são selecionadas, as metas são agrupadas por data:

```
GroupedByDate
├── "2024-01-01"
│   ├── data: "2024-01-01"
│   ├── dia_semana: "Segunda"
│   ├── metas: [meta_filial_1, meta_filial_2, meta_filial_3]
│   └── totalizadores (total_meta, total_realizado, etc.)
├── "2024-01-02"
│   └── ...
└── ...
```

**Estado de Expansão**:
```typescript
// Controla quais datas estão expandidas
const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({
  "2024-01-01": true,   // Expandido
  "2024-01-02": false,  // Colapsado
  // ...
})
```

---

## Tipos de Resposta RPC

### generate_metas_mensais

```sql
CREATE OR REPLACE FUNCTION generate_metas_mensais(
  p_schema TEXT,
  p_filial_id INTEGER,
  p_mes INTEGER,
  p_ano INTEGER,
  p_meta_percentual NUMERIC,
  p_data_referencia_inicial DATE
) RETURNS JSONB
```

**Retorno**:
```typescript
interface GenerateMetasRPCResponse {
  mensagem: string
  metas_criadas: number
  mes: number
  ano: number
  filial_id: number
}
```

---

### get_metas_mensais_report

```sql
CREATE OR REPLACE FUNCTION get_metas_mensais_report(
  p_schema TEXT,
  p_mes INTEGER,
  p_ano INTEGER,
  p_filial_id INTEGER DEFAULT NULL,
  p_filial_ids INTEGER[] DEFAULT NULL
) RETURNS JSONB
```

**Retorno**: `MetasReport` (ver [Tipos Principais](#metasreport))

**Lógica**:
- Se `p_filial_ids` fornecido: filtra por array de IDs
- Se `p_filial_id` fornecido: filtra por ID único
- Se nenhum fornecido: retorna todas as filiais do tenant

---

### update_meta_mensal

```sql
CREATE OR REPLACE FUNCTION update_meta_mensal(
  p_schema TEXT,
  p_meta_id INTEGER,
  p_valor_meta NUMERIC,
  p_meta_percentual NUMERIC
) RETURNS JSONB
```

**Retorno**:
```typescript
interface UpdateMetaRPCResponse {
  rows_affected: number  // Sempre 1
}
```

**Comportamento**: Atualiza os campos e recalcula `diferenca` e `diferenca_percentual`.

---

### atualizar_valores_realizados_metas

```sql
CREATE OR REPLACE FUNCTION atualizar_valores_realizados_metas(
  p_schema TEXT,
  p_mes INTEGER,
  p_ano INTEGER,
  p_filial_id INTEGER DEFAULT NULL
) RETURNS JSONB
```

**Retorno**:
```typescript
interface UpdateValoresRPCResponse {
  mensagem: string
  metas_atualizadas: number
}
```

**Comportamento**:
- Faz LEFT JOIN entre `metas_mensais` e `vendas_diarias_por_filial`
- Atualiza `valor_realizado` com soma das vendas do dia
- Recalcula `diferenca` e `diferenca_percentual`

---

## Enums e Constantes

### Meses

```typescript
const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
]
```

---

### Anos

```typescript
// Gerado dinamicamente: 2020 até ano atual + 1
const ANOS = Array.from(
  { length: new Date().getFullYear() - 2019 + 1 },
  (_, i) => 2020 + i
)
// Ex: [2020, 2021, 2022, 2023, 2024, 2025]
```

---

### Cores de Progresso

```typescript
// Usado nos cards de progresso e gráficos circulares
const PROGRESS_COLORS = {
  excellent: 'hsl(var(--success))',      // Verde - ≥ 100%
  good: 'hsl(var(--warning))',           // Amarelo - ≥ 80%
  poor: 'hsl(var(--destructive))'        // Vermelho - < 80%
}
```

**Lógica de Seleção**:
```typescript
function getProgressColor(percentual: number): string {
  if (percentual >= 100) return PROGRESS_COLORS.excellent
  if (percentual >= 80) return PROGRESS_COLORS.good
  return PROGRESS_COLORS.poor
}
```

---

### Dias da Semana

```typescript
const DIAS_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado'
]
```

**Uso**: Exibido na tabela junto com a data.

---

## Exemplos de Dados

### Exemplo Completo: Meta Individual

```json
{
  "id": 458,
  "filial_id": 1,
  "data": "2024-01-15",
  "dia_semana": "Segunda",
  "meta_percentual": 105.0,
  "data_referencia": "2023-01-15",
  "valor_referencia": 18500.50,
  "valor_meta": 19425.53,
  "valor_realizado": 20100.75,
  "diferenca": 675.22,
  "diferenca_percentual": 3.48
}
```

**Interpretação**:
- Meta: R$ 19.425,53 (105% do ano anterior)
- Realizado: R$ 20.100,75
- Performance: +R$ 675,22 (+3,48%) ✅

---

### Exemplo Completo: MetasReport (3 Dias)

```json
{
  "metas": [
    {
      "id": 101,
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
      "id": 102,
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
    },
    {
      "id": 103,
      "filial_id": 1,
      "data": "2024-01-03",
      "dia_semana": "Quarta",
      "meta_percentual": 105.0,
      "data_referencia": "2023-01-03",
      "valor_referencia": 16500.00,
      "valor_meta": 17325.00,
      "valor_realizado": 18000.00,
      "diferenca": 675.00,
      "diferenca_percentual": 3.90
    }
  ],
  "total_realizado": 50700.00,
  "total_meta": 50925.00,
  "percentual_atingido": 99.56
}
```

**Análise**:
- 3 dias de metas
- Dia 1: Bateu (+2,86%)
- Dia 2: Abaixo (-7,56%)
- Dia 3: Bateu (+3,90%)
- **Total**: 99,56% (quase lá, mas não bateu)

---

### Exemplo: GroupedByDate (Múltiplas Filiais)

```json
{
  "2024-01-01": {
    "data": "2024-01-01",
    "dia_semana": "Segunda",
    "metas": [
      {
        "id": 201,
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
        "id": 202,
        "filial_id": 2,
        "data": "2024-01-01",
        "dia_semana": "Segunda",
        "meta_percentual": 110.0,
        "data_referencia": "2023-01-01",
        "valor_referencia": 20000.00,
        "valor_meta": 22000.00,
        "valor_realizado": 23500.00,
        "diferenca": 1500.00,
        "diferenca_percentual": 6.82
      },
      {
        "id": 203,
        "filial_id": 3,
        "data": "2024-01-01",
        "dia_semana": "Segunda",
        "meta_percentual": 108.0,
        "data_referencia": "2023-01-01",
        "valor_referencia": 18000.00,
        "valor_meta": 19440.00,
        "valor_realizado": 18900.00,
        "diferenca": -540.00,
        "diferenca_percentual": -2.78
      }
    ],
    "total_valor_referencia": 53000.00,
    "total_meta": 57190.00,
    "total_realizado": 58600.00,
    "total_diferenca": 1410.00,
    "media_meta_percentual": 107.67,
    "diferenca_percentual": 2.47
  }
}
```

**Análise do Grupo**:
- Data: 01/01/2024 (Segunda)
- 3 filiais com metas
- Filial 1: +2,86% ✅
- Filial 2: +6,82% ✅✅
- Filial 3: -2,78% ❌
- **Consolidado do dia**: +2,47% ✅

---

### Exemplo: Cards de Resumo (Dados Calculados)

```typescript
// Card 1: Vendas do Período
const cardVendas = {
  total_realizado: 450000.00,
  total_meta: 420000.00,
  diferenca: 30000.00,           // 450000 - 420000
  percentual: 7.14,              // (30000 / 420000) × 100
  cor: 'success'                 // Verde (positivo)
}

// Card 2: Progresso Mês Completo
const cardProgressoMes = {
  percentual_atingido: 107.14,   // (450000 / 420000) × 100
  cor: 'success',                // Verde (≥ 100%)
  status: 'Bateu a meta! 🎯'
}

// Card 3: Progresso D-1 (até ontem)
const cardProgressoD1 = {
  total_realizado_d1: 380000.00,
  total_meta_d1: 370000.00,
  percentual_atingido_d1: 102.70, // (380000 / 370000) × 100
  cor: 'success',                 // Verde (≥ 100%)
  status: 'No caminho certo! ✅'
}
```

**Lógica D-1**:
```typescript
const hoje = new Date()
const ontem = subDays(hoje, 1)

const metasAteOntem = report.metas.filter(meta =>
  parseISO(meta.data) <= ontem
)

const total_realizado_d1 = metasAteOntem.reduce((sum, m) =>
  sum + m.valor_realizado, 0
)
const total_meta_d1 = metasAteOntem.reduce((sum, m) =>
  sum + m.valor_meta, 0
)
```

---

### Exemplo: Edição Inline (Estado)

```typescript
// Estado de edição
const [editingCell, setEditingCell] = useState<{
  id: number
  field: 'percentual' | 'valor'
} | null>({
  id: 458,              // ID da meta sendo editada
  field: 'valor'        // Campo sendo editado
})

const [editingValue, setEditingValue] = useState<string>('19425.53')

// Ao salvar
const payload = {
  schema: 'okilao',
  metaId: 458,
  valorMeta: 20000.00,  // Novo valor
  metaPercentual: 108   // Recalculado: (20000 / 18500.50) × 100
}
```

---

## Relacionamentos com Outras Estruturas

### TenantContext

```typescript
interface TenantContext {
  currentTenant: {
    id: string
    nome: string
    supabase_schema: string  // ← Usado em todas as chamadas de API
  }
  userProfile: {
    id: string
    full_name: string
    role: 'superadmin' | 'admin' | 'user' | 'viewer'
  }
}
```

**Uso**:
```typescript
const { currentTenant, userProfile } = useTenantContext()
const schema = currentTenant?.supabase_schema
```

---

### FilialOption (do MultiFilialFilter)

```typescript
interface FilialOption {
  value: string       // ID da filial como string
  label: string       // Nome da filial
  codigo: string      // Código da filial
}

// Exemplo
{
  value: "1",
  label: "Filial Centro",
  codigo: "F001"
}
```

**Uso**: Sincronizado com `filiaisSelecionadas` state.

---

## Validações de Tipos

### Validação de Datas

```typescript
// Formato esperado: "YYYY-MM-DD"
function isValidDateFormat(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
}

// Parse seguro
function parseSafeDate(dateStr: string): Date | null {
  try {
    const date = parseISO(dateStr)
    return isValid(date) ? date : null
  } catch {
    return null
  }
}
```

---

### Validação de Números

```typescript
// Percentual (0-1000)
function isValidPercentual(value: number): boolean {
  return value >= 0 && value <= 1000
}

// Valor monetário (positivo)
function isValidValorMonetario(value: number): boolean {
  return value >= 0 && !isNaN(value) && isFinite(value)
}

// Filial ID
function isValidFilialId(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && Number.isInteger(value)
}
```

---

## Performance e Cache

### Desabilitação de Cache (API Routes)

```typescript
// Todas as rotas forçam dinâmica (sem cache)
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

**Motivo**: Dados de metas e vendas são atualizados frequentemente.

---

### SWR Hook para Filiais

```typescript
// Cache de 2 segundos para lista de filiais
const { branchOptions, isLoading } = useBranchesOptions({
  tenantId: currentTenant?.id,
  enabled: !!currentTenant,
  includeAll: false
})

// Config interna do SWR
{
  dedupingInterval: 2000,  // 2s
  revalidateOnFocus: false
}
```

---

### Memoização de Arrays

```typescript
// Evita recriação desnecessária de arrays
const filialIds = useMemo(
  () => filiaisSelecionadas.map(f => parseInt(f.value)),
  [filiaisSelecionadas]
)

const expandedDatesSet = useMemo(
  () => new Set(Object.keys(expandedDates).filter(k => expandedDates[k])),
  [expandedDates]
)
```

---

## Versão

**Data Structures Version**: 1.0.0
**Última Atualização**: 2025-01-11
**Compatível com**: Metas Mensal v1.5.0

---

## Referências

- [README.md](./README.md) - Visão geral do módulo
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Regras de negócio detalhadas
- [INTEGRATION_FLOW.md](./INTEGRATION_FLOW.md) - Fluxo de integração completo
- [RPC_FUNCTIONS.md](./RPC_FUNCTIONS.md) - Documentação das funções RPC
- [CHANGELOG.md](./CHANGELOG.md) - Histórico de versões
