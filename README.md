# PX

Portable release packs for software you hand off.

Bundle binary, SBOM, provenance, and signature into one verifiable pack.
Recipients open one HTML file to verify — offline, no install, no account.

[Lens Demo (PASS)](https://px-registry.org/demo/lens-v2-pass.html) ·
[Lens Demo (FAIL)](https://px-registry.org/demo/lens-v2-fail.html) ·
[Website](https://px-registry.org) ·
[Cloud PX](https://px-registry.org/cloud/)

## Quick start

```sh
npx px-pack init --demo
```

One command. Creates a demo workspace, generates demo evidence, verifies it,
builds a draft pack, and opens the path to Lens for offline review.

## With your own files

```sh
npx px-pack pack --profile=software-release-v1 --evidence=./dist/ --sign
```

## What's in a pack

```
px/output/
  draft-manifest.json      4KB — hashes, rules, Ed25519 signature
  lens-v2.html             Offline review UI (zero dependencies)
  bundled-evidence.json    All artifacts bundled
  bundled-profile.json     Profile rules used
```

```json
// package.json — Yes, really.
"dependencies": {}
```

## Current Limitations

- **Lens is a review surface, not a verification engine.** It displays the manifest's recorded results.
- **File-based, not OCI-native.** PX works with files on disk, not container registries.
- **SBOM format check only.** PX verifies SBOM presence and format, not contents.
- **Ephemeral keys by default.** `--sign` generates a one-time key pair unless `--key` is specified.

## What PX is NOT

- Not a replacement for Sigstore (PX consumes Sigstore output)
- Not a SaaS (zero network, zero account, zero upload)
- Not a container tool (files on disk, any ecosystem)

## GitHub Action

```yaml
- uses: ./.github/actions/px-pack
  with:
    evidence-path: ./dist
    profile: software-release-v1
```

Self-test CI: Full release → **PASS** (7/7) · Minimal (binary + SBOM) → **WARN** (5/7 + 2)

## Profiles

| Profile | Required | Recommended |
|---------|----------|-------------|
| `software-release-v1` | binary, SBOM | provenance, signature |

## Commands

| Command | Description |
|---------|-------------|
| `px init --demo` | One-command demo (workspace + evidence + verify + pack + Lens) |
| `px generate` | Generate evidence from system state |
| `px verify` | Verify evidence against profiles |
| `px pack` | Create a Draft Packet |
| `px pack --sign --evidence=./dist/` | Create a signed pack |
| `px pack --sign --key=path/to/key` | Sign with existing key |
| `px verify --manifest=draft-manifest.json` | Verify a pack (hashes + signature) |
| `px check --profile=<file>` | Collect + verify in one step |

## Statement

PX v1 release artifacts are packed with PX.

## Technical

- ~2,800 lines of vanilla Node.js
- Zero external dependencies (`fs`, `path`, `crypto` only)
- SHA-256 hash integrity + Ed25519 manifest signature
- Lens: single HTML file, zero network calls, works on a USB drive

## License

MIT
