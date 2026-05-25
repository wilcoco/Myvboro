import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listInvestors, userEquity } from "@/lib/invest";
import { getCurrentUser } from "@/lib/session";
import InvestForm from "@/components/InvestForm";
import InvestorsTable from "@/components/InvestorsTable";

export const dynamic = "force-dynamic";

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = await prisma.place.findUnique({
    where: { id },
    select: {
      id: true,
      primaryName: true,
      category: true,
      centroidLat: true,
      centroidLng: true,
      radiusMeters: true,
      confidence: true,
      visitCount: true,
      totalInvestment: true,
      investorCount: true,
      recentInvestSum: true,
      mergedIntoId: true,
      createdAt: true,
      createdById: true,
    },
  });
  if (!place) notFound();
  if (place.mergedIntoId) redirect(`/places/${place.mergedIntoId}`);

  const [investors, me] = await Promise.all([listInvestors(id), getCurrentUser()]);
  const myEquity = me ? await userEquity(me.id, id) : 0;

  // Momentum chip: rolling 7-day investment as % of total pool.
  const momentum =
    place.totalInvestment > 0 ? place.recentInvestSum / place.totalInvestment : 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-1 text-xs uppercase tracking-wider text-muted">
        {place.category || "uncategorized"}
      </div>
      <h1 className="text-3xl font-semibold">{place.primaryName}</h1>
      <div className="mt-2 text-xs text-muted">
        📍 {place.centroidLat.toFixed(5)}, {place.centroidLng.toFixed(5)} · ±
        {Math.round(place.radiusMeters)}m · 신뢰도 {(place.confidence * 100).toFixed(0)}%
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Stat label="누적 출자" value={`${place.totalInvestment.toLocaleString()}P`} />
        <Stat label="투자자" value={`${place.investorCount}명`} />
        <Stat
          label="7일 모멘텀"
          value={`${(momentum * 100).toFixed(1)}%`}
          highlight={momentum > 0.1}
        />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_280px]">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">투자자 명단</h2>
          <InvestorsTable investors={investors} />

          {me && myEquity > 0 && (
            <div className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
              현재 내 지분 <span className="font-medium">{(myEquity * 100).toFixed(2)}%</span>
            </div>
          )}
        </section>

        <aside>
          {me ? (
            <InvestForm placeId={place.id} myPoints={me.points} pool={place.totalInvestment} />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              투자하려면{" "}
              <Link href="/signin" className="text-accent underline">
                로그인
              </Link>{" "}
              하세요.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-3 ${
        highlight ? "ring-1 ring-accent" : ""
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
