# Documentação de Módulos - BI SaaS

Esta pasta contém a documentação técnica detalhada de cada módulo do sistema BI SaaS.

## Estrutura

Cada módulo possui sua própria pasta com documentação completa:

```
docs/modules/
├── README.md (este arquivo)
└── {nome-do-modulo}/
    ├── README.md                # Visão geral e índice
    ├── BUSINESS_RULES.md        # Regras de negócio
    ├── DATA_STRUCTURES.md       # Interfaces e estruturas de dados
    ├── INTEGRATION_FLOW.md      # Fluxo de integração e APIs
    └── RPC_FUNCTIONS.md         # Funções RPC Supabase (se aplicável)
```

---

## Módulos Documentados

### 1. Dashboard 360
**Status**: ✅ Completo
**Versão**: 1.1.0
**Última atualização**: 2026-04-01

Visão consolidada de vendas, faturamento, entradas, perdas e performance por filial, com comparativos `PA`, `MTD` e `YTD`.

**Documentação**:
- [Visão Geral](./dashboard-360/README.md)
- [Regras de Negócio](./dashboard-360/BUSINESS_RULES.md)
- [Estruturas de Dados](./dashboard-360/DATA_STRUCTURES.md)
- [Fluxo de Integração](./dashboard-360/INTEGRATION_FLOW.md)
- [Funções RPC](./dashboard-360/RPC_FUNCTIONS.md)
- [Riscos e Refatorações](./dashboard-360/RISKS_AND_REFACTORING.md)

**Características principais**:
- Consolidação de PDV e faturamento no frontend
- Tabela analítica por filial com exportação PDF
- Comparativos por período com regras distintas por contexto
- Restrições multi-tenant e por filiais autorizadas

---

### 2. DRE Gerencial
**Status**: ✅ Completo
**Versão**: 1.0.0
**Última atualização**: 2025-01-11

Demonstrativo de Resultado do Exercício com análise comparativa de despesas entre filiais.

**Documentação**:
- [Visão Geral](./dre-gerencial/README.md)
- [Regras de Negócio](./dre-gerencial/BUSINESS_RULES.md)
- [Estruturas de Dados](./dre-gerencial/DATA_STRUCTURES.md)
- [Fluxo de Integração](./dre-gerencial/INTEGRATION_FLOW.md)
- [Funções RPC](./dre-gerencial/RPC_FUNCTIONS.md)

**Características principais**:
- Hierarquia 3 níveis (Departamento → Tipo → Despesa)
- Análise multi-filial consolidada
- Comparações temporais (PAM/PAA)
- Indicadores financeiros em tempo real

---

### 3. Configurações
**Status**: ✅ Completo
**Versão**: 1.0.0
**Última atualização**: 2026-04-01

Hub administrativo do sistema, com submódulos para perfil, usuários, setores, empresas e parâmetros do tenant.

**Documentação**:
- [Visão Geral](./configuracoes/README.md)
- [Regras de Negócio](./configuracoes/BUSINESS_RULES.md)
- [Estruturas de Dados](./configuracoes/DATA_STRUCTURES.md)
- [Fluxo de Integração](./configuracoes/INTEGRATION_FLOW.md)
- [Rotas de API](./configuracoes/API_ROUTES.md)
- [Submódulo Oficial de Parâmetros](./configuracoes/parametros/README.md)

**Características principais**:
- controle por role para perfil, usuários, parâmetros, setores e empresas
- suporte multi-tenant com tenant corrente vindo de `TenantContext`
- parâmetros por tenant com impacto em navegação e regras server-side

---

### 4. Metas por Setor
**Status**: ✅ Completo
**Versão**: 1.1.0
**Última atualização**: 2026-06-01

Acompanhamento de metas mensais por setor, filial e dia, com suporte ao modelo de realizados da API `/filial/vendas` por snapshot setorizada.

**Documentação**:
- [Visão Geral](./metas-setor/README.md)
- [Regras de Negócio](./metas-setor/BUSINESS_RULES.md)
- [Estruturas de Dados](./metas-setor/DATA_STRUCTURES.md)
- [Funções RPC](./metas-setor/RPC_FUNCTIONS.md)
- [Changelog](./metas-setor/CHANGELOG.md)

**Características principais**:
- setores definidos por hierarquia de departamentos
- fonte legada preservada para tenants sem `enable_api_filial_vendas`
- Lucro Líquido e Margem Realizada vindos de `vendas_setores_snapshot` no modelo novo

---

## Como Usar Esta Documentação

### Para Desenvolvedores

1. **Antes de modificar um módulo**:
   - Leia a visão geral do módulo correspondente
   - Revise as regras de negócio do módulo correspondente
   - Consulte as estruturas de dados do módulo correspondente

2. **Ao implementar alterações**:
   - Siga o fluxo de integração do módulo correspondente
   - Atualize a documentação afetada
   - Execute testes de integração

**Regra permanente**:
- qualquer alteração no módulo `Dashboard 360` deve atualizar a documentação oficial em [`docs/modules/dashboard-360/`](./dashboard-360/README.md)
- qualquer alteração no submódulo `Configurações > Parâmetros` deve atualizar a documentação oficial em [`docs/modules/configuracoes/parametros/`](./configuracoes/parametros/README.md)
- qualquer alteração no módulo `Metas por Setor` deve atualizar a documentação oficial em [`docs/modules/metas-setor/`](./metas-setor/README.md)

3. **Ao trabalhar com banco de dados**:
   - Consulte [Funções RPC](./dre-gerencial/RPC_FUNCTIONS.md)
   - Verifique índices e performance

### Para Novos Desenvolvedores

1. Comece pela [Visão Geral do Projeto](../../CLAUDE.md)
2. Leia a [Arquitetura Multi-Tenant](../../docs/SUPABASE_SCHEMA_CONFIGURATION.md)
3. Estude um módulo completo (ex: DRE Gerencial)
4. Consulte documentação específica conforme necessidade

### Para Product Owners / Stakeholders

- **[README.md](./dre-gerencial/README.md)**: Funcionalidades e capacidades
- **[BUSINESS_RULES.md](./dre-gerencial/BUSINESS_RULES.md)**: Lógica de negócio e validações

---

## Padrão de Documentação

Todos os módulos seguem o mesmo padrão de documentação:

### README.md (Visão Geral)
- Índice completo
- Visão geral do módulo
- Componentes e funções
- Arquitetura
- Fluxo de dados
- Conceitos-chave
- Links para documentos detalhados

### BUSINESS_RULES.md (Regras de Negócio)
- Regras de acesso
- Regras de filtro
- Regras de cálculo
- Regras de consolidação
- Regras de comparação temporal
- Regras de exibição
- Regras de log e auditoria
- Validações de integridade

### DATA_STRUCTURES.md (Estruturas de Dados)
- Interfaces TypeScript
- Tipos de dados
- Schemas de validação (Zod)
- Estruturas de resposta da API
- Estruturas de banco de dados
- Exemplos de uso
- Diagramas de dados

### INTEGRATION_FLOW.md (Fluxo de Integração)
- Visão geral do fluxo
- Fluxo de inicialização
- Fluxo de aplicação de filtros
- Fluxo de busca de dados
- Fluxo de consolidação
- Fluxo de renderização
- Diagramas de sequência
- Tratamento de erros

### RPC_FUNCTIONS.md (Funções RPC)
- Visão geral
- Assinatura das funções
- Parâmetros e retornos
- Permissões e segurança
- Exemplos de uso
- Troubleshooting
- Manutenção e versionamento

---

## Contribuindo com a Documentação

### Criando Documentação para Novo Módulo

1. Criar pasta do módulo:
   ```bash
   mkdir docs/modules/{nome-do-modulo}
   ```

2. Copiar template:
   ```bash
   cp -r docs/modules/dre-gerencial docs/modules/{nome-do-modulo}
   ```

3. Atualizar conteúdo de cada arquivo

4. Adicionar entrada neste README.md

### Atualizando Documentação Existente

1. Identificar documento a ser atualizado
2. Fazer alterações necessárias
3. Atualizar data em "Última atualização"
4. Se mudança significativa, incrementar versão
5. Commitar com mensagem descritiva:
   ```bash
   git add docs/modules/{modulo}
   git commit -m "docs: Atualiza {documento} do módulo {modulo}"
   ```

### Boas Práticas

- ✅ Usar linguagem clara e objetiva
- ✅ Incluir exemplos práticos
- ✅ Adicionar diagramas quando útil
- ✅ Manter consistência com padrão estabelecido
- ✅ Documentar ANTES de implementar mudanças complexas
- ✅ Revisar documentação após mudanças
- ✅ Linkar arquivos de código com formato `[arquivo.ts](path/to/arquivo.ts:linha)`

---

## Próximos Módulos a Documentar

1. **Ruptura ABCD** - Relatório de ruptura por curva ABC
2. **Venda por Curva** - Análise de vendas por curva ABC
3. **Metas Mensais** - Gestão de metas por filial
4. **Metas por Setor** - Gestão de metas por setor de negócio
5. **Dashboard Principal** - Visão geral de indicadores

---

## Suporte

Para dúvidas sobre a documentação:
- Abrir issue no GitHub
- Consultar equipe de desenvolvimento
- Revisar código-fonte correspondente

---

## Manutenção

**Responsável**: Equipe de Desenvolvimento
**Revisão**: Trimestral
**Última revisão geral**: 2025-01-11

Esta documentação é considerada **fonte de verdade** para o comportamento esperado dos módulos.
