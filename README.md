# @massiangelone/rag-eval

[![npm](https://img.shields.io/npm/v/@massiangelone/rag-eval.svg)](https://www.npmjs.com/package/@massiangelone/rag-eval)
[![CI](https://github.com/maxange-developer/rag-eval-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/maxange-developer/rag-eval-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Evaluate RAG pipelines: retrieval precision, faithfulness, answer correctness. Zero-config CLI.

Building a RAG system is easy. Knowing if it's any good is hard. `rag-eval` runs your RAG endpoint against a labeled eval-set and reports three numbers:

- **Retrieval precision** — did your retriever find the right documents?
- **Faithfulness** — is the generated answer supported by retrieved context?
- **Correctness** — does the answer match the expected ground truth?

Extracted from production work on multi-tenant RAG SaaS. Built provider-agnostic: judge with Claude or OpenAI.

> **Status: alpha (v0.1.0).** Config shape may change before v1.0. CLI command surface is stable.

## Install

```bash
npx @massiangelone/rag-eval --help
```

Or globally:

```bash
npm install -g @massiangelone/rag-eval
rag-eval --help
```

## Quickstart

### 1. Create your eval-set (JSONL)

Each line is one question with expected source ID and optional expected answer.

```jsonl
{"id":"q1","question":"How do I reset SSO?","expected_source":"docs-sso-reset","expected_answer":"Settings → SSO → Reset"}
{"id":"q2","question":"Which webhook fires on downgrade?","expected_source":"docs-webhooks","expected_answer":"subscription.plan_changed with action=downgrade"}
```

See [`examples/eval-set.example.jsonl`](examples/eval-set.example.jsonl) for a full B2B SaaS example.

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

See [`examples/rag-eval.config.json`](examples/rag-eval.config.json) for the full reference config.

### 3. Set your judge API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
```

### 4. Run

```bash
rag-eval run -c rag-eval.config.json -q eval-set.jsonl --threshold 0.7
```

Output: colored console table, CSV file, JSON file, exit code 0/1 based on threshold.

## Configuration reference

### `endpoint`

How `rag-eval` calls your RAG service.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | — | Your RAG endpoint URL |
| `method` | `GET` \| `POST` | `POST` | HTTP method |
| `headers` | object | — | Optional headers (auth, content-type) |
| `body` | object | — | Request body template. Use `{{question}}` and `{{id}}` as placeholders |
| `responsePaths.answer` | string | — | JSON path to the generated answer |
| `responsePaths.sources` | string | — | JSON path to retrieved source IDs (e.g. `sources[].id`) |
| `responsePaths.sourceContents` | string | optional | JSON path to retrieved source **text**. Required for accurate faithfulness scoring. |
| `timeoutMs` | number | `30000` | Request timeout in ms |

### Path syntax

- `a.b.c` — nested object access
- `a[].c` — array map: returns `c` from each element of `a`

### `judge`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | `claude` \| `openai` | `claude` | LLM judge provider |
| `model` | string | provider-aware | Specific model. Defaults: `claude-sonnet-4-6` or `gpt-4o-mini` |

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
| `--no-judge` | Skip judge LLM — retrieval scoring only, no API costs |
| `-o, --output <dir>` | Output directory (default: `./rag-eval-output`) |
| `--threshold <number>` | Min overall score to exit 0 (default: `0.7`) |

## Output

Three artifacts per run:

1. **Console** — colored table with per-question scores + summary
2. **CSV** — `rag-eval-output/eval-{timestamp}.csv` — for spreadsheet analysis
3. **JSON** — `rag-eval-output/eval-{timestamp}.json` — for programmatic use

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | Passed — avg overall score ≥ threshold |
| `1` | Failed — below threshold |
| `2` | Config / eval-set validation error |
| `3` | Unexpected error |

## CI integration

```yaml
# .github/workflows/rag-eval.yml
- name: Run RAG evaluation
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    npx @massiangelone/rag-eval run \
      -c rag-eval.config.json \
      -q eval-set.jsonl \
      --threshold 0.75
```

Fails the build if RAG quality regresses below threshold.

## Faithfulness scoring requires source text

For meaningful faithfulness scoring, your RAG endpoint must return the **text** of retrieved chunks, not just IDs. Configure `responsePaths.sourceContents` to point at the chunk text in your response.

Without `sourceContents`, the judge detects that context items are opaque IDs and returns `null` for faithfulness. The overall score weight re-normalizes across retrieval and correctness only — no artificial penalty.

## Test the CLI locally

A mock RAG server and example eval-set are included:

```bash
node examples/mock-server.mjs &
rag-eval run \
  -c examples/rag-eval.config.json \
  -q examples/eval-set.example.jsonl \
  --judge openai \
  --threshold 0.7
```

## Status

- **OpenAI judge**: tested end-to-end against the real API
- **Claude judge**: implemented and structurally validated; full end-to-end testing pending Anthropic API credit
- **Retrieval scoring**: tested with mock and real endpoints
- **CSV/JSON output**: tested

## License

MIT © Massimiliano Angelone
