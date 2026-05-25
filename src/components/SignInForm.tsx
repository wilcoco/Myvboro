"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "phone" | "code" | "done";

export default function SignInForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "전송 실패");
      } else if (json.autoSignedIn) {
        // Dev mock provider — server skipped OTP and created the session.
        router.push("/map");
        router.refresh();
      } else {
        setStage("code");
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber, code }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "인증 실패");
      } else {
        router.push("/map");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">로그인</h1>
      <p className="text-sm text-muted">
        휴대폰 번호로 가입·로그인합니다. (개발 모드에서는 인증번호 단계가 생략됩니다.)
      </p>

      {stage === "phone" && (
        <form onSubmit={sendOtp} className="space-y-3">
          <input
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-accent px-3 py-2 font-medium text-black disabled:opacity-50"
          >
            {busy ? "전송 중…" : "인증번호 받기"}
          </button>
        </form>
      )}

      {stage === "code" && (
        <form onSubmit={verifyOtp} className="space-y-3">
          <div className="text-sm text-muted">
            <span className="text-text">{phoneNumber}</span> 로 보낸 6자리 코드를 입력하세요.
            <br />
            <em className="text-xs">개발 모드: 서버 로그에 OTP가 출력됩니다.</em>
          </div>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-center text-2xl tracking-widest"
            required
            maxLength={6}
          />
          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="w-full rounded-md bg-accent px-3 py-2 font-medium text-black disabled:opacity-50"
          >
            {busy ? "확인 중…" : "로그인"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("phone");
              setCode("");
              setError(null);
            }}
            className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted"
          >
            번호 다시 입력
          </button>
        </form>
      )}

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
