"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Item = {
  id: string;
  fromUser: { id: string; name: string | null; image: string | null };
  place: { id: string; primaryName: string };
};

type Labels = {
  title: string;
  body: string;
  submit: string;
  submitting: string;
};

export default function PendingEndorsementsList({
  items,
  labels,
}: {
  items: Item[];
  labels: Labels;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function submit(id: string) {
    const satisfaction = ratings[id];
    if (!satisfaction) return;
    setSubmitting(id);
    try {
      const res = await fetch("/api/endorsements", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endorsementId: id, satisfaction }),
      });
      if (res.ok) setDone((s) => new Set(s).add(id));
    } finally {
      setSubmitting(null);
    }
  }

  const remaining = items.filter((i) => !done.has(i.id));
  if (remaining.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium">{labels.title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{labels.body}</p>
      <ul className="mt-3 space-y-3">
        {remaining.map((i) => (
          <li key={i.id} className="border-t pt-3 first:border-t-0 first:pt-0">
            <div className="text-sm">
              <span className="font-medium">{i.fromUser.name ?? "—"}</span>
              <span className="text-muted-foreground"> · {i.place.primaryName}</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRatings((s) => ({ ...s, [i.id]: n }))}
                  className={`w-9 h-9 rounded-full border text-sm font-medium ${
                    n <= (ratings[i.id] ?? 0)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => submit(i.id)}
                disabled={!ratings[i.id] || submitting === i.id}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium disabled:opacity-50"
              >
                {submitting === i.id && <Loader2 className="h-3 w-3 animate-spin" />}
                {submitting === i.id ? labels.submitting : labels.submit}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
