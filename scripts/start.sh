#!/usr/bin/env sh
# Railway start script.
# Railway's private DNS (postgres.railway.internal) is IPv6-only and the
# container's network stack can take several seconds to be reachable on
# cold start. We retry `prisma migrate deploy` until it succeeds (or we
# give up after ~60s of attempts) before starting the server.

set -e

attempts=20
delay=3

i=1
while [ $i -le $attempts ]; do
  echo "[start] migrate attempt $i/$attempts"
  if npx prisma migrate deploy; then
    echo "[start] migrations applied"
    break
  fi
  if [ $i -eq $attempts ]; then
    echo "[start] giving up after $attempts attempts" >&2
    exit 1
  fi
  i=$((i + 1))
  sleep $delay
done

exec npm run start
