# DRE Gerencial - Estruturas de Dados

## Índice

1. [Interfaces TypeScript](#interfaces-typescript)
2. [Tipos de Dados](#tipos-de-dados)
3. [Schemas de Validação](#schemas-de-validação)
4. [Estruturas de Resposta da API](#estruturas-de-resposta-da-api)
5. [Estruturas de Banco de Dados](#estruturas-de-banco-de-dados)

---

## Interfaces TypeScript

### 1. Interfaces de Dados Hierárquicos

#### DespesaPorFilial
Representa uma despesa individual com valores por filial.

```typescript
interface DespesaPorFilial {
  data_despesa: string              // Data da despesa (YYYY-MM-DD)
  descricao_despesa: string         // Descrição da despesa
  fornecedor_id: string | null      // ID do fornecedor (nullable)
  numero_nota: number | null        // Número da nota fiscal (nullable)
  serie_nota: string | null         // Série da nota fiscal (nullable)
  observacao: string | null         // Observações adicionais (nullable)
  data_emissao: string | null       // Data de emissão da nota (nullable)
  valores_filiais: Record<number, number>  // { filial_id: valor }
}
```

**Exemplo**:
```json
{
  "data_despesa": "2024-10-15",
  "descricao_despesa": "Energia Elétrica",
  "fornecedor_id": "FOR-001",
  "numero_nota": 12345,
  "serie_nota": "A1",
  "observacao": "Referente ao mês 09/2024",
  "data_emissao": "2024-10-10",
  "valores_filiais": {
    "1": 3500.00,
    "4": 2800.00,
    "7": 4100.00
  }
}
```

---

#### TipoPorFilial
Representa um tipo de despesa (ex: "Energia", "Água") com suas despesas.

```typescript
interface TipoPorFilial {
  tipo_id: number                   // ID do tipo de despesa
  tipo_descricao: string            // Descrição do tipo
  valores_filiais: Record<number, number>  // Total por filial
  despesas: DespesaPorFilial[]      // Array de despesas deste tipo
}
```

**Exemplo**:
```json
{
  "tipo_id": 5,
  "tipo_descricao": "ENERGIA ELÉTRICA",
  "valores_filiais": {
    "1": 3500.00,
    "4": 2800.00,
    "7": 4100.00
  },
  "despesas": [
    {
      "data_despesa": "2024-10-15",
      "descricao_despesa": "Energia Elétrica",
      // ... outros campos
    }
  ]
}
```

---

#### DepartamentoPorFilial
Representa um departamento com seus tipos de despesa.

```typescript
interface DepartamentoPorFilial {
  dept_id: number                   // ID do departamento
  dept_descricao: string            // Descrição do departamento
  valores_filiais: Record<number, number>  // Total por filial
  tipos: TipoPorFilial[]            // Array de tipos de despesa
}
```

**Exemplo**:
```json
{
  "dept_id": 2,
  "dept_descricao": "DESPESAS FIXAS",
  "valores_filiais": {
    "1": 15000.00,
    "4": 12000.00,
    "7": 18000.00
  },
  "tipos": [
    {
      "tipo_id": 5,
      "tipo_descricao": "ENERGIA ELÉTRICA",
      // ... outros campos
    }
  ]
}
```

---

### 2. Interfaces de Relatório

#### GraficoData
Dados para gráfico de evolução mensal.

```typescript
interface GraficoData {
  mes: string      // Formato: YYYY-MM
  valor: number    // Valor total do mês
}
```

**Exemplo**:
```json
{
  "mes": "2024-10",
  "valor": 45000.00
}
```

---

#### ReportData
Estrutura completa de dados do relatório.

```typescript
interface ReportData {
  totalizador: {
    valorTotal: number           // Soma total de todas as despesas
    qtdRegistros: number         // Quantidade de registros (despesas individuais)
    qtdDepartamentos: number     // Quantidade de departamentos
    qtdTipos: number            // Quantidade de tipos de despesa
    mediaDepartamento: number    // Média de despesa por departamento
  }
  grafico: GraficoData[]        // Dados para gráfico mensal
  departamentos: DepartamentoPorFilial[]  // Hierarquia de despesas
  filiais: number[]             // IDs das filiais incluídas no relatório
}
```

**Exemplo completo**:
```json
{
  "totalizador": {
    "valorTotal": 150000.00,
    "qtdRegistros": 342,
    "qtdDepartamentos": 8,
    "qtdTipos": 24,
    "mediaDepartamento": 18750.00
  },
  "grafico": [
    { "mes": "2024-08", "valor": 142000.00 },
    { "mes": "2024-09", "valor": 148000.00 },
    { "mes": "2024-10", "valor": 150000.00 }
  ],
  "departamentos": [
    {
      "dept_id": 2,
      "dept_descricao": "DESPESAS FIXAS",
      "valores_filiais": { "1": 50000, "4": 40000, "7": 60000 },
      "tipos": [...]
    }
  ],
  "filiais": [1, 4, 7]
}
```

---

### 3. Interfaces de Indicadores

#### IndicadoresData
Indicadores financeiros calculados.

```typescript
interface IndicadoresData {
  receitaBruta: number         // Receita bruta do período
  lucroBruto: number          // Lucro bruto (antes das despesas)
  cmv: number                 // Custo das Mercadorias Vendidas
  totalDespesas: number       // Total de despesas operacionais
  lucroLiquido: number        // Lucro líquido (após despesas)
  margemLucroBruto: number    // Margem de lucro bruto (%)
  margemLucroLiquido: number  // Margem de lucro líquido (%)
}
```

**Cálculos**:
```typescript
cmv = receitaBruta - lucroBruto
lucroLiquido = lucroBruto - totalDespesas
margemLucroLiquido = (lucroLiquido / receitaBruta) × 100
```

**Exemplo**:
```json
{
  "receitaBruta": 500000.00,
  "lucroBruto": 150000.00,
  "cmv": 350000.00,
  "totalDespesas": 80000.00,
  "lucroLiquido": 70000.00,
  "margemLucroBruto": 30.00,
  "margemLucroLiquido": 14.00
}
```

---

#### ComparacaoIndicadores
Comparação temporal de indicadores.

```typescript
interface ComparacaoIndicadores {
  current: IndicadoresData     // Período atual
  pam: {
    data: IndicadoresData      // Período Anterior Mesmo
    ano: number                // Ano do PAM
  }
  paa: {
    data: IndicadoresData      // Período Anterior Acumulado
    ano: number                // Ano do PAA
  }
}
```

**Observações**:
- Em filtro mensal, `pam` continua sendo o mês anterior
- Em filtro anual, `pam` segue a lógica YTD/ano equivalente
- Em filtro customizado, `pam` usa o intervalo imediatamente anterior com a mesma duração e `paa` usa o mesmo intervalo no ano anterior

**Exemplo**:
```json
{
  "current": {
    "receitaBruta": 500000.00,
    "lucroBruto": 150000.00,
    // ... outros campos
  },
  "pam": {
    "data": {
      "receitaBruta": 480000.00,
      "lucroBruto": 140000.00,
      // ... outros campos
    },
    "ano": 2024
  },
  "paa": {
    "data": {
      "receitaBruta": 450000.00,
      "lucroBruto": 130000.00,
      // ... outros campos
    },
    "ano": 2023
  }
}
```

---

### 4. Interfaces de Dashboard

#### DashboardData
Dados brutos retornados pela API do dashboard.

```typescript
interface DashboardData {
  total_vendas?: number     // Receita bruta
  total_lucro?: number      // Lucro bruto
  margem_lucro?: number     // Margem de lucro bruto (%)
}
```

**Fonte**: RPC function `get_dashboard_data`

---

### 5. Interfaces de Tabela

#### DespesaRow
Linha da tabela hierárquica (usado no DataTable).

```typescript
export type DespesaRow = {
  id: string                       // ID único da linha
  tipo: 'total' | 'departamento' | 'tipo' | 'despesa'  // Tipo de linha
  descricao: string                // Descrição (nome do dept/tipo/despesa)
  data_despesa?: string            // Data da despesa (somente para tipo 'despesa')
  data_emissao?: string            // Data de emissão (somente para tipo 'despesa')
  numero_nota?: number | null      // Número da nota (somente para tipo 'despesa')
  serie_nota?: string | null       // Série da nota (somente para tipo 'despesa')
  observacao?: string | null       // Observações (somente para tipo 'despesa')
  total: number                    // Valor total (soma de todas as filiais)
  percentual: number               // Percentual do total geral
  valores_filiais: Record<number, number>  // Valores por filial
  filiais: number[]                // IDs das filiais
  subRows?: DespesaRow[]          // Sub-linhas (hierarquia)
}
```

**Exemplo - Linha de Departamento**:
```json
{
  "id": "dept_2",
  "tipo": "departamento",
  "descricao": "DESPESAS FIXAS",
  "total": 150000.00,
  "percentual": 35.50,
  "valores_filiais": { "1": 50000, "4": 40000, "7": 60000 },
  "filiais": [1, 4, 7],
  "subRows": [
    {
      "id": "tipo_2_5",
      "tipo": "tipo",
      "descricao": "ENERGIA ELÉTRICA",
      // ... outros campos
    }
  ]
}
```

**Exemplo - Linha de Despesa**:
```json
{
  "id": "desp_2_5_0",
  "tipo": "despesa",
  "descricao": "Energia Elétrica - Outubro",
  "data_despesa": "2024-10-15",
  "data_emissao": "2024-10-10",
  "numero_nota": 12345,
  "serie_nota": "A1",
  "observacao": "Referente ao mês 09/2024",
  "total": 10400.00,
  "percentual": 2.46,
  "valores_filiais": { "1": 3500, "4": 2800, "7": 4100 },
  "filiais": [1, 4, 7]
}
```

---

### 6. Interfaces de Filtro

#### FilterConfig
Configuração enviada pelo formulário para aplicar o DRE.

```typescript
interface FilterConfig {
  filiais: FilialOption[]
  filterType: 'month' | 'year' | 'custom'
  mes: number
  ano: number
  dataInicio: Date
  dataFim: Date
}
```

**Observações**:
- `mes = -1` representa filtro anual
- `dataInicio` e `dataFim` sempre carregam o intervalo efetivamente enviado às APIs

---

#### AppliedPeriodState
Estado persistido na página para representar o período aplicado ao relatório.

```typescript
interface AppliedPeriodState {
  filterType: 'month' | 'year' | 'custom'
  mes: number
  ano: number
  dataInicio: Date
  dataFim: Date
}
```

**Uso**:
- Alimenta o resumo visual de "Período aplicado"
- Reaproveita o intervalo já aplicado ao alternar para `Período Customizado`
- Mantém a referência temporal consistente entre UI, APIs e exportação

---

#### FilialOption
Opção de filial no filtro multi-seleção.

```typescript
interface FilialOption {
  value: string    // ID da filial (como string)
  label: string    // Nome da filial
}
```

**Exemplo**:
```json
{
  "value": "1",
  "label": "Matriz"
}
```

**Fonte**: Hook `useBranchesOptions`

---

## Tipos de Dados

### TipoDeLinha
```typescript
type TipoDeLinha = 'total' | 'departamento' | 'tipo' | 'despesa'
```

**Uso**: Determina o estilo e comportamento de cada linha na tabela.

---

### ValoresPorFilial
```typescript
type ValoresPorFilial = Record<number, number>
```

**Uso**: Mapeia ID de filial para valor monetário.

**Exemplo**:
```typescript
const valores: ValoresPorFilial = {
  1: 3500.00,
  4: 2800.00,
  7: 4100.00
}
```

---

## Schemas de Validação

### Query Parameters - Dashboard API

```typescript
import { z } from 'zod'

const querySchema = z.object({
  schema: z.string().min(1),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido, esperado YYYY-MM-DD'),
  filiais: z.string().optional(), // ex: "1,4,7" ou "all"
})
```

**Fonte**: [dashboard/route.ts](../../../src/app/api/dashboard/route.ts:12-17)

---

### Query Parameters - Hierarquia API

```typescript
// Validação manual (não usa Zod)
const requiredParams = {
  schema: searchParams.get('schema'),          // string
  filial_id: searchParams.get('filial_id'),    // string (convertido para number)
  data_inicial: searchParams.get('data_inicial'), // YYYY-MM-DD
  data_final: searchParams.get('data_final')    // YYYY-MM-DD
}
```

**Fonte**: [hierarquia/route.ts](../../../src/app/api/dre-gerencial/hierarquia/route.ts:16-20)

---

## Estruturas de Resposta da API

### API: `/api/dre-gerencial/hierarquia`

#### Request
```
GET /api/dre-gerencial/hierarquia?schema=okilao&filial_id=1&data_inicial=2024-10-01&data_final=2024-10-31
```

#### Response (Success - 200)
```json
{
  "totalizador": {
    "valorTotal": 45230.50,
    "qtdRegistros": 127,
    "qtdDepartamentos": 6,
    "qtdTipos": 18,
    "mediaDepartamento": 7538.42
  },
  "grafico": [
    { "mes": "2024-08", "valor": 42000.00 },
    { "mes": "2024-09", "valor": 43500.00 },
    { "mes": "2024-10", "valor": 45230.50 }
  ],
  "departamentos": [
    {
      "dept_id": 2,
      "dept_descricao": "DESPESAS FIXAS",
      "valor_total": 15000.00,
      "qtd_tipos": 5,
      "qtd_despesas": 42,
      "tipos": [
        {
          "tipo_id": 5,
          "tipo_descricao": "ENERGIA ELÉTRICA",
          "valor_total": 3500.00,
          "qtd_despesas": 3,
          "dept_id": 2,
          "despesas": [
            {
              "data_despesa": "2024-10-10",
              "descricao_despesa": "Energia Elétrica - Matriz",
              "fornecedor_id": "FOR-001",
              "numero_nota": 12345,
              "serie_nota": "A1",
              "valor": 3500.00,
              "usuario": "admin",
              "observacao": null,
              "data_emissao": "2024-10-10"
            }
          ]
        }
      ]
    }
  ]
}
```

#### Response (Error - 401)
```json
{
  "error": "Não autenticado"
}
```

#### Response (Error - 400)
```json
{
  "error": "Parâmetros obrigatórios: schema, data_inicial, data_final"
}
```

#### Response (Error - 403)
```json
{
  "error": "Usuário não possui acesso à filial solicitada"
}
```

#### Response (Error - 500)
```json
{
  "error": "Erro ao buscar dados: <mensagem do erro RPC>"
}
```

---

### API: `/api/dashboard`

#### Request
```
GET /api/dashboard?schema=okilao&data_inicio=2024-10-01&data_fim=2024-10-31&filiais=1,4,7
```

#### Response (Success - 200)
```json
{
  "total_vendas": 500000.00,
  "total_lucro": 150000.00,
  "margem_lucro": 30.00
}
```

#### Response (Error - 401)
```json
{
  "error": "Unauthorized"
}
```

#### Response (Error - 400)
```json
{
  "error": "Invalid query parameters",
  "details": {
    "fieldErrors": {
      "data_inicio": ["Formato de data inválido, esperado YYYY-MM-DD"]
    }
  }
}
```

#### Response (Error - 403)
```json
{
  "error": "Forbidden"
}
```

---

## Estruturas de Banco de Dados

### Tabela: `despesas` (dentro do schema do tenant)

```sql
CREATE TABLE despesas (
  id SERIAL PRIMARY KEY,
  data_despesa DATE NOT NULL,
  data_emissao DATE,
  descricao_despesa TEXT NOT NULL,
  valor NUMERIC(15, 2) NOT NULL,
  filial_id INTEGER NOT NULL,
  dept_id INTEGER NOT NULL,
  tipo_id INTEGER NOT NULL,
  fornecedor_id TEXT,
  numero_nota INTEGER,
  serie_nota TEXT,
  observacao TEXT,
  usuario TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Relacionamentos**:
- `filial_id` → `filiais.id`
- `dept_id` → `departamentos_despesas.id`
- `tipo_id` → `tipos_despesas.id`

---

### Tabela: `departamentos_despesas`

```sql
CREATE TABLE departamentos_despesas (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
);
```

---

### Tabela: `tipos_despesas`

```sql
CREATE TABLE tipos_despesas (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  dept_id INTEGER REFERENCES departamentos_despesas(id),
  ativo BOOLEAN DEFAULT TRUE
);
```

---

### Tabela: `filiais`

```sql
CREATE TABLE filiais (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
);
```

---

### Tabela: `vendas` (para dados do dashboard)

```sql
CREATE TABLE vendas (
  id SERIAL PRIMARY KEY,
  data_venda DATE NOT NULL,
  filial_id INTEGER NOT NULL,
  valor_bruto NUMERIC(15, 2) NOT NULL,
  valor_liquido NUMERIC(15, 2) NOT NULL,
  lucro NUMERIC(15, 2) NOT NULL,
  -- ... outros campos
);
```

---

## Estruturas RPC (PostgreSQL Functions)

### Function: `get_despesas_hierarquia`

**Assinatura**:
```sql
CREATE OR REPLACE FUNCTION get_despesas_hierarquia(
  p_schema TEXT,
  p_filial_id INTEGER,
  p_data_inicial DATE,
  p_data_final DATE,
  p_tipo_data TEXT DEFAULT 'data_emissao'
)
RETURNS TABLE (
  dept_id INTEGER,
  dept_descricao TEXT,
  tipo_id INTEGER,
  tipo_descricao TEXT,
  data_emissao DATE,
  descricao_despesa TEXT,
  id_fornecedor TEXT,
  numero_nota INTEGER,
  serie_nota TEXT,
  valor NUMERIC,
  usuario TEXT,
  observacao TEXT
)
```

**Retorno esperado**: Array de registros com todos os campos listados.

---

### Function: `get_dashboard_data`

**Assinatura**:
```sql
CREATE OR REPLACE FUNCTION get_dashboard_data(
  schema_name TEXT,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_filiais_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  total_vendas NUMERIC,
  total_lucro NUMERIC,
  margem_lucro NUMERIC
)
```

**Retorno esperado**: Registro único com totais agregados.

---

## Mapeamento de Dados (Frontend → Backend)

### Filtro de Página → API Request

```typescript
// Frontend (Estado da página)
const filiaisSelecionadas = [
  { value: "1", label: "Matriz" },
  { value: "4", label: "Filial Norte" }
]
const mes = 9  // Outubro (índice 0-based)
const ano = 2024

// Conversão para chamadas API
const dataInicio = "2024-10-01"  // startOfMonth
const dataFim = "2024-10-31"     // endOfMonth

// Múltiplas chamadas (uma por filial)
const promises = [
  fetch(`/api/dre-gerencial/hierarquia?schema=okilao&filial_id=1&data_inicial=2024-10-01&data_final=2024-10-31`),
  fetch(`/api/dre-gerencial/hierarquia?schema=okilao&filial_id=4&data_inicial=2024-10-01&data_final=2024-10-31`)
]
```

---

### API Response → Estrutura Consolidada

```typescript
// Resposta da API (por filial)
const responseFil1 = {
  totalizador: { valorTotal: 50000, ... },
  departamentos: [...]
}

const responseFil4 = {
  totalizador: { valorTotal: 40000, ... },
  departamentos: [...]
}

// Consolidação (função consolidateData)
const consolidated: ReportData = {
  totalizador: {
    valorTotal: 90000,  // 50000 + 40000
    qtdRegistros: 250,
    // ... outros campos
  },
  departamentos: [
    {
      dept_id: 2,
      dept_descricao: "DESPESAS FIXAS",
      valores_filiais: {
        1: 25000,  // da responseFil1
        4: 20000   // da responseFil4
      },
      tipos: [...]
    }
  ],
  filiais: [1, 4]
}
```

---

### Estrutura Consolidada → Tabela (DespesaRow)

```typescript
// Função transformToTableData
const tableData: DespesaRow[] = [
  {
    id: 'total',
    tipo: 'total',
    descricao: 'TOTAL DESPESAS',
    total: 90000,
    percentual: 100,
    valores_filiais: { 1: 50000, 4: 40000 },
    filiais: [1, 4],
    subRows: [
      {
        id: 'dept_2',
        tipo: 'departamento',
        descricao: 'DESPESAS FIXAS',
        total: 45000,
        percentual: 50,
        valores_filiais: { 1: 25000, 4: 20000 },
        filiais: [1, 4],
        subRows: [...]
      }
    ]
  }
]
```

---

## Constantes e Enums

### Meses do Ano

```typescript
const MESES = [
  { value: 0, label: 'Janeiro' },
  { value: 1, label: 'Fevereiro' },
  { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Maio' },
  { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' },
  { value: 10, label: 'Novembro' },
  { value: 11, label: 'Dezembro' },
]
```

**Fonte**: [filters.tsx](../../../src/components/despesas/filters.tsx:11-24)

---

### Anos Disponíveis

```typescript
const getAnosDisponiveis = () => {
  const anoAtual = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => anoAtual - i)
}
// Retorna: [2024, 2023, 2022, 2021, 2020] (exemplo em 2024)
```

**Fonte**: [filters.tsx](../../../src/components/despesas/filters.tsx:26-29)

---

## Exemplos de Uso

### Exemplo 1: Criar Estrutura de Despesa

```typescript
const novaDespesa: DespesaPorFilial = {
  data_despesa: "2024-10-15",
  descricao_despesa: "Aluguel - Outubro 2024",
  fornecedor_id: "FOR-123",
  numero_nota: 54321,
  serie_nota: "B",
  observacao: "Pagamento em dia",
  data_emissao: "2024-10-10",
  valores_filiais: {
    1: 5000.00,
    4: 3500.00
  }
}
```

---

### Exemplo 2: Processar Indicadores

```typescript
const processIndicadores = (
  dashboardData: DashboardData | null,
  despesasData: ReportData | null
): IndicadoresData => {
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

**Fonte**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:285-310)

---

### Exemplo 3: Calcular Variação Temporal

```typescript
const calculateVariation = (current: number, previous: number) => {
  if (previous === 0) return { percent: 0, isPositive: false }

  const percent = ((current - previous) / previous) * 100

  return {
    percent: Math.abs(percent),
    isPositive: current > previous
  }
}

// Uso
const variacao = calculateVariation(150000, 140000)
// { percent: 7.14, isPositive: true }
```

**Fonte**: [indicators-cards.tsx](../../../src/components/despesas/indicators-cards.tsx:46-53)

---

## Diagramas de Dados

### Diagrama de Hierarquia

```
ReportData
├── totalizador: { ... }
├── grafico: GraficoData[]
├── filiais: number[]
└── departamentos: DepartamentoPorFilial[]
    └── [0]
        ├── dept_id: number
        ├── dept_descricao: string
        ├── valores_filiais: { 1: 25000, 4: 20000 }
        └── tipos: TipoPorFilial[]
            └── [0]
                ├── tipo_id: number
                ├── tipo_descricao: string
                ├── valores_filiais: { 1: 5000, 4: 3500 }
                └── despesas: DespesaPorFilial[]
                    └── [0]
                        ├── data_despesa: string
                        ├── descricao_despesa: string
                        ├── numero_nota: number
                        └── valores_filiais: { 1: 1200, 4: 800 }
```

---

### Diagrama de Fluxo de Dados

```
User Input
    ↓
[FilialOption[], mes, ano]
    ↓
Conversão para Datas
    ↓
[dataInicio, dataFim] para cada filial
    ↓
Promise.all([fetch filial 1, fetch filial 2, ...])
    ↓
Array<{ filialId, data: ReportData }>
    ↓
consolidateData()
    ↓
ReportData (consolidado multi-filial)
    ↓
transformToTableData()
    ↓
DespesaRow[] (formato para DataTable)
    ↓
Renderização na UI
```

---

## Manutenção

**Última atualização**: 2025-01-11
**Versão**: 1.0.0

Para modificar estruturas de dados:
1. Atualize as interfaces TypeScript
2. Atualize a validação (Zod schemas)
3. Atualize as funções RPC no banco
4. Atualize esta documentação
5. Execute testes de integração
