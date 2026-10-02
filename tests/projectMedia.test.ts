import { describe, it, expect } from "vitest";
import { validateProjectMediaFile, MAX_MEDIA_PER_PROJECT } from "../src/lib/projectMedia";

describe("validateProjectMediaFile", () => {
  it("accepts a JPEG under 5MB as IMAGE", () => {
    expect(validateProjectMediaFile({ type: "image/jpeg", size: 1024 })).toEqual({ type: "IMAGE" });
  });

  it("accepts PNG and WEBP", () => {
    expect(validateProjectMediaFile({ type: "image/png", size: 1024 })).toEqual({ type: "IMAGE" });
    expect(validateProjectMediaFile({ type: "image/webp", size: 1024 })).toEqual({ type: "IMAGE" });
  });

  it("rejects an image over 5MB", () => {
    const result = validateProjectMediaFile({ type: "image/jpeg", size: 6 * 1024 * 1024 });
    expect(result).toEqual({ error: "Images must be under 5MB." });
  });

  it("accepts an MP4 under 20MB as VIDEO", () => {
    expect(validateProjectMediaFile({ type: "video/mp4", size: 10 * 1024 * 1024 })).toEqual({ type: "VIDEO" });
  });

  it("accepts WEBM video", () => {
    expect(validateProjectMediaFile({ type: "video/webm", size: 1024 })).toEqual({ type: "VIDEO" });
  });

  it("rejects a video over 20MB", () => {
    const result = validateProjectMediaFile({ type: "video/mp4", size: 21 * 1024 * 1024 });
    expect(result).toEqual({ error: "Videos must be under 20MB." });
  });

  it("rejects an unsupported file type", () => {
    const result = validateProjectMediaFile({ type: "application/pdf", size: 1024 });
    expect(result).toEqual({ error: "Only JPG, PNG, WEBP images or MP4/WEBM videos are allowed." });
  });

  it("caps media per project at 5", () => {
    expect(MAX_MEDIA_PER_PROJECT).toBe(5);
  });
});
