# PX

PX makes proof you can hand off.

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
git clone https://github.com/anthropics/px
cd px

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

## Status

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

## Try the demo

To see PX verify sample SOC 2 evidence instead:

```
node cli.js init --demo
node cli.js generate
node cli.js verify
node cli.js pack
```

This creates a workspace with four SOC 2 profiles (access control, encryption, patch management, monitoring) and sample evidence. One deliberate failure is included so you can experience the fix-and-re-verify loop.

## What PX is

PX generates machine-verifiable evidence from your systems, verifies it against deterministic rules, and packages it so someone else can check it.

- **Draft** is free, unlimited, and works entirely offline
- **Submission** adds a sealed timestamp, acceptance receipt, and recipient binding
- **Lens** reads the manifest and shows the state — amber or green

## What PX is not

PX does not decide who is at fault. It does not determine damages. It does not interpret contracts. It does not replace human judgment.

PX proves that evidence existed, was not altered, and conforms to rules. What that evidence means is for the reviewer to decide.

## Technical

- 1355 lines of vanilla Node.js
- Zero external dependencies (`fs`, `path`, `crypto` only)
- SHA-256 for hashing, Ed25519 for signing (when Authority is live)
- No proprietary crypto, no blockchain
- Lens is a single HTML file, no network calls, runs on a USB drive

## License

MIT
