# PX — Proof You Can Hand Off

PX packages evidence into a verifiable envelope that anyone can check by opening a single HTML file. No install. No login. Offline. Five seconds.

**[Live Demo →](https://px-registry.org/demo/lens.html)** — See a SOC 2 verification report in your browser.

## What PX Does

1. **Collect** evidence from your systems (AWS, GitHub, or any JSON)
2. **Verify** it against declared rules — deterministically, locally
3. **Pack** it into a Draft Packet with SHA-256 integrity
4. **Hand off** — the recipient opens Lens in any browser and sees the result

Zero dependencies. Nothing leaves your machine until you decide to share.

## Quick Start

```bash
git clone https://github.com/px-registry/PX.git
cd PX

# Try the demo (SOC 2 sample with one deliberate failure)
node cli.js init --demo
node cli.js generate
node cli.js verify        # ← patch-management will FAIL
# Fix the evidence, re-verify, then:
node cli.js pack
```

Open `px/output/draft-manifest.json` in [`lens.html`](lens.html) to see your verification badge.

## Commands

| Command | What it does |
|---------|-------------|
| `px init --demo` | Create a SOC 2 demo workspace |
| `px init --genesis` | Verify PX's own governance files |
| `px generate` | Generate evidence from system state |
| `px verify` | Check evidence against profiles |
| `px pack` | Bundle into a Draft Packet (fail-close) |
| `px check --profile=<file>` | Collect + verify in one step |
| `px answer-pack --profile=<file> --evidence=<file>` | Generate questionnaire-ready outputs |
| `px status` | Show workspace state |

## Custom Profiles

Verify any evidence against any rules:

```bash
# Verify
node cli.js verify --profile=profiles/aws-core-controls-v1.json --evidence=your-state.json

# Pack (all checks must pass)
node cli.js pack --profile=profiles/aws-core-controls-v1.json --evidence=your-state.json

# With recipient metadata
node cli.js pack --profile=profiles/aws-core-controls-v1.json \
  --evidence=your-state.json \
  --recipient=auditor@example.com \
  --purpose="Q1 compliance review"
```

### Included Profiles

| Profile | Rules | Domain |
|---------|-------|--------|
| `aws-core-controls-v1` | 10 | IAM, RDS, S3, CloudTrail, VPC |
| `github-org-security-v1` | 10 | Org settings, branch protection, secret scanning |

## Recipient Replay

Recipients re-run verification with zero setup:

```bash
node cli.js verify --manifest=draft-manifest.json
```

Send `draft-manifest.json`, `bundled-profile.json`, and `bundled-evidence.json`. Replay confirms the result matches the claim.

## Lens

Lens is a self-contained HTML verification viewer. Drop a manifest JSON onto it — verification runs in your browser. No server. No network. Works on a USB drive.

Three views: **Summary** → **Controls** (each rule, pass/fail) → **Replay** (execution trace + CLI command).

## Draft vs Submission

Every packet starts as a **Draft** (amber in Lens). Four null fields mark the boundary:

```json
"submission_id": null,
"sct": null,
"acceptance_receipt": null,
"recipient_binding": null
```

When PX Authority is established, these fields get populated. Same packet becomes a Submission. Lens turns green.

**Draft is fully functional today.**

## Genesis

This repo contains PX's first Draft Packet — PX verifying its own governance files against its own rules. No mocks. Real files, real hashes.

```bash
node cli.js init --genesis
node cli.js generate
node cli.js verify
node cli.js pack
```

## Technical

- ~2,680 lines of vanilla Node.js
- Zero external dependencies (`fs`, `path`, `crypto` only)
- SHA-256 for integrity, Ed25519 signing planned
- Lens: single HTML file, zero network calls

## What PX Is Not

PX does not decide fault, determine damages, or interpret contracts. It proves that evidence existed, was not altered, and conforms to declared rules. Interpretation is for the reviewer.

## License

MIT
