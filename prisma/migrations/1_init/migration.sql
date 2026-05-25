-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('STOREFRONT', 'MENU', 'FOOD', 'INTERIOR', 'RECEIPT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lastDailyGrant" TEXT,
    "authorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suspicionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,
    "ip" TEXT,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "primaryName" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT,
    "centroidLat" DOUBLE PRECISION NOT NULL,
    "centroidLng" DOUBLE PRECISION NOT NULL,
    "radiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "authoritySum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalInvestment" INTEGER NOT NULL DEFAULT 0,
    "investorCount" INTEGER NOT NULL DEFAULT 0,
    "recentInvestSum" INTEGER NOT NULL DEFAULT 0,
    "recentInvestUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT,
    "rawName" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "gpsAccuracy" DOUBLE PRECISION,
    "dwellTimeSec" INTEGER,
    "tier" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "rating" INTEGER,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "placeId" TEXT,
    "kind" "PhotoKind" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "exifTime" TIMESTAMP(3),
    "exifLat" DOUBLE PRECISION,
    "exifLng" DOUBLE PRECISION,
    "perceptualHash" TEXT,
    "takenInApp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "poolBeforeInvest" INTEGER NOT NULL,
    "investedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "causingInvestmentId" TEXT NOT NULL,
    "receiverInvestmentId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

CREATE INDEX "OtpCode_phoneNumber_createdAt_idx" ON "OtpCode"("phoneNumber", "createdAt");
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Session_deviceFingerprint_idx" ON "Session"("deviceFingerprint");

CREATE UNIQUE INDEX "DeviceLink_userId_deviceFingerprint_key" ON "DeviceLink"("userId", "deviceFingerprint");
CREATE INDEX "DeviceLink_deviceFingerprint_idx" ON "DeviceLink"("deviceFingerprint");

CREATE INDEX "Place_centroidLat_centroidLng_idx" ON "Place"("centroidLat", "centroidLng");
CREATE INDEX "Place_totalInvestment_idx" ON "Place"("totalInvestment");
CREATE INDEX "Place_mergedIntoId_idx" ON "Place"("mergedIntoId");

CREATE INDEX "Visit_userId_idx" ON "Visit"("userId");
CREATE INDEX "Visit_placeId_idx" ON "Visit"("placeId");
CREATE INDEX "Visit_visitedAt_idx" ON "Visit"("visitedAt");

CREATE INDEX "Photo_visitId_idx" ON "Photo"("visitId");
CREATE INDEX "Photo_placeId_idx" ON "Photo"("placeId");
CREATE INDEX "Photo_kind_idx" ON "Photo"("kind");
CREATE INDEX "Photo_perceptualHash_idx" ON "Photo"("perceptualHash");

CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");
CREATE INDEX "Investment_placeId_idx" ON "Investment"("placeId");
CREATE INDEX "Investment_investedAt_idx" ON "Investment"("investedAt");

CREATE INDEX "Dividend_causingInvestmentId_idx" ON "Dividend"("causingInvestmentId");
CREATE INDEX "Dividend_receiverInvestmentId_idx" ON "Dividend"("receiverInvestmentId");
CREATE INDEX "Dividend_receiverUserId_idx" ON "Dividend"("receiverUserId");

-- Foreign keys
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceLink" ADD CONSTRAINT "DeviceLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Place" ADD CONSTRAINT "Place_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Place" ADD CONSTRAINT "Place_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_causingInvestmentId_fkey" FOREIGN KEY ("causingInvestmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_receiverInvestmentId_fkey" FOREIGN KEY ("receiverInvestmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
