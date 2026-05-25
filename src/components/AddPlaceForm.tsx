"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Coord = { lat: number; lng: number; accuracy: number | null };

export default function AddPlaceForm({ placeCreateCost }: { placeCreateCost: number }) {
  const router = useRouter();
  const [coord, setCoord] = useState<Coord | null>(null);
  const [primaryName, setPrimaryName] = useState("");
  const [category, setCategory] = useState("");
  const [seed, setSeed] = useState<string>(String(placeCreateCost));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("이 브라우저는 위치 서비스를 지원하지 않습니다.");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) =>
        setCoord({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (e) => setGeoError(e.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coord) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primaryName,
          category: category || undefined,
          lat: coord.lat,
          lng: coord.lng,
          initialInvestment: parseInt(seed, 10) || 0,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "등록 실패");
      } else {
        router.push(`/places/${json.placeId}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !!coord && primaryName.trim().length > 0 && parseInt(seed, 10) >= placeCreateCost;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-md border border-border bg-surface p-3 text-sm">
        {geoError && <div className="text-red-300">{geoError}</div>}
        {!coord && !geoError && <div className="text-muted">현재 위치를 가져오는 중…</div>}
        {coord && (
          <div className="space-y-1">
            <div className="text-muted">
              📍 {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
              {coord.accuracy != null && (
                <span className="ml-2 text-xs">±{Math.round(coord.accuracy)}m</span>
              )}
            </div>
            {coord.accuracy && coord.accuracy > 100 && (
              <div className="text-xs text-amber-400">
                GPS 정확도가 낮습니다. 야외에서 다시 시도해 보세요.
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm">가게 이름</label>
        <input
          value={primaryName}
          onChange={(e) => setPrimaryName(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2"
          maxLength={80}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm">카테고리 (선택)</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="예: 카페, 한식, 술집"
          className="w-full rounded-md border border-border bg-bg px-3 py-2"
          maxLength={40}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm">
          초기 투자 (최소 {placeCreateCost}P)
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={seed}
          min={placeCreateCost}
          step={10}
          onChange={(e) => setSeed(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2"
        />
        <p className="mt-1 text-xs text-muted">
          가게를 등록하는 것은 첫 투자자가 되는 것과 같습니다. 후속 투자자가 들어오면
          지분 비율대로 배당받습니다.
        </p>
      </div>

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="w-full rounded-md bg-accent px-3 py-2 font-medium text-black disabled:opacity-50"
      >
        {busy ? "등록 중…" : "등록 + 투자"}
      </button>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}
