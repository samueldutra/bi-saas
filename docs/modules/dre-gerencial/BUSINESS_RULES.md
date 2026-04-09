# DRE Gerencial - Regras de Negócio

## Índice

1. [Regras de Acesso](#regras-de-acesso)
2. [Regras de Filtro](#regras-de-filtro)
3. [Regras de Cálculo](#regras-de-cálculo)
4. [Regras de Consolidação Multi-Filial](#regras-de-consolidação-multi-filial)
5. [Regras de Comparação Temporal](#regras-de-comparação-temporal)
6. [Regras de Exibição](#regras-de-exibição)

---

## Regras de Acesso

### RA-001: Autenticação Obrigatória
- **Descrição**: Usuário deve estar autenticado para acessar o módulo
- **Validação**: Verificação de sessão Supabase Auth
- **Comportamento**: Redirect para `/login` se não autenticado
- **Implementação**: [middleware.ts](../../../src/middleware.ts:1)

### RA-002: Validação de Schema
- **Descrição**: Schema solicitado deve pertencer ao tenant do usuário
- **Validação**:
  - Superadmin: pode acessar qualquer schema ativo
  - Usuário normal: apenas schema do seu tenant
- **Comportamento**: Retorna 403 Forbidden se acesso negado
- **Implementação**: [route.ts](../../../src/app/api/dre-gerencial/hierarquia/route.ts:30-94)

### RA-003: Restrições de Filiais
- **Descrição**: Usuários podem ter acesso restrito a filiais específicas
- **Fonte de dados**: Tabela `public.user_authorized_branches`
- **Regras**:
  - Se `authorizedBranches === null`: usuário tem acesso a TODAS as filiais
  - Se `authorizedBranches.length > 0`: usuário tem acesso apenas às filiais listadas
  - Se `authorizedBranches.length === 0`: usuário NÃO tem acesso a nenhuma filial (erro 403)
- **Validação**: Filial solicitada deve estar na lista de filiais autorizadas
- **Implementação**: [route.ts](../../../src/app/api/dre-gerencial/hierarquia/route.ts:30-94)

---

## Regras de Filtro

### RF-001: Seleção de Filiais Obrigatória
- **Descrição**: Usuário deve selecionar ao menos 1 filial
- **Validação**: `filiaisSelecionadas.length > 0`
- **Comportamento**: Exibe `EmptyState` com tipo "no-filters"
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:655-657)

### RF-002: Pré-seleção de Filiais
- **Descrição**: Ao carregar a página, TODAS as filiais disponíveis são pré-selecionadas
- **Comportamento**:
  ```typescript
  useEffect(() => {
    if (!isLoadingBranches && branches && branches.length > 0 && filiaisSelecionadas.length === 0) {
      setFiliaisSelecionadas(branches)
    }
  }, [isLoadingBranches, branches, filiaisSelecionadas.length])
  ```
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:119-123)

### RF-003: Período Padrão
- **Descrição**: Mês e ano padrão são o MÊS ATUAL e o ANO ATUAL
- **Cálculo**:
  ```typescript
  const hoje = new Date()
  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()
  ```
- **Exemplo**: Se hoje é Abril/2026 → Padrão = Abril/2026
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:101-107)

### RF-004: Período Aplicado Explícito
- **Descrição**: A página mantém estado explícito do período efetivamente aplicado ao relatório
- **Comportamento**:
- O estado interno usa sempre o intervalo realmente enviado às APIs
- O estado é atualizado no mesmo fluxo que dispara a busca de dados
- O mesmo intervalo é reutilizado ao alternar o tipo de filtro e ao exportar PDF
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:1188-1262)

### RF-005: Validação de Parâmetros API
- **Descrição**: API valida parâmetros obrigatórios
- **Obrigatórios**:
  - `schema`: string não vazia
  - `filial_id`: número inteiro válido (não aceita 'all')
  - `data_inicial`: formato YYYY-MM-DD
  - `data_final`: formato YYYY-MM-DD
- **Comportamento**: Retorna 400 Bad Request se inválido
- **Implementação**: [route.ts](../../../src/app/api/dre-gerencial/hierarquia/route.ts:23-28)

### RF-006: Filial Específica Obrigatória na API
- **Descrição**: A API `/api/dre-gerencial/hierarquia` NÃO aceita `filial_id=all`
- **Motivo**: RPC function `get_despesas_hierarquia` requer filial específica
- **Comportamento**: Página faz múltiplas chamadas (uma por filial) e consolida
- **Implementação**: [route.ts](../../../src/app/api/dre-gerencial/hierarquia/route.ts:56-60)

### RF-007: Período Customizado Reaproveita o Intervalo Aplicado
- **Descrição**: Ao trocar de `Mês` ou `Ano` para `Período Customizado`, o formulário herda o intervalo aplicado no relatório em vez de preencher com a data atual do relógio
- **Objetivo**: Evitar divergência entre os números já carregados e os valores que aparecem ao alternar o tipo de filtro
- **Implementação**: [dre-filter.tsx](../../../src/components/despesas/dre-filter.tsx:163-179)

---

## Regras de Cálculo

### RC-001: Cálculo de Receita Bruta
- **Fonte**: API `/api/dashboard` → RPC `get_dashboard_data`
- **Campo**: `total_vendas`
- **Descrição**: Soma total de vendas do período
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:286)

### RC-002: Cálculo de Lucro Bruto
- **Fonte**: API `/api/dashboard` → RPC `get_dashboard_data`
- **Campo**: `total_lucro`
- **Descrição**: Lucro antes de deduzir despesas operacionais
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:287)

### RC-003: Cálculo de CMV
- **Fórmula**: `CMV = Receita Bruta - Lucro Bruto`
- **Descrição**: Custo das Mercadorias Vendidas
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:289)

### RC-004: Cálculo de Margem de Lucro Bruto
- **Fonte**: API `/api/dashboard`
- **Campo**: `margem_lucro`
- **Descrição**: Percentual de lucro bruto sobre receita bruta
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:290)

### RC-005: Cálculo de Total de Despesas
- **Fonte**: API `/api/dre-gerencial/hierarquia`
- **Campo**: `totalizador.valorTotal`
- **Descrição**: Soma de TODAS as despesas do período
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:293)

### RC-006: Cálculo de Lucro Líquido
- **Fórmula**: `Lucro Líquido = Lucro Bruto - Total Despesas`
- **Descrição**: Lucro após deduzir todas as despesas operacionais
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:296)

### RC-007: Cálculo de Margem de Lucro Líquido
- **Fórmula**: `Margem Líquida = (Lucro Líquido / Receita Bruta) × 100`
- **Condição**: Se `receitaBruta === 0`, retorna 0
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:299)

### RC-008: Cálculo de Percentual por Despesa
- **Fórmula**: `Percentual = (Valor Despesa / Total Despesas) × 100`
- **Aplicação**: Cada linha (Departamento, Tipo, Despesa) mostra percentual do total
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:546)

### RC-009: Diferença em Relação à Média (Multi-Filial)
- **Fórmula**:
  ```typescript
  const media = valorTotal / qtdFiliais
  const diff = ((valorFilial - media) / media) × 100
  ```
- **Exibição**:
  - Verde (↓): abaixo da média (bom para despesas)
  - Vermelho (↑): acima da média (ruim para despesas)
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:41-51)

---

## Regras de Consolidação Multi-Filial

### RCM-001: Busca Paralela por Filial
- **Descrição**: Quando múltiplas filiais selecionadas, faz chamadas paralelas
- **Implementação**:
  ```typescript
  const promises = filiaisParaBuscar.map(async (filialId) => {
    const params = new URLSearchParams({
      schema: currentTenant.supabase_schema || '',
      filial_id: filialId.toString(),
      data_inicial: dataInicio,
      data_final: dataFim,
    })
    const response = await fetch(`/api/dre-gerencial/hierarquia?${params}`)
    return { filialId, data: await response.json() }
  })
  const results = await Promise.all(promises)
  ```
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:199-217)

### RCM-002: Consolidação Hierárquica
- **Descrição**: Dados de múltiplas filiais são consolidados mantendo hierarquia
- **Estrutura**:
  ```typescript
  {
    dept_id: 1,
    dept_descricao: "IMPOSTOS E TAXAS",
    valores_filiais: {
      1: 5000.00,  // Filial 1
      4: 3200.00,  // Filial 4
      7: 4500.00   // Filial 7
    },
    tipos: [...]
  }
  ```
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:350-491)

### RCM-003: Mapeamento de Despesas Únicas
- **Descrição**: Despesas idênticas (mesma data, descrição, nota) são agrupadas
- **Chave única**: `${deptId}-${tipoId}-${data_despesa}-${descricao}-${numero_nota}`
- **Comportamento**: Uma despesa pode ter valores diferentes em cada filial
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:402)

### RCM-004: Ordenação por Valor Total
- **Descrição**: Hierarquia ordenada do maior para o menor valor
- **Níveis**:
  1. Departamentos: ordenados por `sum(valores_filiais)`
  2. Tipos: ordenados por `sum(valores_filiais)` dentro do departamento
  3. Despesas: ordenadas por `sum(valores_filiais)` dentro do tipo
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:464-469)

### RCM-005: Gráfico Consolidado
- **Descrição**: Dados do gráfico são somados por mês entre filiais
- **Implementação**:
  ```typescript
  data.grafico?.forEach((item: GraficoData) => {
    const valorAtual = graficoMap.get(item.mes) || 0
    graficoMap.set(item.mes, valorAtual + item.valor)
  })
  ```
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:365-368)

---

## Regras de Comparação Temporal

### RCT-001: Cálculo de PAM (Período Anterior Mesmo)
- **Descrição**: Mês imediatamente anterior ao selecionado
- **Cálculo**:
  ```typescript
  const mesPam = mesParam - 1 < 0 ? 11 : mesParam - 1
  const anoPam = mesParam - 1 < 0 ? anoParam - 1 : anoParam
  ```
- **Exemplo**:
  - Selecionado: Janeiro/2025 → PAM = Dezembro/2024
  - Selecionado: Junho/2024 → PAM = Maio/2024
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:149-150)

### RCT-002: Cálculo de PAA (Período Anterior Acumulado)
- **Descrição**: Mesmo mês do ano anterior
- **Cálculo**: `anoParam - 1` (mesmo mês)
- **Exemplo**:
  - Selecionado: Outubro/2024 → PAA = Outubro/2023
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:154)

### RCT-003: Busca Paralela de Períodos
- **Descrição**: Busca 3 conjuntos de dados simultaneamente:
  1. Período atual
  2. PAM (mês anterior)
  3. PAA (ano anterior)
- **Implementação**:
  ```typescript
  const [dataAtual, despesasPam, despesasPaa] = await Promise.all([
    fetchDespesasPeriodo(filiais, dataInicio, dataFim),
    fetchDespesasPeriodo(filiais, dataInicioPam, dataFimPam),
    fetchDespesasPeriodo(filiais, dataInicioPaa, dataFimPaa)
  ])
  ```
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:157-161)

### RCT-004: Cálculo de Variação Percentual
- **Fórmula**:
  ```typescript
  const percent = ((current - previous) / previous) × 100
  const isPositive = current > previous
  ```
- **Exibição**:
  - Verde (↑): aumento (bom para receita/lucro)
  - Vermelho (↓): redução (ruim para receita/lucro)
  - Invertido para CMV e Despesas (verde = redução)
- **Implementação**: [indicators-cards.tsx](../../../src/components/despesas/indicators-cards.tsx:46-53)

### RCT-005: Tratamento de Valores Zerados
- **Regra**: Se valor anterior = 0, não exibe variação percentual
- **Motivo**: Evitar divisão por zero e percentuais enganosos
- **Implementação**: [indicators-cards.tsx](../../../src/components/despesas/indicators-cards.tsx:113)

---

## Regras de Exibição

### RE-001: Estados de UI
- **Loading**: Exibido durante busca de dados
- **Error**: Exibido se ocorrer erro na API
- **No Filters**: Exibido se nenhuma filial selecionada
- **No Data**: Exibido se não houver dados para o período
- **Data**: Exibido quando há dados válidos
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:649-662)

### RE-002: Hierarquia Expansível
- **Comportamento**:
  - Departamento: sempre pode expandir
  - Tipo: sempre pode expandir
  - Despesa: não expande (nó folha)
- **Indicador visual**:
  - Seta para direita (▶): collapsed
  - Seta para baixo (▼): expanded
  - Ponto (•): nó folha (despesa)
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:87-104)

### RE-003: Cores Alternadas por Filial
- **Descrição**: Colunas de filiais têm cores alternadas
- **Padrão**:
  - Índice par (0, 2, 4...): azul (`bg-blue-50/50`)
  - Índice ímpar (1, 3, 5...): cinza (`bg-slate-50/50`)
- **Suporte dark mode**: cores adaptadas automaticamente
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:160)

### RE-004: Formatação de Valores
- **Moeda**: `R$ 1.234,56` (padrão pt-BR)
- **Percentual**: `12,34%` (2 casas decimais, vírgula como separador)
- **Data**: `DD/MM/YYYY`
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:24-38)

### RE-005: Níveis de Indentação
- **Total**: `pl-3` (12px)
- **Departamento**: `pl-3` (12px)
- **Tipo**: `pl-10` (40px)
- **Despesa**: `pl-16` (64px)
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:66-68)

### RE-006: Peso de Fonte por Nível
- **Total**: `font-bold text-base` (negrito, 16px)
- **Departamento**: `font-semibold text-sm` (semi-negrito, 14px)
- **Tipo**: `font-medium text-sm` (médio, 14px)
- **Despesa**: `font-normal text-xs` (normal, 12px)
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:70-83)

### RE-007: Exibição de Indicadores
- **Layout**: Grid responsivo
  - Mobile: 1 coluna
  - Tablet: 2 colunas
  - Desktop: 3 colunas
  - Wide: 5 colunas (todos visíveis)
- **Ordem**:
  1. Receita Bruta
  2. CMV
  3. Lucro Bruto
  4. Total de Despesas
  5. Lucro Líquido
- **Implementação**: [indicators-cards.tsx](../../../src/components/despesas/indicators-cards.tsx:98)

### RE-008: Informações Adicionais em Despesas
- **Exibição**: Abaixo da descrição da despesa
- **Formato**: `DD/MM/YYYY • Nota: 12345-01` (texto pequeno, cor muted)
- **Campos**:
  - `data_emissao`: sempre exibida se disponível
  - `numero_nota`: exibida se disponível
  - `serie_nota`: exibida junto com número se disponível
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:111-115)

### RE-009: Tratamento de Valores Zerados
- **Regra**: Se valor da filial = 0 em uma despesa, exibe "-" ao invés de R$ 0,00
- **Motivo**: Indica que aquela despesa não existe naquela filial
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:192-198)

### RE-010: Indicadores % TD e % RB na Coluna Total
- **Regra**: Exibe dois percentuais abaixo do valor em cada linha da coluna Total
- **% TD (Total Despesas)**:
  - Cálculo: `(Valor da linha / Total de Despesas) × 100`
  - Cor: Padrão (text-muted-foreground)
  - Formato: "% TD: 99,99%"
- **% RB (Receita Bruta)**:
  - Cálculo: `(Valor da linha / Receita Bruta) × 100`
  - Cor: Laranja (`text-orange-600 dark:text-orange-400`)
  - Formato: "% RB: 99,99%"
  - Validação: Se Receita Bruta = 0, exibe "0,00%"
- **Layout**: 2 linhas com espaçamento vertical (`space-y-0.5`)
- **Font-size**: 10px (`text-[10px]`)
- **Aplicação**: Todos os níveis (total, departamento, tipo, despesa)
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:138-161)

### RE-011: Legenda no Rodapé do Card
- **Regra**: Exibir legenda explicativa abaixo da tabela
- **Conteúdo**: "Legenda: TD = Total de Despesas | TDF = Total Despesas da Filial | RB = Receita Bruta"
- **Estilo**: Texto pequeno (`text-xs`) com cor muted
- **Posicionamento**: Após a tabela, com borda superior
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:763-767)

### RE-012: Indicadores % TDF e % RB nas Colunas de Filiais
- **Regra**: Exibe dois percentuais abaixo do valor em cada linha das colunas de filiais
- **% TDF (Total Despesas da Filial)**:
  - Cálculo: `(Valor da linha / Total de Despesas da Filial) × 100`
  - Cor: Azul se abaixo da média (bom), Vermelho se acima (ruim), Cinza se igual
  - Formato: "% TDF: 99,99%"
  - Comparação: Compara com % TD da coluna Total para determinar cor
- **% RB (Receita Bruta da Filial)**:
  - Cálculo: `(Valor da linha / Receita Bruta da Filial Específica) × 100`
  - Cor: Laranja (`text-orange-600 dark:text-orange-400`)
  - Formato: "% RB: 99,99%"
  - Validação: Se Receita Bruta da Filial = 0, exibe "0,00%"
  - **Importante**: Usa receita bruta da **filial específica**, não do total
- **Layout**: 2 linhas com espaçamento vertical (`space-y-0.5`)
- **Font-size**: 10px (`text-[10px]`)
- **Aplicação**: Todos os níveis (total, departamento, tipo, despesa)
- **Background**: Cores alternadas por filial (azul/cinza)
- **Implementação**: [columns.tsx](../../../src/components/despesas/columns.tsx:213-246)
- **Versão**: Atualizado em 2025-01-12 (v1.1.0) - % RB agora usa receita da filial

### RE-013: Linha de Receita Bruta
- **Regra**: Exibir linha de "RECEITA BRUTA" acima da linha "TOTAL DESPESAS"
- **Tipo**: `tipo: 'receita'`
- **Estilo**:
  - Font: `font-bold text-base`
  - Cor: Verde (`text-green-600 dark:text-green-400`)
  - Não expande (sem subRows)
- **Coluna Total**: Soma da receita bruta de todas as filiais selecionadas
- **Colunas de Filiais**: Receita bruta individual de cada filial
- **Percentuais**: Não exibe % TD nem % RB (apenas o valor)
- **Implementação**:
  - [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:582-594)
  - [columns.tsx](../../../src/components/despesas/columns.tsx:63-66, 141-149, 201-210)
- **Versão**: Adicionado em 2025-01-12 (v1.1.0)

### RE-014: Linha de Lucro Líquido
- **Regra**: Exibir linha de "LUCRO LÍQUIDO" ao final da tabela (após "TOTAL DESPESAS" e todas as despesas)
- **Tipo**: `tipo: 'lucro_liquido'`
- **Estilo**:
  - Font: `font-bold text-base`
  - Cor: Azul (`text-blue-600 dark:text-blue-400`)
  - Não expande (sem subRows)
- **Coluna Total**: Soma do lucro líquido de todas as filiais selecionadas
- **Colunas de Filiais**: Lucro líquido individual de cada filial
- **Cálculo por Filial**: `Lucro Líquido = Lucro Bruto - Total Despesas`
- **Cálculo Total**: `Lucro Líquido Total = Σ Lucro Líquido de todas as filiais`
- **Condicional**: Linha só é exibida se `receitaPorFilial` estiver disponível
- **Percentuais**: Não exibe % TD nem % RB (apenas o valor + margem)
- **Implementação**:
  - [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:680-705)
  - [columns.tsx](../../../src/components/despesas/columns.tsx:72-75, 160-175, 238-255)
- **Versão**: Adicionado em 2025-01-12 (v1.2.0)

### RE-015: Margem de Lucro Líquido
- **Regra**: Exibir margem de lucro líquido (%) abaixo do valor na linha de Lucro Líquido
- **Formato**: `Margem: XX,XX%` (2 casas decimais, vírgula como separador)
- **Estilo**:
  - Font-size: `text-[10px]` (10px)
  - Cor: `text-muted-foreground`
  - Espaçamento: `mt-0.5` (2px acima)
- **Cálculo na Coluna Total**:
  - Fórmula: `(Lucro Líquido Total / Receita Bruta Total) × 100`
  - Validação: Se Receita Bruta = 0, exibe "0,00%"
- **Cálculo nas Colunas de Filiais**:
  - Fórmula: `(Lucro Líquido Filial / Receita Bruta Filial) × 100`
  - Validação: Usa receita bruta da **filial específica**
  - Validação: Se Receita Bruta da Filial = 0, exibe "0,00%"
- **Interpretação**:
  - Margem > 50%: Excelente rentabilidade
  - Margem 30-50%: Boa rentabilidade
  - Margem < 30%: Atenção necessária
  - Margem negativa: Prejuízo (despesas > lucro bruto)
- **Consistência**: Valor deve bater com o card "Margem Líquida" nos indicadores
- **Implementação**:
  - [columns.tsx](../../../src/components/despesas/columns.tsx:160-175, 238-255)
- **Versão**: Adicionado em 2025-01-12 (v1.2.0)

---

## Regras de Log e Auditoria

### RLA-001: Log de Acesso ao Módulo
- **Descrição**: Registra quando usuário acessa o módulo
- **Dados capturados**:
  - `module`: 'despesas'
  - `tenantId`: ID do tenant atual
  - `userName`: Nome completo do usuário
  - `userEmail`: ID do usuário
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:126-135)

### RLA-002: Log de Requisições API
- **Descrição**: Console.log detalhado de parâmetros e resultados
- **Dados logados**:
  - Parâmetros recebidos (schema, filial, datas)
  - Filiais autorizadas do usuário
  - Quantidade de registros retornados
  - Totalizadores calculados
- **Implementação**: [route.ts](../../../src/app/api/dre-gerencial/hierarquia/route.ts:96-241)

---

## Validações de Integridade

### VI-001: Verificação de Tenant
- **Descrição**: Garante que currentTenant está disponível antes de renderizar
- **Comportamento**: Exibe loading se tenant não carregado
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:599-605)

### VI-002: Validação de Dados Retornados
- **Descrição**: Verifica se API retornou dados válidos
- **Verificações**:
  - `response.ok`: HTTP 200-299
  - `data !== null`: dados não nulos
  - `data.departamentos`: array existe
- **Comportamento**: Exibe erro se validação falhar
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:210-212)

### VI-003: Proteção contra Divisão por Zero
- **Aplicação**:
  - Cálculo de margem líquida: verifica `receitaBruta > 0`
  - Cálculo de diferença vs média: verifica `qtdFiliais > 0 && valorTotal > 0`
  - Cálculo de variação: verifica `previous > 0`
- **Implementação**: Múltiplos locais no código

---

## Regras de Performance

### RP-001: Pré-carregamento de Filiais
- **Descrição**: Filiais são carregadas assim que tenant é identificado
- **Comportamento**: Hook `useBranchesOptions` faz fetch automático
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:94-98)

### RP-002: Carregamento Sob Demanda
- **Descrição**: Dados são buscados apenas após filtro aplicado
- **Comportamento**: Primeira carga automática ao montar componente com filiais selecionadas
- **Implementação**: [page.tsx](../../../src/app/(dashboard)/dre-gerencial/page.tsx:333-338)

### RP-003: Debounce de Filtros
- **Descrição**: Filtros não aplicados automaticamente, apenas ao clicar em "Filtrar"
- **Benefício**: Evita múltiplas requisições enquanto usuário ajusta filtros
- **Implementação**: [filters.tsx](../../../src/components/despesas/filters.tsx:73-81)

---

## Manutenção

**Última atualização**: 2025-01-11
**Versão**: 1.0.0

Para adicionar novas regras de negócio, siga o padrão de numeração e documentação estabelecido.
