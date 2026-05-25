import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: "myvboro",
  description: "사용자 투자로 발견되는 동네 맛집 지도",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col bg-bg text-text">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            myvboro
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/map" className="text-muted hover:text-text">지도</Link>
            {me ? (
              <>
                <Link href="/places/new" className="text-muted hover:text-text">+ 가게</Link>
                <Link href="/profile" className="text-muted hover:text-text">
                  내 정보 · <span className="text-text">{me.points.toLocaleString()}P</span>
                </Link>
                <SignOutButton />
              </>
            ) : (
              <Link href="/signin" className="rounded-md bg-accent px-3 py-1.5 font-medium text-black">
                로그인
              </Link>
            )}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
