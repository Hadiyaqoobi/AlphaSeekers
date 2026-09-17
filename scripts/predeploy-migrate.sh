#!/bin/sh
# Apply database migrations before a new release takes traffic.
#
# Wired to Render's preDeployCommand: it runs after the build and BEFORE the new
# instance serves anyone. If it exits non-zero Render aborts the deploy and
# keeps the old version running — which is the point. Shipping code that expects
# a column the database does not have is how you break a live site.
#
# ── Why this needs its own connection string ────────────────────────────────
# `prisma migrate deploy` takes a Postgres advisory lock, and that lock cannot
# be held through PgBouncer: the pooler hands out a different server session per
# statement, so the lock is either unobtainable or — worse — left behind on a
# pooled session that outlives the process. We hit exactly that: a migration run
# over the pooled URL failed and stranded its lock, and the next attempt timed
# out until the holding session was terminated by hand.
#
# So the app keeps the POOLED url (DATABASE_URL, which it needs for connection
# churn) and migrations use the DIRECT one (DIRECT_DATABASE_URL, no `-pooler`).
#
# ── Why success is asserted, not just assumed ──────────────────────────────
# The exit code alone is a thin signal. `prisma migrate deploy` returns 0 in
# more situations than "everything is applied" — notably it will CREATE a
# missing database and migrate it from scratch, which is correct behaviour but
# means a typo in the connection string can succeed loudly against a brand new,
# empty database instead of the real one.
#
# So after deploying, this asserts that `migrate status` reports the schema up
# to date. That catches the cases that matter: migrations still pending, or a
# previous migration recorded as failed (P3009), either of which would mean the
# new code is about to serve traffic against a schema it does not match.
set -e

if [ -z "$DIRECT_DATABASE_URL" ]; then
  echo "[predeploy] ERROR: DIRECT_DATABASE_URL is not set." >&2
  echo "[predeploy] Set it on the Render service to the Neon DIRECT (unpooled)" >&2
  echo "[predeploy] connection string — the same URL as DATABASE_URL but with" >&2
  echo "[predeploy] '-pooler' removed from the hostname." >&2
  echo "[predeploy] Refusing to run migrations through the pooler." >&2
  exit 1
fi

export DATABASE_URL="$DIRECT_DATABASE_URL"

echo "[predeploy] applying migrations over the direct endpoint"
set +e
npx prisma migrate deploy
deploy_code=$?
set -e

if [ "$deploy_code" -ne 0 ]; then
  echo "[predeploy] ERROR: 'prisma migrate deploy' exited $deploy_code." >&2
  exit "$deploy_code"
fi

# The assertion. `migrate status` prints this line only when every migration in
# the repository is recorded as applied to the target database.
echo "[predeploy] verifying the schema is actually up to date"
status_output=$(npx prisma migrate status 2>&1 || true)

if printf '%s' "$status_output" | grep -q "Database schema is up to date"; then
  echo "[predeploy] migrations applied and verified"
  exit 0
fi

echo "[predeploy] ERROR: could not confirm the schema is up to date." >&2
echo "[predeploy] Aborting the deploy so unmigrated code never serves traffic." >&2
echo "[predeploy] --- prisma migrate status ---" >&2
printf '%s\n' "$status_output" >&2
exit 1
