# angel1-rag-eval — Claude Code working notes

## Project
CLI tool that evaluates RAG pipelines. Three scores:
retrieval precision, faithfulness, correctness.
Multi-provider judge (Claude / OpenAI).

## Stack
- TypeScript strict + tsup (ESM + CJS output)
- commander, chalk, ora, cli-table3, zod
- @anthropic-ai/sdk, openai
- pnpm

## Commands
- pnpm dev — tsup watch
- pnpm build — production build
- pnpm typecheck — tsc --noEmit
- pnpm lint — eslint
- pnpm format — prettier

## Working principles
- No new dependency unless justified
- All user-facing config via zod schemas
- Errors via thrown Error subclasses, formatted at CLI boundary
- Long-running API calls always behind a spinner
- Multi-provider abstraction: src/providers/{claude,openai}.ts
- One scorer (src/core/scorer.ts) consumes JudgeResult shape

## File map
src/
  index.ts         CLI entrypoint
  commands/run.ts  rag-eval run handler
  core/runner.ts   orchestrator
  core/judge.ts    judge LLM logic
  core/scorer.ts   metrics calculator
  providers/*.ts   LLM provider wrappers
  adapters/*.ts    user endpoint caller
  formatters/*.ts  output (table/csv/json)
  config/schema.ts zod schemas

## Roadmap
- FASE 1: setup (done)
- FASE 2: core CLI + retrieval check
- FASE 3: judge LLM (faithfulness + correctness)
- FASE 4: output formats + polish + README
- FASE 5: publish v0.1.0
