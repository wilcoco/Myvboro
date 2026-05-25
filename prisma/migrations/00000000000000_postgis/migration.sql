-- Enable PostGIS extension on the Postgres instance.
-- Prisma owns the rest of the schema; this migration only handles the
-- spatial bits Prisma can't express natively (geography columns + GIST
-- indexes). Subsequent `prisma migrate` runs leave these objects alone
-- because they're declared as Unsupported(...) in schema.prisma.

CREATE EXTENSION IF NOT EXISTS postgis;
