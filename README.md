# PX

Hand off files. Know they arrived.

---

PX creates **.pack** files — portable, verified, self-contained.

A pack carries your files, your notes, your structure, and a manifest
that proves nothing was changed. Your recipient opens it in a browser.
Everything is clear.

No account. No server. No install.

---

## How it works

**Create** — Drop files into PX. Add a note. Group by purpose.

**Send** — Share the .pack however you like. Email, Slack, link.

**Verify** — Your recipient opens the pack. Every file is checked
against its SHA-256 hash. PASS means everything arrived intact.

---

## What's in a .pack

```
pack.json              manifest — metadata, hashes, pack_id
index/files.jsonl      file index with per-file SHA-256
payload/               your files
```

---

## Verification rules

A pack **passes** when:

1. `pack.json` exists and parses
2. `pack_id` matches SHA-256 of canonical manifest
3. Every file in the index exists in payload
4. Every file's SHA-256 matches
5. No extra files in payload

A pack **fails** when any check fails. No partial pass.

---

## PX is free.

Create packs. Open packs. Verify packs.
Notes, structure, and integrity — in one handoff unit.

Free during early access. No limits. No trial.

---

## Project

**PX Registry KK** — Tokyo

- Web: [px-registry.org](https://px-registry.org)
- Email: hello@px-registry.org
