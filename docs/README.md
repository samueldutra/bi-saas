# Documentação do Projeto

Este diretório contém documentação técnica complementar do projeto BI SaaS.

## Estrutura

- **MULTI_TENANT_ACCESS.md** - Funcionamento do multi-tenant e como conceder/remover acessos
  - Regras de RLS e funcoes usadas
  - Fluxos por SQL e API
  - Exemplo real aplicado

- **N8N_QUERIES.md** - Queries SQL documentadas para integração com N8N e automações
  - Queries prontas para uso em workflows de automação
  - Exemplos de uso e respostas esperadas
  - Fluxos sugeridos para WhatsApp e outras integrações

- **EMAIL_UPDATE_FEATURE.md** - Documentação da funcionalidade de alteração de email
  - Fluxo de alteração de email do usuário
  - Validações e segurança
  - Guia de testes e troubleshooting

## Como Usar

### Para Desenvolvedores

1. Consulte os arquivos de documentação antes de criar novas queries
2. Sempre documente novas queries seguindo o padrão estabelecido
3. Inclua exemplos de uso e respostas esperadas

### Para Integrações N8N

1. Acesse o arquivo `N8N_QUERIES.md`
2. Encontre a query necessária no índice
3. Copie o SQL ou a chamada RPC
4. Ajuste os parâmetros conforme necessário
5. Teste em ambiente de desenvolvimento antes de produção

## Contribuindo

Ao adicionar novas queries para N8N:

1. Crie a migration SQL em `/supabase/migrations/`
2. Documente a query em `N8N_QUERIES.md`
3. Inclua:
   - Descrição clara do propósito
   - Parâmetros necessários
   - Exemplo de resposta JSON
   - Exemplo de uso no N8N
   - Fluxo sugerido (opcional)

## Links Relacionados

- [README Principal](../README.md)
- [Migrações Supabase](../supabase/migrations/)
- [Instruções de Deploy](../DEPLOY_CHECKLIST.md)
