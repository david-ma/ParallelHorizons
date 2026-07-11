# Testing

## Philosophy

- **`bun test`** runs unit **and** integration tests.
- Integration tests **fail loudly** if MariaDB, migrations, or MailCatcher are missing — they do not pass silently.
- Use **`SKIP_*=1`** only when you intentionally want to skip a suite (e.g. CI without services).

## Commands (you run these)

### Unit only (no Docker, no MailCatcher)

```bash
bun run test:unit
# or
SKIP_DATABASE_TESTS=1 SKIP_MAILCATCHER_TESTS=1 bun test
```

### Full local suite

```bash
# 1. Database
docker compose up -d
bun run db:migrate          # apply drizzle/ migrations (not push)
bun run db:seed             # test users: user@gallery.test / admin@gallery.test

# 2. Mail (password-reset integration)
mailcatcher                 # SMTP :1025, web UI :1080

# 3. Run everything
bun test
```

### After schema changes

```bash
bun run db:generate -- --name=<label>   # e.g. --name=add_photos
bun run db:migrate
```

## Skip flags

| Variable | When set to `1` |
|----------|-----------------|
| `SKIP_DATABASE_TESTS` | Skips `tests/integration/database-auth.test.ts` |
| `SKIP_MAILCATCHER_TESTS` | Skips `tests/integration/mailcatcher.test.ts` |

Default (unset): suites **run** and **fail** if prerequisites are missing.

## CI

GitHub Actions runs **`bun run test:unit`** only, with skip flags documented for future integration jobs.

## Test users (seed script)

| Email | Password | Role |
|-------|----------|------|
| `user@gallery.test` | `test-password` | user |
| `admin@gallery.test` | `test-password` | admin |

```bash
bun run db:seed
```

## Manual smoke (after migrate)

1. `cd /usr/local/dev/Thalia && bun run bin/develop.ts gallery`
2. `/setup` → first admin (empty DB only)
3. `/newUser` or seed accounts → `/dashboard` → create gallery → publish → `/view/:slug`
