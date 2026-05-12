# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-12

### Changed (Breaking)

- **Package renamed** from `@massiangelone/rag-eval` to `@massiangelone/angel1-rag-eval`.
  The old package is deprecated with a redirect message.
- **Binary renamed** from `rag-eval` to `angel1-rag-eval`. Global installs using
  the old name no longer have a working binary; reinstall the new package.

### Added

- `--verbose` / `-v` flag: prints judge rationale per question after summary
- End-to-end smoke test in CI that builds, packs, installs the CLI globally,
  and runs it against the bundled mock RAG endpoint on every push
- First stable release. CLI surface (`run` command + flags) and config shape
  are now stable for v1.x.

### Migration

See README.md "Migration from `@massiangelone/rag-eval`" section.

---

## [0.1.0-alpha.0] — 2026-05-12

### Added

- Initial release as `@massiangelone/rag-eval`
- `run` command with retrieval, faithfulness, correctness scoring
- Multi-provider judge LLM: Claude (Anthropic SDK) and OpenAI
- Source content support via `responsePaths.sourceContents` for meaningful
  faithfulness scoring
- CSV + JSON output formats
- Console table with colored output and exit codes
- Mock server for offline testing
- 5 realistic B2B SaaS example questions
