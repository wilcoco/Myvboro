import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toE164(raw: string): string | null {
  // Accept Korean numbers in common formats and normalize to E.164.
  // 010-1234-5678 / 01012345678 / +82 10 1234 5678 -> +821012345678
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return "+82" + digits.slice(1);
  if (/^\d{8,15}$/.test(digits)) return "+" + digits;
  return null;
}

export function isoDayUTC(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
