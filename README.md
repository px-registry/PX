# PX — Recipient-Verifiable Handoff Envelope

PX wraps any evidence in a cryptographic envelope that receivers can verify by opening a single HTML file. No install. No login. Offline. Five seconds.

## What PX is

- **Envelope, not a platform.** PX doesn't define what's inside. It signs the contents and generates Lens for verification.
- **Zero dependencies.** SHA-256 + Ed25519. Nothing else.
- **Receiver cost is zero.** Open lens.html in any browser. Done.

## Status

CLI works today. npm publish coming soon.

## Quick Start: Verify AWS Controls

```bash
# Clone the repo
git clone https://github.com/px-registry/PX.git
cd PX

# Run verification against the sample passing evidence
node cli.js verify --profile=profiles/aws-core-controls-v1.json --evidence=examples/aws-state-passing.json

# See what failure looks like
node cli.js verify --profile=profiles/aws-core-controls-v1.json --evidence=examples/aws-state-failing.json

# If all pass, package the result
node cli.js pack --profile=profiles/aws-core-controls-v1.json --evidence=examples/aws-state-passing.json
```

Replace `examples/aws-state-passing.json` with your own AWS state. See `docs/aws-export-guide.md` for how to export.

### Or verify GitHub org security:

```bash
node cli.js verify --profile=profiles/github-org-security-v1.json --evidence=examples/github-state-passing.json
```

See `docs/github-export-guide.md` for how to export your GitHub settings.

## One-Command Verification

If you already have the source CLI installed, PX can collect and verify in one step.

```bash
# AWS
node cli.js check --profile=profiles/aws-core-controls-v1.json

# GitHub
node cli.js check --profile=profiles/github-org-security-v1.json -- myorg myrepo
```

Evidence is saved to `.px/evidence/` so you can reuse it with `pack`.

**No collector available?** No problem. Use:

```bash
node cli.js verify --profile=<profile-file> --evidence=<your-exported-json>
```

PX still works with manual exported JSON. `source_type` is optional and only used by `check`. `verify` and `pack` ignore it.

## Genesis Draft

This repository contains PX's first Draft Packet.
It verifies PX's own governance files against PX's own structural rules.

No mocks. Real files, real hashes, real verification.

### Inspect

Open `genesis/draft-manifest.json` in `lens.html`. Lens runs offline in your browser.

It will show **amber** (internal only). All checks pass, but the proof has not been submitted externally.

### Reproduce

Note: The `genesis/` directory contains our committed reference output. When you run the CLI locally, your reproduced output will be generated in `./px/output/`.

```
git clone https://github.com/px-registry/PX
cd PX

node cli.js init --genesis
node cli.js generate
node cli.js verify
node cli.js pack
```

Your output in `./px/output/` should match the reference in `genesis/`. The packet hashes will differ (timestamps change), but the evidence hashes will be identical because the source files are the same.

### What was verified

PX reads its own `/v1/` governance files and checks:

- Does the file exist?
- Is it valid JSON?
- Is it non-empty?
- Does it have a version key?
- What is its SHA-256 hash?

Five files. Five profiles. Six rules each. Thirty checks. All deterministic.

### Verify the hashes yourself

```
sha256sum v1/governance-vocabulary.json
sha256sum v1/verification-basis-registry.json
sha256sum v1/evidence-profile-registry.json
sha256sum v1/root-ops-policy.json
sha256sum v1/delegation-policy.json
```

Compare with the `artifact_hash` values in each `genesis/draft-packet.json` evidence ref, or in the reproduced `./px/evidence/*.evidence.json` files. They match.

## Draft vs Submission

**Draft.** Internally verified, not submitted externally.

The manifest contains four `null` fields:

```json
"submission_id":       null,
"sct":                 null,
"acceptance_receipt":  null,
"recipient_binding":   null
```

These are the boundary between Draft and Submission.

- `submission_id` — unique identifier from PX Authority
- `sct` — sealed timestamp proving when this packet existed
- `acceptance_receipt` — proof the submission was received
- `recipient_binding` — who the submission is directed to

When PX Authority is established, these fields will be populated. The same packet becomes a Submission. Lens turns green.

**PX Authority is in progress. Draft is fully functional today.**

## Custom Evidence Profiles

PX can verify any structured evidence against any declared rules. No workspace setup required.

### Verify

```bash
node cli.js verify --profile=profiles/aws-core-controls-v1.json --evidence=your-aws-state.json
```

### Pack

If all checks pass, package the result:

```bash
node cli.js pack --profile=profiles/aws-core-controls-v1.json --evidence=your-aws-state.json
```

This generates `draft-manifest.json` and `draft-packet.json` alongside the evidence file. Open the manifest in `lens.html` to see your verification badge.

If any rule fails, packing is blocked (fail-close). Fix the evidence and re-run.

### Available profiles

| Profile | Rules | Domain |
|---------|-------|--------|
| `profiles/aws-core-controls-v1.json` | 10 | IAM, RDS, S3, CloudTrail, VPC |
| `profiles/github-org-security-v1.json` | 10 | Org settings, branch protection, secret scanning, Dependabot |

### Examples

Each profile ships with passing and failing sample evidence:

| File | Purpose |
|------|---------|
| `examples/aws-state-passing.json` | Passes all 10 AWS rules |
| `examples/aws-state-failing.json` | Fails 2 AWS rules (MFA disabled, weak password policy) |
| `examples/github-state-passing.json` | Passes all 10 GitHub rules |
| `examples/github-state-failing.json` | Fails 2 GitHub rules (2FA not required, default permissions too broad) |

Create your own evidence file by exporting your state. See `docs/aws-export-guide.md` or `docs/github-export-guide.md` for instructions.

### Write your own profile

A profile is a JSON file with a `rules` array. Each rule has:

- `id` — unique rule identifier
- `description` — human-readable explanation
- `path` — dot-notation path into the evidence JSON (e.g. `iam.password_policy.minimum_length`)
- `expected` — the value to check against
- `operator` — `eq` (default), `gte`, or `lte`

## Recipient Replay

When you pack, you can declare who the proof is for and why:

```bash
node cli.js pack --profile=profiles/aws-core-controls-v1.json \
  --evidence=your-aws-state.json \
  --recipient=auditor@example.com \
  --purpose="Q1 compliance review"
```

The manifest records the recipient and purpose. The exact profile and evidence used are bundled as `bundled-profile.json` and `bundled-evidence.json` alongside the manifest in `px/output/`.

### Replay verification

The recipient can re-run verification against the bundled inputs:

```bash
node cli.js verify --manifest=px/output/draft-manifest.json
```

This replays every rule against the bundled evidence and confirms the result matches the manifest's claim. Works for both Genesis workspace packs and custom profile packs.

### Replay with npx

The recipient does not need to clone the repo. If PX is published to npm:

```bash
npx px verify --manifest=./draft-manifest.json
```

Send the recipient `draft-manifest.json`, `bundled-profile.json`, and `bundled-evidence.json`. As long as these three files are in the same directory, replay works.

## Verification Report

When you pack with a custom profile, PX generates a self-contained `lens.html`.

Open it in any browser — the verification re-executes automatically.

Three views:
- **Summary** — what was verified, for whom, result
- **Controls** — each rule checked, pass/fail
- **Replay** — step-by-step execution trace + CLI command

Click "Export PDF" for a print-ready report. No CLI needed. No network needed.

Each pack also gets a Verification Seal (e.g., `PX-A3F2-2026Q2-PASS-10`) — a short reference code for emails, tickets, and audit trails.

## Answer Pack

`answer-pack` generates questionnaire-ready outputs. Unlike `pack` (fail-close, all-pass only), `answer-pack` works with mixed results — PASS and FAIL.

```bash
node cli.js answer-pack --profile=profiles/aws-core-controls-v1.json \
  --evidence=your-aws-state.json \
  --recipient="Security Review" --purpose="Q2 vendor assessment"
```

Output:
- `answers.csv` — one row per framework question (CAIQ/SIG), Excel-ready with UTF-8 BOM
- `question-map.csv` — rule-to-framework mapping table with custom keywords for lookup
- `answers.md` — human-readable answer templates with slice refs
- `exceptions.md` — FAIL rules with compensating control placeholders (only if any fail)
- `summary.txt` — plain text verification summary
- `lens.html` — browser verification report (mixed results supported)

Each answer row includes a slice ref (e.g., `PX-A3F2-2026Q2-PASS-10#iam.mfa_enforced`) linking directly to `lens.html#iam.mfa_enforced`.

## Try the demo

To see PX verify sample SOC 2 evidence instead:

```
node cli.js init --demo
node cli.js generate
node cli.js verify
node cli.js pack
```

This creates a workspace with four SOC 2 profiles (access control, encryption, patch management, monitoring) and sample evidence. One deliberate failure is included so you can experience the fix-and-re-verify loop.

## What PX is not

PX does not decide who is at fault. It does not determine damages. It does not interpret contracts. It does not replace human judgment.

PX proves that evidence existed, was not altered, and conforms to rules. What that evidence means is for the reviewer to decide.

## Technical

- ~2680 lines of vanilla Node.js
- Zero external dependencies (`fs`, `path`, `crypto` only)
- SHA-256 for hashing, Ed25519 for signing (when Authority is live)
- No proprietary crypto, no blockchain
- Lens is a single HTML file, no network calls, runs on a USB drive

## License

MIT
