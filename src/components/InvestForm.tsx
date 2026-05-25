"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  placeId: string;
  myPoints: number;
  pool: number;
};

export default function InvestForm({ placeId, myPoints, pool }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const n = parseInt(amount, 10) || 0;
  const projectedShare = pool + n === 0 ? 1 : n / (pool + n);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/places/${placeId}/invest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: n }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMsg(`실패: ${json.reason}${json.detail ? ` (${json.detail})` : ""}`);
      } else {
        setMsg(
          `투자 완료. 새 풀 ${json.newPool}P. 분배 ${json.dividends.length}건.`,
        );
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">투자하기</h3>
        <span className="text-xs text-muted">보유 {myPoints}P</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={10}
          max={myPoints}
          step={10}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2"
        />
        <span className="text-sm text-muted">P</span>
      </div>
      <div className="text-xs text-muted">
        투자 후 예상 지분 <span className="text-text">{(projectedShare * 100).toFixed(1)}%</span>
        {pool > 0 && (
          <>
            {" "}
            · 이번 투자분의 <span className="text-text">{Math.floor((n * 1) / 1)}P</span> 가 기존 투자자에게
            지분 비율대로 분배됩니다.
          </>
        )}
      </div>
      <button
        type="submit"
        disabled={busy || n < 10 || n > myPoints}
        className="w-full rounded-md bg-accent px-3 py-2 font-medium text-black disabled:opacity-50"
      >
        {busy ? "처리 중…" : `${n}P 투자`}
      </button>
      {msg && <div className="text-xs text-muted">{msg}</div>}
    </form>
  );
}
