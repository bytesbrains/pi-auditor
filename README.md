# Doctor for Pi

[![npm version](https://img.shields.io/npm/v/pi-auditor)](https://www.npmjs.com/package/pi-auditor)
[![license](https://img.shields.io/npm/l/pi-auditor)](./LICENSE)

> Audit repositories for RAG digestibility — find oversized "god files" that fragment poorly in vector indexes, get split suggestions, and track file size distribution.

## Install

```bash
pi install npm:pi-auditor
```

Or add to your `.pi/settings.json`:

```json
{
  "packages": ["npm:pi-auditor"]
}
```

## Commands

| Command | What it does |
|---|---|
| `/doctor:audit` | Full digestibility report with size distribution, god files, and assessment |
| `/doctor:god-files [--threshold N]` | List files exceeding the LOC threshold with split suggestions |
| `/doctor:rules [init\|show\|set <key> <value>]` | Manage `.doctorrc.yml` configuration |

## Tools (LLM-callable)

| Tool | What it does |
|---|---|
| `doctor_audit` | Run full audit, returns structured JSON report |
| `doctor_check_file <path>` | Audit a single file for RAG compatibility |

## Configuration

Doctor reads `.doctorrc.yml` from the working directory (falls back to sensible defaults):

```yaml
files:
  maxLines: 200          # warn above this LOC
  criticalLines: 500     # error above this LOC
  ignore:
    - "*generated*"
    - "*.d.ts"
    - "migrations/*.sql"
    - "test-data/*.json"
```

Created automatically on first run, or via `/doctor:rules init`.

## Example

```
You: /doctor:audit

📊 Digestibility Report  —  ✓ GOOD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Files analyzed:          87
  Total LOC:               12,430
  Total functions:         312
  Total exports:           246

  RAG-friendly (≤200 LOC):  85 (97.7%)  ✓
  Warning (201–500 LOC):      2 (2.3%)   ⚠
  Critical (>500 LOC):        0 (0%)     ✗

📈 File Size Distribution
  0–50       ██████████████████████████ 52 (60%)
  51–100     ███████ 15 (17%)
  101–200    ██████ 13 (15%)
  201–500    █ 2 (2%)

🩺 Assessment: 0 critical files. 2 files exceed the 200-LOC limit.
   → Run /doctor:god-files for detailed split suggestions.
```

## License

MIT © [nandal](https://github.com/nandal)
