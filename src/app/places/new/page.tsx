import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AddPlaceForm from "@/components/AddPlaceForm";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function NewPlacePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/signin");

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">새 가게 등록</h1>
      <p className="mb-6 text-sm text-muted">
        현재 위치에서 가게를 등록합니다. 등록과 동시에 첫 투자가 자동 집행됩니다.
      </p>
      <div className="mb-4 rounded-md border border-border bg-surface p-3 text-sm">
        보유 포인트: <span className="font-medium">{me.points.toLocaleString()}P</span>
      </div>
      <AddPlaceForm placeCreateCost={env.placeCreateCost} />
    </div>
  );
}
