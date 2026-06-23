# Archived migrations (pre-baseline)

These 4 migrations were an **incomplete baseline**: together they only created 8 of
the 33 tables and assumed the rest (`Workshop`, `User`, `Customer`, `Vehicle`, …)
already existed from `prisma db push`. `prisma migrate deploy` against an empty
database would fail on the very first `ALTER TABLE "ServiceOrder" …`.

They were replaced by a single squashed baseline at `prisma/migrations/0_init/`,
generated with:

```bash
prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  > prisma/migrations/0_init/migration.sql
```

`0_init` is verified to replay cleanly from an empty DB and to match `schema.prisma`
exactly. These files are kept here only for historical reference — they are **not**
in `prisma/migrations/`, so Prisma never runs them. See `DB.md`.
