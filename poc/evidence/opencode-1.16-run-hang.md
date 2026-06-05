# OpenCode 1.16.0 `run` Mode Hang

**Date**: 2026-06-05
**OpenCode Version**: 1.16.0 (brew install anomalyco/tap/opencode)
**Platform**: macOS (darwin 25.5.0), Apple Silicon

## Issue

`opencode run --format json "Say hello"` hangs indefinitely after VCS initialization. No API calls are made. This happens with or without provider configuration, with or without `--pure`, and with or without `--log-level DEBUG`.

## Reproduction

```bash
mkdir /tmp/oc-test && cd /tmp/oc-test
git init && echo "test" > README.md && git add . && git commit -m "init"

# Hangs after "service=vcs branch=master default_branch=master initialized"
opencode run --format json --print-logs "Say hello"
```

## Debug Log (complete)

```
INFO  service=default version=1.16.0 args=["run","--format","json","--print-logs","Say hello"]
INFO  service=default directory=/private/tmp/oc-test creating instance
INFO  service=project directory=/private/tmp/oc-test fromDirectory
INFO  service=default directory=/private/tmp/oc-test bootstrapping
INFO  service=config path=...config.json loading
INFO  service=plugin name=... loading internal plugin (x9)
INFO  service=lsp all LSPs are disabled
INFO  service=format all formatters are disabled
INFO  service=format init
INFO  service=vcs branch=master default_branch=master initialized
<HANGS HERE INDEFINITELY>
```

## What Was Tried

1. Fresh git repo, no opencode.json -- **HANGS**
2. Git repo with vLLM provider config -- **HANGS**
3. `--pure` flag (no external plugins) -- **HANGS**
4. `--log-level DEBUG` -- **HANGS** (no additional output)
5. Deleted `~/.local/share/opencode/opencode.db*` (WAL files) -- **HANGS**
6. npm version (`opencode-ai@latest`) -- same 1.16.0, **HANGS**

## Impact

This blocks using the eval-harness OpenCode runner (PR #90). The runner invokes `opencode run --format json`, which is the exact command that hangs.

## Next Steps

- Flag with Rob Bell (per his instructions: "ping me if you hit problems")
- Check if PR #90 was tested with an older OpenCode version
- Consider using `opencode serve` + API mode as a workaround
- As a fallback, the eval-harness `cli` runner can invoke vLLM directly (bypassing OpenCode)
