import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { maybeGrantDaily } from "@/lib/economy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/signin");
  await maybeGrantDaily(me.id);

  const fresh = await prisma.user.findUnique({
    where: { id: me.id },
    select: { points: true, createdAt: true, displayName: true, phoneNumber: true },
  });

  const [invs, divs, holdings] = await Promise.all([
    prisma.investment.aggregate({
      where: { userId: me.id },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.dividend.aggregate({
      where: { receiverUserId: me.id },
      _sum: { amount: true },
    }),
    prisma.investment.groupBy({
      by: ["placeId"],
      where: { userId: me.id },
      _sum: { amount: true },
      _min: { investedAt: true },
    }),
  ]);

  const placeIds = holdings.map((h) => h.placeId);
  const places = placeIds.length
    ? await prisma.place.findMany({
        where: { id: { in: placeIds } },
        select: {
          id: true,
          primaryName: true,
          category: true,
          totalInvestment: true,
          investorCount: true,
          recentInvestSum: true,
        },
      })
    : [];
  const placeMap = new Map(places.map((p) => [p.id, p]));

  // Per-place dividends.
  const divRows = await prisma.dividend.findMany({
    where: { receiverUserId: me.id },
    select: { amount: true, receiverInvestment: { select: { placeId: true } } },
  });
  const divByPlace = new Map<string, number>();
  for (const d of divRows) {
    const pid = d.receiverInvestment.placeId;
    divByPlace.set(pid, (divByPlace.get(pid) ?? 0) + d.amount);
  }

  const rows = holdings
    .map((h) => {
      const place = placeMap.get(h.placeId);
      if (!place) return null;
      const invested = h._sum.amount ?? 0;
      const dividendsReceived = divByPlace.get(place.id) ?? 0;
      const equity = place.totalInvestment > 0 ? invested / place.totalInvestment : 0;
      return {
        place,
        invested,
        dividendsReceived,
        net: dividendsReceived - invested,
        equity,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.invested - a.invested);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">내 정보</h1>
      <div className="mt-1 text-sm text-muted">
        {fresh?.phoneNumber} · 가입 {fresh?.createdAt.toISOString().slice(0, 10)}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Stat label="잔여 포인트" value={`${(fresh?.points ?? 0).toLocaleString()}P`} />
        <Stat label="누적 출자" value={`${(invs._sum.amount ?? 0).toLocaleString()}P`} />
        <Stat label="누적 배당" value={`+${(divs._sum.amount ?? 0).toLocaleString()}P`} highlight />
      </div>

      <h2 className="mt-10 text-sm font-medium text-muted">포트폴리오</h2>
      {rows.length === 0 ? (
        <div className="mt-2 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          아직 투자한 가게가 없습니다.{" "}
          <Link href="/map" className="text-accent underline">지도</Link>에서 찾아보거나{" "}
          <Link href="/places/new" className="text-accent underline">새 가게</Link>를 등록해 보세요.
        </div>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">가게</th>
                <th className="px-3 py-2 text-right">출자</th>
                <th className="px-3 py-2 text-right">배당</th>
                <th className="px-3 py-2 text-right">순손익</th>
                <th className="px-3 py-2 text-right">지분</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.place.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/places/${r.place.id}`} className="hover:underline">
                      {r.place.primaryName}
                    </Link>
                    <div className="text-xs text-muted">{r.place.category || ""}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{r.invested.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-accent">
                    +{r.dividendsReceived.toLocaleString()}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${
                      r.net >= 0 ? "text-accent" : "text-red-400"
                    }`}
                  >
                    {r.net >= 0 ? "+" : ""}
                    {r.net.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">{(r.equity * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
