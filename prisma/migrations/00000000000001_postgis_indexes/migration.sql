-- GIST indexes for fast radius / bbox queries against the geography columns.
-- These columns are declared as Unsupported(...) in schema.prisma, so we add
-- the indexes manually here. Helper triggers keep `location` in sync with
-- the (lat, lng) numeric duplicates that Prisma writes through.

-- Place.location ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS "place_location_gix"
  ON "Place" USING GIST ("location");

CREATE OR REPLACE FUNCTION sync_place_location() RETURNS trigger AS $$
BEGIN
  NEW."location" := ST_SetSRID(ST_MakePoint(NEW."centroidLng", NEW."centroidLat"), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS place_location_sync ON "Place";
CREATE TRIGGER place_location_sync
  BEFORE INSERT OR UPDATE OF "centroidLat", "centroidLng" ON "Place"
  FOR EACH ROW EXECUTE FUNCTION sync_place_location();

-- Visit.location ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS "visit_location_gix"
  ON "Visit" USING GIST ("location");

CREATE OR REPLACE FUNCTION sync_visit_location() RETURNS trigger AS $$
BEGIN
  NEW."location" := ST_SetSRID(ST_MakePoint(NEW."lng", NEW."lat"), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS visit_location_sync ON "Visit";
CREATE TRIGGER visit_location_sync
  BEFORE INSERT OR UPDATE OF "lat", "lng" ON "Visit"
  FOR EACH ROW EXECUTE FUNCTION sync_visit_location();
