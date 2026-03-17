# PX Draft Packet

**Packet ID:** draft-20260317-3719
**Created:** 2026-03-17T02:36:33.719Z
**Project:** px-genesis
**Framework:** PX_SELF_VERIFICATION

## What's in this packet

| File | Purpose |
|------|---------|
| draft-packet.json | The evidence pack. Contains references and hashes for all verified evidence. |
| draft-manifest.json | The manifest. This is what Lens reads. Contains the verification summary. |
| README.md | This file. |

## Status

**Verification:** ALL PASS (5 evidence files, 30 fields checked)
**Submission:** NOT SUBMITTED

## What this packet can do

- Be reviewed internally by your team
- Be loaded into Lens (open draft-manifest.json)
- Be shared with colleagues for pre-submission review
- Be re-verified at any time with `px verify`

## What this packet cannot do

This is a Draft Packet. It is verified locally, but it is not externally acceptable.

External acceptance requires a **Submission**, which adds:

- **Submission ID** — a unique, immutable identifier from PX Authority
- **Sealed timestamp (SCT)** — cryptographic proof this packet existed at a specific time
- **Acceptance receipt** — proof the submission was received and recorded
- **Recipient binding** — specifies who this submission is directed to

These fields are present in the manifest as `null`. When a Submission is created,
they are populated by PX Authority using the production root key.

**Submission is not yet available.** It requires PX production authority (in progress).
Draft is fully functional for internal use today.

---

*PX makes proof you can hand off.*
*Draft is where your team standardizes how it explains itself.*
*Submission is where that explanation becomes externally acceptable.*
