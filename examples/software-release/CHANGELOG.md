# Changelog

## v2.1.0 — 2026-03-22

### Added
- New /api/v2/health endpoint with detailed component status
- Rate limiting middleware (100 req/min per IP)

### Fixed
- Memory leak in WebSocket connection handler (#234)
- Incorrect timezone handling in audit logs (#228)

### Security
- Updated express to 4.18.2 (CVE-2024-XXXX)
- Updated lodash to 4.17.21 (prototype pollution fix)

### Changed
- Minimum Node.js version: 18.x → 20.x
- Default log level: info → warn

## v2.0.0 — 2026-02-15

- Major API redesign
- Breaking: removed /api/v1/* endpoints
