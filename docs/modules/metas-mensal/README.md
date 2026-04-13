# Metas Mensal

> Status: ✅ Implementado | Versão: 1.6.0

## Visão Geral

O módulo de **Metas Mensais** permite o gerenciamento e acompanhamento de metas de vendas diárias por filial, com base em referências históricas do ano anterior. O sistema calcula automaticamente metas para cada dia útil do mês, compara com valores realizados e exibe indicadores de performance.

### Características Principais

- 📊 Geração automática de metas baseada em histórico
- ✏️ Edição inline de valores de meta
- 🔄 Atualização automática de valores realizados
- 📈 Visualização de progresso com gráficos circulares
- 🏢 Suporte a múltiplas filiais simultâneas
- 📅 Agrupamento inteligente por data
- 🎯 Indicadores de atingimento (mês completo e D-1)
- 🛒 Colunas de compras com carregamento tardio
- 🔐 Respeita restrições de filiais por usuário

## Funcionalidades

- ✅ Geração de metas para o mês inteiro
- ✅ Visualização por filial ou múltiplas filiais
- ✅ Edição inline de meta percentual e valor
- ✅ Atualização automática de vendas realizadas
- ✅ Meta Compras, Realizado Compras e % Comp./Venda
- ✅ Cards de resumo (Total Vendas, Progresso Mês, Progresso D-1)
- ✅ Agrupamento expansível por data (modo múltiplas filiais)
- ✅ Lista detalhada por dia (modo filial única)
- ✅ Filtros por mês, ano e filiais
- ✅ Auditoria de acesso ao módulo

## Componentes Principais

### Frontend

- **Página Principal**: [src/app/(dashboard)/metas/mensal/page.tsx](../../src/app/(dashboard)/metas/mensal/page.tsx)
  - 1.290 linhas
  - Gerenciamento completo de metas
  - Interface com edição inline
  - Visualização adaptativa (multi-filial vs filial única)

- **Componentes**:
  - [MetasFilters](../../src/components/metas/filters.tsx) - Filtros de mês, ano e filiais
  - [MultiFilialFilter](../../src/components/filters/multi-filial-filter.tsx) - Seleção múltipla de filiais
  - shadcn/ui components (Card, Table, Dialog, Progress, etc)

- **Hooks**:
  - [useBranchesOptions](../../src/hooks/use-branches.ts) - Busca e formatação de filiais
  - useTenantContext - Contexto de tenant e usuário

### Backend

- **API Routes**:
  - [POST /api/metas/generate](../../src/app/api/metas/generate/route.ts) - Gera metas mensais
  - [GET /api/metas/report](../../src/app/api/metas/report/route.ts) - Busca relatório de metas
  - [POST /api/metas/update](../../src/app/api/metas/update/route.ts) - Atualiza metas/valores
  - [GET /api/metas/compras](../../src/app/api/metas/compras/route.ts) - Busca dados de compras das metas

- **RPC Functions**:
  - `generate_metas_mensais` - Gera metas para todos os dias do mês
  - `get_metas_mensais_report` - Retorna relatório com valores realizados
  - `update_meta_mensal` - Atualiza meta individual
  - `atualizar_valores_realizados_metas` - Atualiza valores em lote
  - `get_metas_mensais_compras_report` - Retorna compras por dia/filial
  - `get_metas_mensais_compras_summary_by_filial` - Retorna resumo de compras por filial

### Database

- **Tabelas**:
  - `{schema}.metas_mensais` - Armazena metas diárias
  - `{schema}.vendas_diarias_por_filial` - Vendas realizadas (para comparação)

- **Campos Principais (metas_mensais)**:
  - `id`, `filial_id`, `data`, `dia_semana`
  - `meta_percentual`, `data_referencia`, `valor_referencia`
  - `valor_meta`, `valor_realizado`
  - `diferenca`, `diferenca_percentual`

## Acesso Rápido

- 🔗 **Rota**: `/metas/mensal`
- 📄 **Regras de Negócio**: [BUSINESS_RULES.md](./BUSINESS_RULES.md)
- 🗂️ **Estruturas de Dados**: [DATA_STRUCTURES.md](./DATA_STRUCTURES.md)
- 🔄 **Fluxo de Integração**: [INTEGRATION_FLOW.md](./INTEGRATION_FLOW.md)
- ⚙️ **Funções RPC**: [RPC_FUNCTIONS.md](./RPC_FUNCTIONS.md)
- 📝 **Changelog**: [CHANGELOG.md](./CHANGELOG.md)

## Permissões

| Role | Acesso | Operações |
|------|--------|-----------|
| superadmin | ✅ Total | Gerar, visualizar, editar (todas as filiais) |
| admin | ✅ Total | Gerar, visualizar, editar (filiais do tenant) |
| user | ✅ Leitura/Escrita | Gerar, visualizar, editar (filiais autorizadas) |
| viewer | 👁️ Somente Leitura | Visualizar (filiais autorizadas) |

**Observação**: Usuários com restrições de filiais só podem gerar/editar metas das filiais autorizadas.

## Fluxos Principais

### 1. Geração de Metas

```
Usuário → [Botão "Gerar Metas"]
       → Dialog com formulário
       → Preenche: Filial, Mês/Ano, % Meta, Data Referência
       → [Gerar Metas]
       → POST /api/metas/generate
       → RPC generate_metas_mensais()
       → Cria/substitui metas para todos os dias do mês
       → Relatório atualizado automaticamente
```

### 2. Visualização de Metas

```
Usuário → Seleciona filtros (Filiais, Mês, Ano)
       → [Filtrar]
       → Atualiza valores realizados (background)
       → GET /api/metas/report
       → RPC get_metas_mensais_report()
       → GET /api/metas/compras (assíncrono, após relatório)
       → Retorna MetasReport
       → Frontend renderiza:
          - Cards de resumo
          - Tabela com metas (agrupada ou detalhada)
          - Colunas de compras preenchidas por último
```

### Compras

- **Meta Compras**: `valor_meta - (valor_meta * meta_margem_percentual / 100)`
- **Realizado Compras**: soma de `entradas.valor_total` por filial/data com `transacao IN ('P', 'V')`
- **% Comp./Venda**: `realizado_compras / valor_realizado * 100`
- **Carregamento**: feito em chamada separada para não degradar o tempo crítico de abertura da tela

### 3. Edição Inline

```
Usuário → Duplo-clique em célula de meta
       → Input aparece no lugar
       → Digita novo valor
       → Enter ou perde foco
       → POST /api/metas/update
       → RPC update_meta_mensal()
       → Atualiza valor e recalcula diferenças
       → UI atualizada localmente (otimistic update)
```

## Dependências

### Externas
- **Supabase**: Autenticação, RPC, Database
- **date-fns**: Manipulação e formatação de datas
- **SWR**: Cache de filiais
- **lucide-react**: Ícones
- **recharts**: Gráficos (não usado atualmente, mas disponível)

### Internas
- **TenantContext**: Gerenciamento de tenant e usuário
- **useBranchesOptions**: Hook para buscar filiais
- **logModuleAccess**: Auditoria de acesso
- **shadcn/ui**: Componentes de UI

## Características Técnicas

### Performance
- **Cache**: Desabilitado (force-dynamic, revalidate: 0)
- **Deduplicação**: SWR com 2s para filiais
- **Memoização**: Arrays e sets memoizados com useMemo
- **Scroll Virtual**: Multi-select com ScrollArea

### Responsividade
- Layout adaptativo mobile/desktop
- Filtros verticais em mobile
- Tabela com scroll horizontal
- Modais full-screen em mobile

### Validações
- Campos obrigatórios no formulário
- Validação de autorização de filiais
- Verificação de datas válidas
- Tratamento de erros em cada API

### Auditoria
- Log de acesso ao módulo (tenant_id, user_id, timestamp)
- Timestamps em alterações (created_at, updated_at)

## Indicadores Exibidos

### Card: Vendas do Período
- **Total Realizado**: Soma de todas as vendas realizadas
- **Total Meta**: Soma de todas as metas
- **Diferença**: Realizado - Meta
- **Cor**: Verde (positivo), Vermelho (negativo)

### Card: Progresso da Meta (Mês Completo)
- **Percentual Atingido**: (Realizado / Meta) × 100
- **Gráfico Circular**: Progresso visual
- **Cor**: Verde (≥100%), Amarelo (≥80%), Vermelho (<80%)

### Card: Progresso da Meta (D-1)
- **Até o Dia Anterior**: Considera apenas dias até ontem
- **Percentual Atingido D-1**: (Realizado D-1 / Meta D-1) × 100
- **Gráfico Circular**: Progresso visual
- **Finalidade**: Avaliar performance sem influência do dia atual

## Histórico de Fixes/Features

- **v1.0.0** - Implementação inicial
- **v1.1.0** - Adicionado filtro de múltiplas filiais
- **v1.2.0** - Implementado agrupamento por data
- **v1.3.0** - Adicionada edição inline
- **v1.4.0** - Implementado indicador D-1
- **v1.5.0** - Auto-seleção de todas as filiais ao carregar
- **v1.5.1** - Fix: Tratamento de erro quando tabela não existe (primeiro acesso)

Ver [CHANGELOG.md](./CHANGELOG.md) para detalhes completos.

## Documentação Relacionada

### Docs Oficiais
- [MODULO_METAS_OVERVIEW.md](../../MODULO_METAS_OVERVIEW.md) - Overview completo (830 linhas)
- [FIX_METAS_MENSAL_D1.md](../../FIX_METAS_MENSAL_D1.md) - Fix indicador D-1
- [FEATURE_INLINE_EDIT_METAS.md](../../FEATURE_INLINE_EDIT_METAS.md) - Implementação edição inline
- [FIX_FILTRO_FILIAIS_METAS.md](../../FIX_FILTRO_FILIAIS_METAS.md) - Fix filtro de filiais

### Arquitetura
- [DOCUMENTATION_STANDARDS.md](../../DOCUMENTATION_STANDARDS.md) - Padrões de documentação

## Próximos Passos / Roadmap

- [ ] Exportação para Excel
- [ ] Gráfico de evolução diária
- [ ] Comparação com múltiplos períodos
- [ ] Alertas de metas em risco
- [ ] Dashboard executivo de metas
- [ ] Metas por categoria de produto

## Versão

**Versão Atual**: 1.6.0
**Última Atualização**: 2026-04-13
**Responsável**: Documentação Técnica
