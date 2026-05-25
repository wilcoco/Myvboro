"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-text"
    >
      로그아웃
    </button>
  );
}
