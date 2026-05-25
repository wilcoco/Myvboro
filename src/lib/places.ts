import { prisma } from "@/lib/prisma";

export type NearbyCandidate = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
  confidence: number;
  visitCount: number;
  totalInvestment: number;
  investorCount: number;
  distanceMeters: number;
};

export async function findNearbyPlaces(opts: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
}): Promise<NearbyCandidate[]> {
  const radius = opts.radiusMeters ?? 100;
  const limit = opts.limit ?? 20;

  return prisma.$queryRaw<NearbyCandidate[]>`
    SELECT
      "id",
      "primaryName",
      "category",
      "centroidLat",
      "centroidLng",
      "radiusMeters",
      "confidence",
      "visitCount",
      "totalInvestment",
      "investorCount",
      ST_Distance(
        "location",
        ST_SetSRID(ST_MakePoint(${opts.lng}, ${opts.lat}), 4326)::geography
      ) AS "distanceMeters"
    FROM "Place"
    WHERE "mergedIntoId" IS NULL
      AND "location" IS NOT NULL
      AND ST_DWithin(
        "location",
        ST_SetSRID(ST_MakePoint(${opts.lng}, ${opts.lat}), 4326)::geography,
        ${radius}
      )
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit}
  `;
}

export type PlaceInBbox = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  radiusMeters: number;
  confidence: number;
  visitCount: number;
  totalInvestment: number;
  investorCount: number;
};

export async function findPlacesInBbox(opts: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  limit?: number;
}): Promise<PlaceInBbox[]> {
  const limit = opts.limit ?? 500;
  return prisma.$queryRaw<PlaceInBbox[]>`
    SELECT
      "id",
      "primaryName",
      "category",
      "centroidLat",
      "centroidLng",
      "radiusMeters",
      "confidence",
      "visitCount",
      "totalInvestment",
      "investorCount"
    FROM "Place"
    WHERE "mergedIntoId" IS NULL
      AND "location" IS NOT NULL
      AND "location" && ST_MakeEnvelope(
        ${opts.minLng}, ${opts.minLat}, ${opts.maxLng}, ${opts.maxLat}, 4326
      )::geography
    ORDER BY "totalInvestment" DESC
    LIMIT ${limit}
  `;
}
