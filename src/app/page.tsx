import Link from "next/link";

export default function Landing() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        숨은 가게에 투자하세요.
      </h1>
      <p className="mt-4 text-lg text-muted">
        myvboro 는 사용자가 직접 발견하고 평가한 가게의 지도입니다.
        외부 POI 가 아닙니다. 광고도 없습니다.
        대신 <span className="text-text">투자 게임</span>이 있습니다.
      </p>

      <div className="mt-10 grid gap-4 text-sm sm:grid-cols-2">
        <Block title="발견 → 등록 → 첫 투자자">
          새 가게를 등록하면 자동으로 그 가게의 첫 투자자가 됩니다.
        </Block>
        <Block title="후속 투자자 = 당신의 배당">
          다른 사람이 같은 가게에 투자하면 그 금액이 기존 투자자들에게
          지분 비율대로 분배됩니다.
        </Block>
        <Block title="원으로 표시되는 지도">
          핀이 아닌 원. 반지름은 위치의 불확실성, 크기는 누적 투자입니다.
        </Block>
        <Block title="현금화는 없음">
          모든 보상은 게임 내 포인트입니다. 사행성도, 증권도 아닙니다.
        </Block>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/signin" className="rounded-md bg-accent px-4 py-2 font-medium text-black">
          시작하기
        </Link>
        <Link href="/map" className="rounded-md border border-border px-4 py-2">
          그냥 지도 보기
        </Link>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 font-medium">{title}</div>
      <div className="text-muted">{children}</div>
    </div>
  );
}
