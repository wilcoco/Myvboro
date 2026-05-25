import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="text-6xl">404</div>
      <p className="mt-3 text-muted">없는 페이지입니다.</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-black">
        홈으로
      </Link>
    </div>
  );
}
