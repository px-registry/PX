# Getting Started with PX

PX is proof infrastructure. It verifies structured evidence against declared rules and packages the result so someone else can check it.

PX runs entirely on your machine. No account required. No data leaves the machine.

## Requirements

- Node.js 18+
- git
- A terminal (bash, zsh, PowerShell, etc.)

## Try it

```bash
git clone https://github.com/px-registry/PX.git
cd PX

# Verify the sample AWS evidence
node cli.js verify --profile=profiles/aws-core-controls-v1.json --evidence=examples/aws-state-passing.json

# Package the result
node cli.js pack --profile=profiles/aws-core-controls-v1.json --evidence=examples/aws-state-passing.json
```

You should see 10/10 rules pass. A `draft-manifest.json` is generated. Open it in `lens.html` to see the verification badge (amber = internal draft).

## Try it with your own AWS state

1. Export your AWS configuration using the AWS CLI. See `aws-export-guide.md` for commands.
2. Assemble the results into a JSON file following the format in `examples/aws-state-passing.json`.
3. Run:

```bash
node cli.js verify --profile=profiles/aws-core-controls-v1.json --evidence=my-aws-state.json
```

The same 10 rules run against your data. Fix any failures, re-run, and pack when ready.

## What is not included

- PX does **not** connect to AWS. You export your state separately and PX verifies the exported JSON.
- No cloud SDK, no network calls, no credentials handling.
- Draft packets are for internal review. External submission (sealed timestamps, acceptance receipts) is not yet available.

## If you get stuck

- Open an issue: https://github.com/px-registry/PX/issues
- Email: hello@px-registry.org
