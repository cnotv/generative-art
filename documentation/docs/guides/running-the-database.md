---
sidebar_position: 31
---

# Running the database

Local Postgres 17 and PgBouncer run from `docker-compose.yml`. The credentials are throwaway
development defaults; override them with `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`
in the shell or an `.env` file. Both ports are bound to `127.0.0.1` only.

:::note Source files
`docker-compose.yml`, `package.json` (the `db:*` scripts) and
`packages/multiplayer-server/migrations/`.
:::

## Start and stop

| Command           | Effect                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `pnpm db:up`      | Start Postgres and PgBouncer, and wait until Postgres is healthy     |
| `pnpm db:down`    | Stop both, keeping the data in the `postgres-data` volume             |
| `pnpm db:reset`   | Delete the volume and start empty. All local data is lost             |
| `pnpm db:psql`    | Open `psql` inside the Postgres container, connected directly         |
| `pnpm db:migrate` | Apply pending migrations with `node-pg-migrate`; needs `DATABASE_URL` |

## Direct or through PgBouncer

| Port | Goes to   | Use it for                                                               |
| ---- | --------- | ------------------------------------------------------------------------ |
| 5432 | Postgres  | Migrations, `psql` sessions, anything holding session state              |
| 6432 | PgBouncer | The application, so many clients share a small set of server connections |

PgBouncer runs in transaction pooling mode: a server connection is lent out for one transaction
only. Session state does not survive between transactions, so `SET`, advisory locks, `LISTEN`
and session-level prepared statements belong on the direct port.

Connect from the host with the same credentials on either port, for example
`psql -h 127.0.0.1 -p 6432 -U dev_user generative_art_dev`. Run migrations against the direct
port by setting `DATABASE_URL` to a `postgres://` URL on 5432.

## What is running right now

`pg_stat_activity` lists every connection and what it is doing. Through PgBouncer the number of
rows stays near the pool size however many clients are connected.

```sql
SELECT pid, state, wait_event_type, now() - query_start AS running_for, left(query, 80) AS query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start;
```

## What was slow

`pg_stat_statements` is preloaded, and the `000_extensions.sql` migration creates the extension
in the database, so run `pnpm db:migrate` once after a reset.

```sql
SELECT calls, round(mean_exec_time::numeric, 2) AS mean_ms, left(query, 80) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

Statements slower than 200 ms are also written to the Postgres log with their plan, through
`log_min_duration_statement` and `auto_explain`. Read them with
`docker compose logs postgres`.
