# Regras de Negócio - Metas Mensal

Este documento contém todas as regras de negócio do módulo de Metas Mensais.

## Índice

1. [Regras de Geração de Metas](#regras-de-geração-de-metas)
2. [Regras de Cálculo](#regras-de-cálculo)
3. [Regras de Validação](#regras-de-validação)
4. [Regras de Visualização](#regras-de-visualização)
5. [Regras de Edição](#regras-de-edição)
6. [Regras de Autorização](#regras-de-autorização)

---

## Regras de Geração de Metas

### RN-GER-001: Geração Baseada em Histórico

**Descrição**: Metas são geradas com base nas vendas do mesmo dia da semana do ano anterior.

**Lógica**:
1. Para cada dia do mês/ano solicitado
2. Identifica o dia da semana (Segunda, Terça, etc)
3. Busca a venda do mesmo dia de semana no ano anterior
4. Calcula meta = venda_referência × (1 + percentual/100)

**Exemplo**:
```
Data Meta: 2025-01-15 (Quarta-feira)
Data Referência Inicial: 2024-01-15 (Segunda-feira)
Data Referência Usada: 2024-01-17 (Quarta-feira)
Venda Referência: R$ 10.000,00
Meta Percentual: 10%
Meta Calculada: R$ 10.000,00 × 1,10 = R$ 11.000,00
```

**Implementação**: [generate/route.ts:40-80](../../../src/app/api/metas/generate/route.ts#L40-L80)

---

### RN-GER-002: Substituição de Metas Existentes

**Descrição**: Gerar metas para um período que já possui metas substitui os valores existentes.

**Comportamento**:
- INSERT com ON CONFLICT UPDATE
- Mantém apenas as metas mais recentes
- Não mantém histórico de metas anteriores

**Implementação**: RPC `generate_metas_mensais` (UPSERT)

**Observação**: ⚠️ Operação destrutiva - avisa o usuário antes de substituir.

---

### RN-GER-003: Geração para Mês Completo

**Descrição**: Sempre gera metas para TODOS os dias do mês, independente do dia atual.

**Regra**:
- Gera do dia 1 ao último dia do mês (28, 29, 30 ou 31)
- Inclui domingos e feriados
- Mesmo que alguns dias não tenham venda de referência

**Exemplo**:
```
Solicita geração: Janeiro/2025
Gera metas para: 01/01 até 31/01 (31 registros)
Dia atual: 15/01
Resultado: 31 metas criadas (incluindo dias futuros)
```

---

### RN-GER-004: Meta Percentual Padrão

**Descrição**: Meta percentual representa o crescimento esperado sobre a referência.

**Valores Válidos**:
- Positivo: crescimento (ex: 10% = +10% sobre referência)
- Zero: manter mesmo valor da referência
- Negativo: redução (ex: -5% = -5% sobre referência)

**Fórmula**:
```
meta = valor_referencia × (1 + percentual/100)
```

**Exemplos**:
- Referência R$ 10.000, percentual 10% → Meta R$ 11.000
- Referência R$ 10.000, percentual 0% → Meta R$ 10.000
- Referência R$ 10.000, percentual -5% → Meta R$ 9.500

---

## Regras de Cálculo

### RN-CALC-001: Cálculo de Diferença

**Descrição**: Diferença entre valor realizado e meta.

**Fórmula**:
```
diferenca = valor_realizado - valor_meta
```

**Interpretação**:
- Positivo: Superou a meta ✅
- Zero: Atingiu exatamente a meta ⚪
- Negativo: Não atingiu a meta ❌

**Implementação**: Cálculo automático na RPC

---

### RN-CALC-002: Cálculo de Diferença Percentual

**Descrição**: Percentual de atingimento da meta.

**Fórmula**:
```
diferenca_percentual = (diferenca / valor_meta) × 100
```

**Exemplo**:
```
Meta: R$ 10.000
Realizado: R$ 11.000
Diferença: R$ 1.000
Diferença %: (1.000 / 10.000) × 100 = 10%
```

**Casos Especiais**:
- Se meta = 0: diferenca_percentual = 0
- Se realizado > meta: percentual positivo (verde)
- Se realizado < meta: percentual negativo (vermelho)

---

### RN-CALC-003: Total Realizado

**Descrição**: Soma de todos os valores realizados do período.

**Fórmula**:
```
total_realizado = SUM(valor_realizado) WHERE mes = X AND ano = Y
```

**Filtros Aplicados**:
- Mês e ano selecionados
- Filiais selecionadas
- Todos os dias do período

---

### RN-CALC-004: Total Meta

**Descrição**: Soma de todas as metas do período.

**Fórmula**:
```
total_meta = SUM(valor_meta) WHERE mes = X AND ano = Y
```

---

### RN-CALC-005: Percentual Atingido

**Descrição**: Percentual geral de atingimento das metas do período.

**Fórmula**:
```
percentual_atingido = (total_realizado / total_meta) × 100
```

**Interpretação**:
- ≥ 100%: Bateu a meta ✅ (verde)
- ≥ 80% e < 100%: Próximo da meta ⚠️ (amarelo)
- < 80%: Abaixo da meta ❌ (vermelho)

**Exemplo**:
```
Total Meta: R$ 100.000
Total Realizado: R$ 95.000
Percentual: (95.000 / 100.000) × 100 = 95%
Status: Amarelo (quase lá)
```

---

### RN-CALC-006: Cálculo D-1 (Até Dia Anterior)

**Descrição**: Percentual atingido considerando apenas dias até ontem.

**Lógica**:
1. Filtra metas onde `data < DATA_ATUAL`
2. Soma valores realizados desses dias
3. Soma metas desses dias
4. Calcula percentual

**Fórmula**:
```
total_realizado_d1 = SUM(valor_realizado) WHERE data < CURRENT_DATE
total_meta_d1 = SUM(valor_meta) WHERE data < CURRENT_DATE
percentual_d1 = (total_realizado_d1 / total_meta_d1) × 100
```

**Finalidade**: Avaliar performance sem influência do dia atual (que pode estar incompleto).

**Exemplo**:
```
Hoje: 15/01/2025 às 10h
Período: Janeiro/2025
D-1 considera: 01/01 até 14/01
Ignora: 15/01 (dia atual)
```

**Implementação**: [page.tsx:280-320](../../../src/app/(dashboard)/metas/mensal/page.tsx#L280-L320)

---

### RN-CALC-007: Fonte snapshot para lucro líquido e margem realizada

Quando `enable_api_filial_vendas = true` para o tenant, as APIs de relatório mensal devem usar RPCs paralelas baseadas em `{schema}.vendas_filiais_snapshot`.

Mapeamento de campos:

- Receita realizada: `vendas_filiais_snapshot.valor`
- Custo realizado: `vendas_filiais_snapshot.custo_total_ajustado`
- Lucro Líquido: `vendas_filiais_snapshot.lucro_ajustado`
- Margem Realizada: `vendas_filiais_snapshot.margem_ajustada_percentual`

Quando `enable_api_filial_vendas = false`, o módulo deve manter as RPCs legadas sem alteração.

O submódulo `Metas por Setor` não usa essa fonte neste momento, porque `vendas_filiais_snapshot` é agregada por filial/dia e não possui granularidade por setor.

---

## Regras de Validação

### RN-VAL-001: Campos Obrigatórios na Geração

**Descrição**: Validação dos campos do formulário de geração.

**Campos Obrigatórios**:
- `filialId` (INTEGER) - ID da filial
- `mes` (1-12) - Mês
- `ano` (YYYY) - Ano
- `metaPercentual` (NUMERIC) - Percentual da meta
- `dataReferenciaInicial` (DATE) - Data base

**Validação**:
```typescript
if (!filialId || !mes || !ano || metaPercentual === undefined || !dataReferenciaInicial) {
  return error("Todos os campos são obrigatórios")
}
```

**Mensagem de Erro**: "Todos os campos são obrigatórios"

**Implementação**: [generate/route.ts:30-40](../../../src/app/api/metas/generate/route.ts#L30-L40)

---

### RN-VAL-002: Validação de Mês

**Descrição**: Mês deve estar entre 1 e 12.

**Condição**:
```typescript
if (mes < 1 || mes > 12) {
  return error("Mês inválido")
}
```

---

### RN-VAL-003: Validação de Ano

**Descrição**: Ano deve ser razoável (não muito antigo nem muito futuro).

**Condição**:
```typescript
const anoAtual = new Date().getFullYear()
if (ano < anoAtual - 5 || ano > anoAtual + 5) {
  return error("Ano fora do intervalo permitido")
}
```

---

### RN-VAL-004: Validação de Data de Referência

**Descrição**: Data de referência deve ser do ano anterior.

**Condição**:
```typescript
const dataRef = new Date(dataReferenciaInicial)
const anoRef = dataRef.getFullYear()
if (anoRef !== ano - 1) {
  return warning("Data de referência não é do ano anterior")
}
```

---

### RN-VAL-005: Filial Deve Existir

**Descrição**: Filial selecionada deve existir e estar ativa.

**Validação**: API verifica se `filialId` existe na lista de filiais autorizadas.

---

## Regras de Visualização

### RN-VIS-001: Agrupamento por Data (Múltiplas Filiais)

**Descrição**: Quando múltiplas filiais são selecionadas, agrupa metas por data.

**Lógica**:
```typescript
if (filiaisSelecionadas.length > 1) {
  // Agrupar por data
  // Mostrar expand/collapse
} else {
  // Lista simples por data
}
```

**Comportamento**:
- Linha principal: Data com totais agregados
- Expande: Mostra detalhe de cada filial
- Colapsa: Esconde detalhes

**Implementação**: [page.tsx:425-485](../../../src/app/(dashboard)/metas/mensal/page.tsx#L425-L485)

---

### RN-VIS-002: Ordenação por Data

**Descrição**: Metas sempre ordenadas por data crescente (mais antigas primeiro).

**Ordenação**:
```sql
ORDER BY data ASC
```

---

### RN-VIS-003: Formatação de Valores Monetários

**Descrição**: Valores exibidos no formato brasileiro.

**Formato**: `R$ 1.234,56`

**Função**:
```typescript
new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(value)
```

---

### RN-VIS-004: Formatação de Percentuais

**Descrição**: Percentuais com 2 casas decimais e vírgula.

**Formato**: `12,34%`

**Função**:
```typescript
valor.toFixed(2).replace('.', ',') + '%'
```

---

### RN-VIS-005: Cores de Diferença

**Descrição**: Cores indicam se meta foi atingida.

**Regras**:
- **Verde** (`text-green-600`): diferenca > 0 (superou)
- **Vermelho** (`text-red-600`): diferenca < 0 (não atingiu)
- **Cinza** (`text-muted-foreground`): diferenca = 0 (exato)

---

### RN-VIS-006: Cores de Progresso

**Descrição**: Cores no gráfico circular de progresso.

**Regras**:
- **Verde** (`text-green-600`): percentual ≥ 100%
- **Amarelo** (`text-yellow-600`): 80% ≤ percentual < 100%
- **Vermelho** (`text-red-600`): percentual < 80%

---

### RN-VIS-007: Exibição de Dia da Semana

**Descrição**: Mostra dia da semana abreviado na coluna de data.

**Formato**: `Seg, Ter, Qua, Qui, Sex, Sáb, Dom`

**Implementação**:
```typescript
format(date, 'EEE', { locale: ptBR })
```

---

### RN-VIS-008: Cards de Resumo

**Descrição**: 3 cards no topo da página.

**Cards**:
1. **Vendas do Período**: Total realizado vs total meta
2. **Progresso da Meta**: Percentual atingido (mês completo)
3. **Progresso da Meta D-1**: Percentual até dia anterior

**Sempre Visíveis**: Sim, mesmo sem dados (mostra R$ 0,00)

---

## Regras de Edição

### RN-EDT-001: Edição Inline Habilitada

**Descrição**: Usuário pode editar meta percentual e valor da meta com duplo clique.

**Campos Editáveis**:
- `meta_percentual` - Percentual da meta
- `valor_meta` - Valor da meta

**Campos NÃO Editáveis**:
- `valor_realizado` - Atualizado automaticamente
- `data` - Data fixa
- `diferenca`, `diferenca_percentual` - Calculados

---

### RN-EDT-002: Ativação da Edição

**Descrição**: Duplo clique na célula ativa modo de edição.

**Evento**: `onDoubleClick`

**Comportamento**:
1. Célula vira input
2. Valor atual pré-preenchido
3. Foco automático no input
4. Enter ou blur: salva
5. ESC: cancela

**Implementação**: [page.tsx:545-590](../../../src/app/(dashboard)/metas/mensal/page.tsx#L545-L590)

---

### RN-EDT-003: Salvamento da Edição

**Descrição**: Ao salvar, recalcula diferenças automaticamente.

**Fluxo**:
1. Usuário digita novo valor
2. Pressiona Enter ou perde foco
3. POST /api/metas/update com novo valor
4. RPC atualiza valor e recalcula
5. Frontend atualiza estado local
6. Volta ao modo visualização

---

### RN-EDT-004: Cancelamento da Edição

**Descrição**: ESC cancela edição sem salvar.

**Evento**: `onKeyDown` (key === 'Escape')

**Comportamento**:
- Descarta valor digitado
- Volta ao modo visualização
- Mantém valor original

---

### RN-EDT-005: Validação de Valor Editado

**Descrição**: Valor editado deve ser numérico válido.

**Validação**:
```typescript
const valor = parseFloat(editingValue)
if (isNaN(valor)) {
  toast.error("Valor inválido")
  return
}
```

---

### RN-EDT-006: Recálculo Automático

**Descrição**: Ao editar meta, diferenças são recalculadas.

**Campos Recalculados**:
```typescript
diferenca = valor_realizado - novo_valor_meta
diferenca_percentual = (diferenca / novo_valor_meta) × 100
```

**Implementação**: Backend (RPC `update_meta_mensal`)

---

### RN-EDT-007: Atualização Otimista

**Descrição**: UI atualiza antes de confirmar no servidor.

**Fluxo**:
1. Frontend atualiza estado local imediatamente
2. Envia requisição ao servidor
3. Se erro: reverte para valor anterior + toast de erro
4. Se sucesso: mantém novo valor

---

## Regras de Autorização

### RN-AUT-001: Restrições de Filiais

**Descrição**: Usuários podem ter restrições de quais filiais podem acessar.

**Lógica**:
- Se `user_authorized_branches` vazio → acessa TODAS as filiais
- Se `user_authorized_branches` populado → acessa APENAS filiais listadas

**Validação**: API valida em cada requisição.

---

### RN-AUT-002: Geração Somente em Filiais Autorizadas

**Descrição**: Usuário só pode gerar metas para filiais que tem acesso.

**Validação**:
```typescript
if (hasRestrictions && !authorizedBranchIds.includes(filialId)) {
  return error("Sem autorização para esta filial")
}
```

**Implementação**: [generate/route.ts:50-70](../../../src/app/api/metas/generate/route.ts#L50-L70)

---

### RN-AUT-003: Visualização Somente de Filiais Autorizadas

**Descrição**: Relatório filtra automaticamente apenas filiais autorizadas.

**Lógica**:
```typescript
const filiaisAutorizadas = authorizedBranchIds
const filiaisPermitidas = filialIdsSolicitados.filter(id =>
  filiaisAutorizadas.includes(id)
)
```

**Implementação**: [report/route.ts:40-60](../../../src/app/api/metas/report/route.ts#L40-L60)

---

### RN-AUT-004: Edição Somente de Filiais Autorizadas

**Descrição**: Usuário só pode editar metas de filiais que tem acesso.

**Validação**: API verifica se a meta pertence a uma filial autorizada antes de permitir edição.

---

### RN-AUT-005: Superadmin Acessa Tudo

**Descrição**: Usuários com role `superadmin` não têm restrições.

**Comportamento**:
- Vê todas as filiais
- Gera metas para qualquer filial
- Edita qualquer meta

---

### RN-AUT-006: Viewer Somente Leitura

**Descrição**: Usuários com role `viewer` não podem editar ou gerar.

**Restrições**:
- ❌ Não pode gerar metas
- ❌ Não pode editar metas
- ✅ Pode visualizar (filiais autorizadas)

**Implementação**: UI esconde botões de ação para viewers.

---

## Regras de Atualização Automática

### RN-ATU-001: Atualização de Valores Realizados

**Descrição**: Valores realizados são atualizados automaticamente ao carregar relatório.

**Momento**: Sempre antes de buscar relatório (POST /api/metas/update)

**Lógica**:
1. Busca vendas atuais do período
2. JOIN com metas por data e filial
3. Atualiza `valor_realizado`
4. Recalcula diferenças

**Implementação**: RPC `atualizar_valores_realizados_metas`

---

### RN-ATU-002: Fonte de Valores Realizados

**Descrição**: Valores vêm da tabela `vendas_diarias_por_filial`.

**Query**:
```sql
SELECT SUM(valor_total)
FROM {schema}.vendas_diarias_por_filial
WHERE data_venda = meta.data
  AND filial_id = meta.filial_id
```

---

## Regras Especiais

### RN-ESP-001: Auto-Seleção de Filiais ao Carregar

**Descrição**: Ao carregar página, todas as filiais são automaticamente selecionadas.

**Comportamento**:
- useEffect detecta carregamento inicial
- Se `filiaisSelecionadas` vazio → seleciona todas
- Aplica filtro automaticamente

**Implementação**: [page.tsx:180-200](../../../src/app/(dashboard)/metas/mensal/page.tsx#L180-L200)

**Observação**: Facilita visualização imediata sem necessidade de seleção manual.

---

### RN-ESP-002: Auditoria de Acesso

**Descrição**: Acesso ao módulo é registrado para auditoria.

**Dados Registrados**:
- `tenant_id` - Tenant do usuário
- `user_id` - ID do usuário
- `module_name` - "metas-mensal"
- `timestamp` - Data/hora do acesso

**Implementação**: `logModuleAccess('metas-mensal')`

---

### RN-ESP-003: Cache Desabilitado

**Descrição**: APIs não usam cache para garantir dados atualizados.

**Configuração**:
```typescript
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

**Motivo**: Vendas mudam constantemente, cache causaria dados desatualizados.

---

### RN-ESP-004: Tratamento de Metas Sem Venda Realizada

**Descrição**: Se não houver venda no dia, `valor_realizado` = 0.

**Comportamento**:
- Meta existe: R$ 10.000
- Venda: R$ 0 (sem registro)
- Diferença: -R$ 10.000 (vermelho)
- Diferença %: -100%

---

### RN-ESP-005: Metas para Dias Futuros

**Descrição**: Metas podem existir para dias que ainda não aconteceram.

**Comportamento**:
- `valor_realizado` = 0 (ainda não vendeu)
- Diferença negativa (normal para dias futuros)
- Não afeta cálculo D-1 (que ignora dias futuros)

---

**Última Atualização**: 2025-01-11
**Versão**: 1.5.0
