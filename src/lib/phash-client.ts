// Browser-only counterpart to lib/phash.ts. Computes a 64-bit dHash
// (9×8 grayscale → compare horizontal neighbors → pack to 16 hex chars).

export async function computeDhash(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    const img = ctx.getImageData(0, 0, 9, 8);
    const grays: number[] = [];
    for (let i = 0; i < img.data.length; i += 4) {
      grays.push(
        0.299 * img.data[i]! +
          0.587 * img.data[i + 1]! +
          0.114 * img.data[i + 2]!,
      );
    }
    const bits: number[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        bits.push(grays[y * 9 + x]! > grays[y * 9 + x + 1]! ? 1 : 0);
      }
    }
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      const n =
        (bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!;
      hex += n.toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}
