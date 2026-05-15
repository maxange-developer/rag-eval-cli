# @massiangelone/angel1-rag-eval

[![npm](https://img.shields.io/npm/v/@massiangelone/angel1-rag-eval.svg)](https://www.npmjs.com/package/@massiangelone/angel1-rag-eval)
[![CI](https://github.com/maxange-developer/angel1-rag-eval/actions/workflows/ci.yml/badge.svg)](https://github.com/maxange-developer/angel1-rag-eval/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Evaluate RAG pipelines: retrieval precision, faithfulness, answer correctness. Multi-provider judge LLM (Claude / OpenAI). Zero-config CLI.

Part of the `angel1-*` toolkit series.

Building a RAG system is easy. Knowing if it's any good is hard. `angel1-rag-eval` runs your RAG endpoint against a labeled eval-set and reports three numbers:

- **Retrieval precision** — did your retriever find the right documents?
- **Faithfulness** — is the generated answer supported by retrieved context?
- **Correctness** — does the answer match the expected ground truth?

Extracted from production work on multi-tenant RAG SaaS.

## Quickstart

```bash
npx @massiangelone/angel1-rag-eval --help
```

Or install globally:

```bash
npm install -g @massiangelone/angel1-rag-eval
angel1-rag-eval --help
```

### 1. Create your eval-set (JSONL)

```jsonl
{"id":"q1","question":"How do I reset SSO?","expected_source":"docs-sso-reset","expected_answer":"Settings → SSO → Reset"}
{"id":"q2","question":"Which webhook fires on downgrade?","expected_source":"docs-webhooks","expected_answer":"subscription.plan_changed with action=downgrade"}
```

### 2. Create config (JSON)

```json
{
  "endpoint": {
    "url": "http://localhost:3000/api/rag",
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "body": { "query": "{{question}}" },
    "responsePaths": {
      "answer": "answer",
      "sources": "sources[].id",
      "sourceContents": "sources[].content"
    }
  },
  "judge": {
    "provider": "claude",
    "model": "claude-sonnet-4-6"
  },
  "scoring": {
    "retrievalK": 5,
    "weights": {
      "retrieval": 0.4,
      "faithfulness": 0.3,
      "correctness": 0.3
    }
  }
}
```

### 3. Set your judge API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
```

### 4. Run

```bash
angel1-rag-eval run -c rag-eval.config.json -q eval-set.jsonl --threshold 0.7
```

Output: console table, CSV file, JSON file, exit code 0/1 based on threshold.

## Configuration reference

### `endpoint`

How `angel1-rag-eval` calls your RAG service.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | — | Your RAG endpoint URL |
| `method` | `GET` \| `POST` | `POST` | HTTP method |
| `headers` | object | — | Optional headers (auth, content-type) |
| `body` | object | — | Request body template. Use `{{question}}` and `{{id}}` as placeholders |
| `responsePaths.answer` | string | — | JSON path to the generated answer |
| `responsePaths.sources` | string | — | JSON path to retrieved source IDs (e.g. `sources[].id`) |
| `responsePaths.sourceContents` | string | optional | JSON path to retrieved source TEXT. **Required for accurate faithfulness scoring.** |
| `timeoutMs` | number | `30000` | Request timeout |

### Path syntax

- `a.b.c` — nested object access
- `a[].c` — array map: returns array of `c` from each element of `a`

### `judge`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | `claude` \| `openai` | `claude` | LLM judge provider |
| `model` | string | provider-aware | Specific model |

| Provider   | Default model       |
|------------|---------------------|
| `claude`   | claude-sonnet-4-6   |
| `openai`   | gpt-4o-mini         |

Required env vars: `ANTHROPIC_API_KEY` (claude) or `OPENAI_API_KEY` (openai).

### `scoring`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `retrievalK` | number | `5` | Top-K sources to consider for retrieval precision |
| `weights.retrieval` | number | `0.4` | Weight in overall score |
| `weights.faithfulness` | number | `0.3` | Weight in overall score |
| `weights.correctness` | number | `0.3` | Weight in overall score |

Weights must sum to 1.0.

## CLI flags

| Flag | Description |
|------|-------------|
| `-c, --config <path>` | Config file (default: `rag-eval.config.json`) |
| `-q, --questions <path>` | Eval-set JSONL (default: `eval-set.jsonl`) |
| `-j, --judge <provider>` | Override judge provider (`claude` \| `openai`) |
| `--no-judge` | Skip judge LLM, retrieval scoring only (no API costs) |
| `-o, --output <dir>` | Output directory (default: `./rag-eval-output`) |
| `--threshold <number>` | Min overall score to exit 0 (default: `0.7`) |
| `-v, --verbose` | Print judge rationale for each question after summary |

## Output

Three artifacts per run:

1. **Console** — colored table with per-question scores + summary
2. **CSV** — `rag-eval-output/eval-{timestamp}.csv` — for spreadsheet analysis
3. **JSON** — `rag-eval-output/eval-{timestamp}.json` — for programmatic use

Exit codes:

- `0` — passed (avg overall score ≥ threshold)
- `1` — failed (below threshold)
- `2` — config / eval-set validation error
- `3` — unexpected error

## CI integration

```yaml
# .github/workflows/rag-eval.yml
- name: Run RAG evaluation
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    npx @massiangelone/angel1-rag-eval run \
      --threshold 0.75
```

Fails the build if RAG quality regresses below threshold.

## Faithfulness scoring requires source text

For meaningful faithfulness scoring, your RAG endpoint must return the **text** of retrieved chunks, not just IDs. Configure `responsePaths.sourceContents` to point at the text in your response.

Without `sourceContents`, the judge cannot assess faithfulness — it will return `null` for that dimension, and the overall score weight will redistribute to retrieval and correctness.

## API stability

Stable in v1.x (won't change without major version bump):

- `run` command surface
- Flags: `--config`, `--questions`, `--judge`, `--no-judge`, `--threshold`, `--output`, `--verbose`
- Config shape: `endpoint`, `judge`, `scoring`
- Exit codes 0/1/2/3

Experimental (may evolve in v1.x minor):

- `responsePaths.sourceContents` (added in v0.1.0-alpha)

## Status

Stable (v1.0.0).

- **OpenAI judge**: tested end-to-end against the real API
- **Claude judge**: implemented and structurally validated; full end-to-end testing pending
- **Retrieval scoring**: tested with mock and real endpoints
- **CSV/JSON output**: tested

## License

MIT © Massimiliano Angelone

## Related

Part of the `angel1-*` series of open-source tools for AI-enhanced product development:

- **[angel1-mvp-toolkit](https://github.com/maxange-developer/angel1-mvp-toolkit)** — Scaffold production-ready Next.js + Supabase apps with multi-provider AI (Claude/OpenAI) in seconds. Pairs with this tool to evaluate the RAG endpoints scaffolded by the toolkit.
