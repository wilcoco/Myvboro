"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Plus, Star, X } from "lucide-react";

type Visit = {
  id: string;
  userId: string;
  rating: number | null;
  comment: string | null;
  weight: number;
  tier: number;
  visitedAt: string;
  user: { id: string; name: string | null; image: string | null; authorityScore: number };
  photos: { id: string; kind: string; url: string }[];
};

type PlaceFull = {
  id: string;
  primaryName: string;
  category: string | null;
  centroidLat: number;
  centroidLng: number;
  visitCount: number;
  authoritySum: number;
  endorsementCount: number;
  confidence: number;
  visits: Visit[];
};

type Labels = {
  loading: string;
  visits: string;
  queueUp: string;
  queued: string;
  loginToQueue: string;
  noVisits: string;
  close: string;
};

export default function PlaceDetailSheet({
  placeId,
  isAuthed,
  labels,
  onClose,
}: {
  placeId: string | null;
  isAuthed: boolean;
  labels: Labels;
  onClose: () => void;
}) {
  const [place, setPlace] = useState<PlaceFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [queuingVisit, setQueuingVisit] = useState<string | null>(null);
  const [queuedFor, setQueuedFor] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!placeId) {
      setPlace(null);
      setQueuedFor(new Set());
      return;
    }
    setLoading(true);
    fetch(`/api/places/${placeId}`)
      .then((r) => r.json())
      .then((data) => setPlace(data.place ?? null))
      .finally(() => setLoading(false));
  }, [placeId]);

  async function queueUp(visitId: string) {
    setQueuingVisit(visitId);
    try {
      const res = await fetch("/api/endorsements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitId }),
      });
      if (res.ok) setQueuedFor((s) => new Set(s).add(visitId));
    } finally {
      setQueuingVisit(null);
    }
  }

  if (!placeId) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 bg-card border-t shadow-2xl rounded-t-2xl max-h-[70dvh] flex flex-col"
      role="dialog"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="min-w-0">
          <h2 className="font-semibold truncate">
            {place?.primaryName ?? labels.loading}
          </h2>
          {place && (
            <div className="text-xs text-muted-foreground">
              {place.category ? `${place.category} · ` : ""}
              {place.visitCount} {labels.visits}
              {place.endorsementCount > 0 && ` · ${place.endorsementCount}`}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="rounded-full p-1.5 hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {place && place.visits.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {labels.noVisits}
          </div>
        )}

        <ul className="space-y-3">
          {place?.visits.map((v) => {
            const queued = queuedFor.has(v.id);
            return (
              <li key={v.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {v.user.image && (
                      <Image
                        src={v.user.image}
                        alt=""
                        width={28}
                        height={28}
                        className="rounded-full"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {v.user.name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        T{v.tier} · w{v.weight.toFixed(0)} ·{" "}
                        {new Date(v.visitedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {v.rating != null && (
                    <div className="flex items-center gap-0.5 text-amber-500 text-sm">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {v.rating}
                    </div>
                  )}
                </div>

                {v.comment && (
                  <p className="mt-2 text-sm whitespace-pre-wrap">{v.comment}</p>
                )}

                {v.photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {v.photos.slice(0, 3).map((ph) => (
                      <img
                        key={ph.id}
                        src={ph.url}
                        alt={ph.kind}
                        className="aspect-square w-full object-cover rounded"
                      />
                    ))}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  {isAuthed ? (
                    <button
                      type="button"
                      onClick={() => queueUp(v.id)}
                      disabled={queued || queuingVisit === v.id}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border ${
                        queued
                          ? "bg-accent text-accent-foreground border-transparent"
                          : "hover:bg-accent"
                      }`}
                    >
                      {queuingVisit === v.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {queued ? labels.queued : labels.queueUp}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {labels.loginToQueue}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
