# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` contains Next.js routes, grouped by `(auth)` and `(dashboard)`, plus `api/` routes and `globals.css` theme styles.
- `src/components/` holds feature components (`auth`, `charts`, `dashboard`, `profile`) and shared UI in `ui/` (shadcn/ui).
- `src/hooks/` and `src/lib/` provide shared hooks, Supabase clients, Chart.js config, and utilities.
- `src/types/` defines Supabase and domain types.
- `public/` stores static assets; `scripts/` has maintenance and fix scripts.
- Key docs live in `README.md`, `CLAUDE.md`, and `docs/`.

## Build, Test, and Development Commands
- `npm run dev` starts the Next.js dev server (Turbopack) at `http://localhost:3000`.
- `npm run build` creates a production build.
- `npm start` runs the production server.
- `npm run lint` runs ESLint checks.
- `npm run clean` removes Next.js cache; `npm run clean:all` resets dependencies and cache.
- Cache helper: `./scripts/clean-cache.sh`.

## Coding Style & Naming Conventions
- Use TypeScript/React patterns already present in `src/`; keep components modular and colocated by feature.
- Follow existing naming: `use-*.ts` for hooks, `*.types.ts` for type files, and kebab-case folders.
- Run `npm run lint` before PRs; ESLint (Next.js config) is the source of truth.
- Qualquer alteração no módulo `Dashboard 360` (`/dashboard`, APIs relacionadas, componentes de `src/components/dashboard/` e documentação correlata) deve atualizar a documentação oficial em `docs/modules/dashboard-360/` no mesmo ciclo de mudança.
- Qualquer alteração no submódulo `Configurações > Parâmetros` (`/configuracoes` na aba `Parâmetros`, `src/components/configuracoes/parametros-content.tsx`, `src/hooks/use-tenant-parameters.ts`, consumidores de `tenant_parameters` e documentação correlata) deve atualizar a documentação oficial em `docs/modules/configuracoes/parametros/` no mesmo ciclo de mudança.

## Testing Guidelines
- No automated test runner is configured yet (no `test` script in `package.json`).
- When adding tests, align with the Next.js/React stack and document the command in `README.md`.

## Commit & Pull Request Guidelines
- Commit messages follow a simple prefix pattern, e.g. `Add: nova feature` (see `README.md`).
- PRs should include: a brief summary, local verification steps, and screenshots for UI changes.
- Link related issues or `PROJECT_STATUS.md` items when applicable.

## Agent-Specific Instructions
- Sempre responder em português (pt-BR).
- Ao mexer em qualquer módulo que exija alteração de tabelas ou funções do Supabase, garantir contexto atualizado da estrutura. Se a estrutura não estiver no contexto, solicitar e fornecer o SQL para extrair e enviar a definição atual da tabela ou função antes de propor mudanças, para evitar impactos em outros módulos que dependem da mesma tabela ou função.

## Security & Configuration Tips
- Configure Supabase and set environment variables in `.env.local` (never commit secrets).
- Validate RLS policies and migrations per `CLAUDE.md` and `docs/` before deploying.
