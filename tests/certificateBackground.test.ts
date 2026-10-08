import { describe, expect, it } from "vitest";
import { CertificateLayoutSchema, pageSizeForImage } from "@/lib/certificateLayout";
import { validateCertificateBackgroundFile } from "@/lib/certificateBackground";

const base = { width: 1000, height: 700, backgroundColor: "#FFFFFF", elements: [] };

describe("uploaded certificate templates", () => {
  it("accepts only images this app stored", () => {
    const ok = "https://abc123.public.blob.vercel-storage.com/certificate-template-backgrounds/x.png";
    expect(CertificateLayoutSchema.safeParse({ ...base, backgroundImageUrl: ok }).success).toBe(true);
    expect(CertificateLayoutSchema.safeParse(base).success).toBe(true);
    for (const bad of ["https://evil.example.com/pixel.png", "http://abc.public.blob.vercel-storage.com/x.png", "javascript:alert(1)", "not a url"]) {
      expect(CertificateLayoutSchema.safeParse({ ...base, backgroundImageUrl: bad }).success, bad).toBe(false);
    }
  });

  it("fits the page to the picture without leaving the allowed range", () => {
    expect(pageSizeForImage(2000, 1000)).toEqual({ width: 1169, height: 585 });
    expect(pageSizeForImage(1000, 2000)).toEqual({ width: 585, height: 1169 });
    expect(pageSizeForImage(0, 0)).toEqual({ width: 1000, height: 700 });
    const thin = pageSizeForImage(10000, 100);
    expect(thin.height).toBeGreaterThanOrEqual(200);
  });

  it("takes pictures only, under the size limit", () => {
    expect(validateCertificateBackgroundFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateCertificateBackgroundFile({ type: "application/pdf", size: 1000 })).toMatch(/JPG, PNG, or WEBP/);
    expect(validateCertificateBackgroundFile({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10MB/);
  });
});
