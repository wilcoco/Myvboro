// 64-bit dHash represented as 16 lowercase hex chars. Used to flag
// "same storefront photographed twice" → same Place, even if GPS spreads.
// Pure utilities — no DOM, safe to import from server code.
//
// Hamming-distance interpretation (rough):
//   0..4   nearly identical (resized / lightly cropped)
//   5..10  same subject, different angle / lighting
//   11..16 plausible match
//   >16    unrelated

export const PHASH_HEX_LEN = 16;
export const PHASH_HEX_RE = /^[0-9a-f]{16}$/;

const POPCOUNT_4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let h = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    h += POPCOUNT_4[x]!;
  }
  return h;
}
