# Regras de Negocio: Metas por Setor

## RN-METAS-SETOR-001: Fonte por parametro

Quando `enable_api_filial_vendas = false`, Metas por Setor usa o fluxo legado baseado em `{schema}.metas_setor`.

Quando `enable_api_filial_vendas = true`, as leituras usam `{schema}.vendas_setores_snapshot` e as RPCs com sufixo `_api_filial_vendas`.

## RN-METAS-SETOR-002: Legado preservado

As funcoes legadas nao devem ser alteradas para ativar a fonte nova. A escolha deve ocorrer nas API routes.

## RN-METAS-SETOR-003: Atualizacao da snapshot

Antes da leitura, a tela chama `POST /api/metas/setor/update-valores`. No modo API `/filial/vendas`, essa rota atualiza a snapshot setorizada do mes selecionado.

O refresh automatico deve respeitar o setor selecionado e as filiais autorizadas/selecionadas. O caminho legado de atualizacao de realizados continua restrito a `admin` e `superadmin`.

## RN-METAS-SETOR-004: Hierarquia de departamento

O setor deve resolver seus departamentos ate o nivel 1 com `get_departamentos_hierarquia_simples`, pois os produtos vendidos sao vinculados por `produtos.departamento_id`.

## RN-METAS-SETOR-005: Lucro e margem realizados

No modelo novo:

- Lucro Liquido = `vendas_setores_snapshot.lucro_ajustado`
- Margem Realizada = `vendas_setores_snapshot.margem_ajustada_percentual`

O frontend pode manter nomes internos legados para compatibilidade, mas a exibicao deve usar os novos labels.

## RN-METAS-SETOR-006: Alocacao da snapshot filial

A snapshot setorizada deve aplicar os valores ajustados da filial pela participacao de receita do setor no total bruto da filial/dia. Essa regra evita misturar diretamente a snapshot de filial com metas setoriais sem uma chave de setor.
