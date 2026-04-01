# Estruturas de Dados: Configurações > Parâmetros

## Tabela Principal

### `public.tenant_parameters`

Campos atuais:

- `id: uuid`
- `tenant_id: uuid`
- `parameter_key: text`
- `parameter_value: boolean`
- `created_at: timestamptz`
- `updated_at: timestamptz`

Constraint relevante:

- `UNIQUE (tenant_id, parameter_key)`

## Chaves Atualmente Utilizadas

### `enable_descontos_venda`

- domínio: `boolean`
- default efetivo no frontend: `false`
- consumidores:
  - `use-tenant-parameters`
  - `app-sidebar`
  - página `descontos-venda`

### `enable_faturamento_metas`

- domínio: `boolean`
- default efetivo no frontend: `false`
- consumidores:
  - `use-tenant-parameters`
  - `tenant-parameters-server`
  - APIs de metas

### `enable_api_filial_vendas`

- domínio: `boolean`
- default efetivo no frontend: `false`
- consumidores atuais:
  - `use-tenant-parameters`
  - `parametros-content`
  - `tenant-parameters-server`
  - APIs do `Dashboard 360`

## Estrutura Client-side

Estado atual usado no frontend:

```ts
Record<string, boolean>
```

Shape inicial recorrente:

```ts
{
  enable_descontos_venda: false,
  enable_faturamento_metas: false,
  enable_api_filial_vendas: false,
}
```

## Estrutura Local da Tela

`ParametrosContent` trabalha com:

```ts
interface TenantParameter {
  id: string
  tenant_id: string
  parameter_key: string
  parameter_value: boolean
  created_at: string
  updated_at: string
}
```

## Estrutura Server-side

`isFaturamentoMetasEnabled(schema)` resolve:

1. `schema -> tenant.id` via tabela `tenants`
2. `tenant.id + parameter_key` em `tenant_parameters`
3. retorno booleano seguro com fallback `false`

## Observações

- `tenant_parameters` ainda não está refletida na tipagem gerada em `src/types/database.types.ts`.
- A ausência dessa tipagem gera uso de interfaces locais e `@ts-expect-error` em pontos de escrita.
