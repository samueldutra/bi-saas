# Regras de Negócio: Configurações > Parâmetros

## RN-PARAM-001: Escopo por tenant

Cada parâmetro é salvo por `tenant_id` e deve refletir apenas o tenant corrente selecionado no sistema.

## RN-PARAM-002: Acesso restrito

Somente usuários com role `admin` ou `superadmin` podem acessar a aba `Parâmetros` e alterar valores.

## RN-PARAM-003: Padrão seguro

Na ausência de registro para uma chave booleana em `tenant_parameters`, o comportamento efetivo deve ser `false`.

Na ausência de registro para `margem_perda`, o comportamento efetivo deve ser `0.00`.

## RN-PARAM-004: Chave única por tenant

Cada combinação `tenant_id + parameter_key` deve possuir no máximo um registro.

## RN-PARAM-005: Descontos de Vendas controlado por parâmetro

Quando `enable_descontos_venda = true`:

- o item `/descontos-venda` pode aparecer na sidebar
- a página do módulo pode ser usada normalmente

Quando `enable_descontos_venda = false`:

- o item deve ser ocultado da sidebar
- o acesso pela página faz redirect client-side para `/dashboard`

## RN-PARAM-006: Metas com faturamento controladas por parâmetro

Quando `enable_faturamento_metas = true`, as APIs de metas devem tentar primeiro as RPCs com faturamento.

Quando `enable_faturamento_metas = false`, as APIs devem seguir o comportamento legado sem faturamento.

## RN-PARAM-007: Fallback operacional em metas

Mesmo com `enable_faturamento_metas = true`, se a RPC nova falhar, o sistema deve tentar a RPC legada para preservar continuidade operacional.

## RN-PARAM-008: Origem PDV do Dashboard 360 controlada por parâmetro

Quando `enable_api_filial_vendas = true`, as APIs do `Dashboard 360` devem selecionar as RPCs paralelas baseadas em `vendas_filiais_snapshot`.

Quando `enable_api_filial_vendas = false`, o comportamento deve permanecer nas RPCs legadas baseadas em `vendas_diarias_por_filial`.

## RN-PARAM-009: Fórmula de ticket na fonte `/filial/vendas`

Quando o `Dashboard 360` estiver usando a fonte derivada da API `/filial/vendas`, o ticket médio deve ser calculado como:

```text
ticket_medio = vendas / quantidade_clientes
```

## RN-PARAM-010: Reload após alteração

Após alteração bem-sucedida em parâmetros booleanos na tela de parâmetros, a interface atual recarrega a página para reaplicar navegação e estados dependentes do tenant.

O parâmetro numérico `margem_perda` não altera navegação nem visibilidade de tela; por isso, sua gravação exibe confirmação sem recarregar a página.

## RN-PARAM-011: Fonte oficial de documentação

Mudanças neste submódulo só são consideradas completas quando a pasta `docs/modules/configuracoes/parametros/` estiver atualizada no mesmo ciclo de implementação.

## RN-PARAM-012: Margem de perda default por schema

`margem_perda` deve ser gravado por `tenant_id`, respeitando o schema corrente selecionado no sistema.

O valor aceito deve ser decimal entre `0.00` e `99.99`, persistido em `tenant_parameters.parameter_numeric_value`.

`parameter_value` permanece `false` para esse parâmetro, pois ele não é uma flag booleana.
