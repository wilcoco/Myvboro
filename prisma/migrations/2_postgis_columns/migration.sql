-- Add raw PostGIS geography columns on tables that need spatial queries.
-- These columns are declared as Unsupported(...) in schema.prisma and
-- written/read via raw SQL in src/lib/places.ts.

ALTER TABLE "Place" ADD COLUMN IF NOT EXISTS "location" geography(POINT, 4326);
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "location" geography(POINT, 4326);

-- Spatial indexes — required for ST_DWithin / ST_Distance to scale.
CREATE INDEX IF NOT EXISTS "Place_location_gix" ON "Place" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "Visit_location_gix" ON "Visit" USING GIST ("location");

-- Auto-sync trigger: keep `location` consistent with (centroidLat, centroidLng)
-- on Place and (lat, lng) on Visit, so callers that only know about the
-- numeric columns can't get the geography column out of sync.
CREATE OR REPLACE FUNCTION sync_place_location() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."centroidLat" IS NOT NULL AND NEW."centroidLng" IS NOT NULL THEN
    NEW."location" := ST_SetSRID(ST_MakePoint(NEW."centroidLng", NEW."centroidLat"), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS place_location_sync ON "Place";
CREATE TRIGGER place_location_sync
  BEFORE INSERT OR UPDATE OF "centroidLat", "centroidLng"
  ON "Place"
  FOR EACH ROW
  EXECUTE FUNCTION sync_place_location();

CREATE OR REPLACE FUNCTION sync_visit_location() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."lat" IS NOT NULL AND NEW."lng" IS NOT NULL THEN
    NEW."location" := ST_SetSRID(ST_MakePoint(NEW."lng", NEW."lat"), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS visit_location_sync ON "Visit";
CREATE TRIGGER visit_location_sync
  BEFORE INSERT OR UPDATE OF "lat", "lng"
  ON "Visit"
  FOR EACH ROW
  EXECUTE FUNCTION sync_visit_location();
