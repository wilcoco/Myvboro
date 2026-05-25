-- Enable PostGIS. Idempotent: safe to re-run on the same database.
-- All raw geography(POINT, 4326) columns are added in the next migration
-- because they must come AFTER Prisma creates the base tables.
CREATE EXTENSION IF NOT EXISTS postgis;
