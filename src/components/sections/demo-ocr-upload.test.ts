import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "demo-ocr-upload.tsx"), "utf8");
const illustration = resolve(process.cwd(), "public/illustrations/demo-ocr-trial-complete.webp");

describe("DemoOcrUpload sınır durumu", () => {
  test("otomotiv illüstrasyonunu dekoratif ve duyarlı olarak sunar", () => {
    expect(readFileSync(illustration).byteLength).toBeGreaterThan(10_000);
    expect(source).toContain('src="/illustrations/demo-ocr-trial-complete.webp"');
    expect(source).toContain('alt=""');
    expect(source).toContain('sizes="(max-width: 1023px) 90vw, 42vw"');
  });
});
