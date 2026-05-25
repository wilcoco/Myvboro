"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, MapPin, X } from "lucide-react";
import { useRouter } from "@/i18n/routing";

type Labels = {
  locating: string;
  getLocation: string;
  locationOk: string;
  permissionDenied: string;
  storefront: string;
  menu: string;
  food: string;
  takePhoto: string;
  choosePhoto: string;
  placeName: string;
  placeNamePlaceholder: string;
  categoryPlaceholder: string;
  nearbyMatches: string;
  createNew: string;
  comment: string;
  commentPlaceholder: string;
  rating: string;
  submit: string;
  submitting: string;
  uploadFailed: string;
  saved: string;
  tierHint: string;
  rateRecommenderTitle: string;
  rateRecommenderBody: string;
  rateRecommenderSubmit: string;
  rateRecommenderSkip: string;
};

type PendingEndorsement = {
  id: string;
  fromUser: { id: string; name: string | null; image: string | null };
};

type PhotoKind = "STOREFRONT" | "MENU" | "FOOD";

type PendingPhoto = {
  kind: PhotoKind;
  file: File;
  previewUrl: string;
  takenInApp: boolean;
};

type NearbyPlace = {
  id: string;
  primaryName: string;
  category: string | null;
  distanceMeters: number;
  visitCount: number;
};

const PHOTO_KINDS: PhotoKind[] = ["STOREFRONT", "MENU", "FOOD"];

// Best-effort client-side compression. Keeps photo upload payloads
// small enough for mobile networks; aspect ratio preserved.
async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", quality),
  );
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

export default function AddVisitForm({ labels }: { labels: Labels }) {
  const router = useRouter();

  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const dwellStartedAt = useRef<number | null>(null);

  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const [rawName, setRawName] = useState("");
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [pickedPlaceId, setPickedPlaceId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingEndorsements, setPendingEndorsements] = useState<PendingEndorsement[]>([]);
  const [endorsementRatings, setEndorsementRatings] = useState<Record<string, number>>({});
  const [savedPlaceId, setSavedPlaceId] = useState<string | null>(null);

  // Geolocation — capture once at start, then poll for nearby candidates.
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    dwellStartedAt.current = Date.now();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoords(pos.coords);
      },
      () => {
        setLocating(false);
        setDenied(true);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // When we have a position, fetch nearby Place candidates.
  useEffect(() => {
    if (!coords) return;
    const url = `/api/places/nearby?lat=${coords.latitude}&lng=${coords.longitude}&radius=50`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setNearby(data.places ?? []))
      .catch(() => setNearby([]));
  }, [coords]);

  function onPickFile(kind: PhotoKind, takenInApp: boolean) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      setPhotos((prev) => [
        ...prev.filter((p) => p.kind !== kind),
        { kind, file: compressed, previewUrl, takenInApp },
      ]);
      e.target.value = "";
    };
  }

  function removePhoto(kind: PhotoKind) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.kind === kind);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.kind !== kind);
    });
  }

  async function uploadPhoto(photo: PendingPhoto) {
    const presign = await fetch("/api/photos/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: photo.kind, contentType: photo.file.type }),
    });
    if (!presign.ok) throw new Error("presign failed");
    const { uploadUrl, publicUrl } = await presign.json();

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": photo.file.type },
      body: photo.file,
    });
    if (!put.ok) throw new Error("upload failed");
    return { publicUrl };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords || !rawName) return;
    setSubmitting(true);
    setError(null);

    try {
      const uploaded = await Promise.all(
        photos.map(async (p) => {
          const { publicUrl } = await uploadPhoto(p);
          return {
            kind: p.kind,
            url: publicUrl,
            takenInApp: p.takenInApp,
            exifLat: coords.latitude,
            exifLng: coords.longitude,
            exifTime: new Date(p.file.lastModified).toISOString(),
          };
        }),
      );

      const dwellSec =
        dwellStartedAt.current != null
          ? Math.floor((Date.now() - dwellStartedAt.current) / 1000)
          : null;

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placeId: pickedPlaceId ?? undefined,
          rawName,
          category: category || undefined,
          lat: coords.latitude,
          lng: coords.longitude,
          gpsAccuracy: coords.accuracy,
          dwellTimeSec: dwellSec ?? undefined,
          rating: rating ?? undefined,
          comment: comment || undefined,
          photos: uploaded,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "save failed");
      const { placeId, pendingEndorsements: pe } =
        (await res.json()) as { placeId: string; pendingEndorsements: PendingEndorsement[] };

      setSavedPlaceId(placeId);
      if (pe && pe.length > 0) {
        setPendingEndorsements(pe);
      } else {
        router.push(`/map?place=${placeId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.uploadFailed);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(coords && rawName && !submitting);

  async function submitEndorsementRatings() {
    await Promise.all(
      pendingEndorsements
        .filter((e) => endorsementRatings[e.id])
        .map((e) =>
          fetch("/api/endorsements", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              endorsementId: e.id,
              satisfaction: endorsementRatings[e.id],
            }),
          }),
        ),
    );
    if (savedPlaceId) router.push(`/map?place=${savedPlaceId}`);
  }

  if (pendingEndorsements.length > 0) {
    return (
      <div className="max-w-md mx-auto space-y-5">
        <div>
          <h2 className="text-lg font-semibold">{labels.rateRecommenderTitle}</h2>
          <p className="text-sm text-muted-foreground mt-1">{labels.rateRecommenderBody}</p>
        </div>

        <ul className="space-y-4">
          {pendingEndorsements.map((e) => (
            <li key={e.id} className="rounded-lg border bg-card p-4">
              <div className="text-sm font-medium">
                {e.fromUser.name ?? "—"}
              </div>
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setEndorsementRatings((s) => ({ ...s, [e.id]: n }))
                    }
                    className={`w-10 h-10 rounded-full border text-sm font-medium ${
                      n <= (endorsementRatings[e.id] ?? 0)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => savedPlaceId && router.push(`/map?place=${savedPlaceId}`)}
            className="flex-1 rounded-md border bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
          >
            {labels.rateRecommenderSkip}
          </button>
          <button
            type="button"
            onClick={submitEndorsementRatings}
            className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90"
          >
            {labels.rateRecommenderSubmit}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-6">
      {/* Location ------------------------------------------------------- */}
      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" />
          {locating
            ? labels.locating
            : coords
              ? labels.locationOk
              : denied
                ? labels.permissionDenied
                : labels.getLocation}
        </div>
        {coords && (
          <div className="mt-1 text-xs text-muted-foreground">
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} · ±
            {Math.round(coords.accuracy)}m
          </div>
        )}
      </section>

      {/* Photos --------------------------------------------------------- */}
      <section className="space-y-3">
        {PHOTO_KINDS.map((kind) => {
          const photo = photos.find((p) => p.kind === kind);
          const labelMap = {
            STOREFRONT: labels.storefront,
            MENU: labels.menu,
            FOOD: labels.food,
          } as const;
          return (
            <div key={kind} className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{labelMap[kind]}</span>
                {photo && (
                  <button
                    type="button"
                    onClick={() => removePhoto(kind)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {photo ? (
                <img
                  src={photo.previewUrl}
                  alt=""
                  className="mt-2 w-full h-40 object-cover rounded"
                />
              ) : (
                <div className="mt-2 flex gap-2">
                  <label className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                    <Camera className="h-4 w-4" /> {labels.takePhoto}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      ref={(el) => {
                        fileInputs.current[`${kind}-cam`] = el;
                      }}
                      onChange={onPickFile(kind, true)}
                    />
                  </label>
                  <label className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                    <ImagePlus className="h-4 w-4" /> {labels.choosePhoto}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onPickFile(kind, false)}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">{labels.tierHint}</p>
      </section>

      {/* Place pick ----------------------------------------------------- */}
      <section className="space-y-3">
        <label className="block text-sm font-medium">{labels.placeName}</label>
        <input
          type="text"
          required
          value={rawName}
          onChange={(e) => setRawName(e.target.value)}
          placeholder={labels.placeNamePlaceholder}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={labels.categoryPlaceholder}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />

        {nearby.length > 0 && (
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {labels.nearbyMatches}
            </div>
            <div className="space-y-1">
              {nearby.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setPickedPlaceId(p.id);
                    setRawName(p.primaryName);
                    if (p.category) setCategory(p.category);
                  }}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent flex justify-between ${
                    pickedPlaceId === p.id ? "bg-accent" : ""
                  }`}
                >
                  <span>{p.primaryName}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(p.distanceMeters)}m · {p.visitCount}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickedPlaceId(null)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent border border-dashed ${
                  pickedPlaceId === null ? "bg-accent" : ""
                }`}
              >
                + {labels.createNew}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Rating + comment ---------------------------------------------- */}
      <section className="space-y-2">
        <label className="block text-sm font-medium">{labels.rating}</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(n)}
              className={`w-10 h-10 rounded-full border text-sm font-medium ${
                rating != null && n <= rating
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium mt-3">{labels.comment}</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={labels.commentPlaceholder}
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </section>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
