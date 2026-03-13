# DB Migrations

This folder keeps active SQL migration files used for schema/history reference.

## Structure

- `active/phase*.sql`: main chronological migrations
- `archive/`: historical or superseded scripts (kept for audit/recovery only)

## Active Set

Current phase scripts live under `active/` and keep the original filename ordering (`phase00...`, `phase10...`, ...).

## Note

Files in `archive/` are not part of active migration flow and should not be applied on new environments unless explicitly required for incident recovery.
