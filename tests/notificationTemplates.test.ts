import { describe, it, expect } from "vitest";
import { welcomeEmail, passwordResetEmail, moduleUnlockedEmail, assessmentResultEmail } from "@/lib/notifications/templates";

describe("welcomeEmail", () => {
  it("includes the verify URL in both html and text", () => {
    const result = welcomeEmail("Amaka", "https://example.com/trainee/verify?token=abc123");
    expect(result.html).toContain("https://example.com/trainee/verify?token=abc123");
    expect(result.text).toContain("https://example.com/trainee/verify?token=abc123");
  });

  it("includes the trainee's name", () => {
    const result = welcomeEmail("Amaka", "https://example.com/verify");
    expect(result.html).toContain("Amaka");
    expect(result.text).toContain("Amaka");
  });

  it("escapes HTML in the name so it can't break the email markup", () => {
    const result = welcomeEmail("<script>alert(1)</script>", "https://example.com/verify");
    expect(result.html).not.toContain("<script>alert(1)</script>");
    expect(result.html).toContain("&lt;script&gt;");
  });

  it("escapes single quotes too (M14 audit fix — a landmine for a future single-quoted attribute)", () => {
    const result = welcomeEmail("O'Brien", "https://example.com/verify");
    expect(result.html).not.toContain("O'Brien");
    expect(result.html).toContain("O&#39;Brien");
  });

  it("has a non-empty subject", () => {
    expect(welcomeEmail("Amaka", "https://example.com").subject.length).toBeGreaterThan(0);
  });
});

describe("passwordResetEmail", () => {
  it("includes the reset URL for both staff and trainee variants", () => {
    const staff = passwordResetEmail("staff", "https://example.com/admin/reset-password?token=xyz");
    const trainee = passwordResetEmail("trainee", "https://example.com/trainee/reset-password?token=xyz");
    expect(staff.html).toContain("https://example.com/admin/reset-password?token=xyz");
    expect(trainee.html).toContain("https://example.com/trainee/reset-password?token=xyz");
  });

  it("subjects differ between staff and trainee variants", () => {
    const staff = passwordResetEmail("staff", "https://example.com");
    const trainee = passwordResetEmail("trainee", "https://example.com");
    expect(staff.subject).not.toBe(trainee.subject);
  });
});

describe("moduleUnlockedEmail", () => {
  it("names the course, the next module, and includes the course URL", () => {
    const result = moduleUnlockedEmail("Chidi", "Excel for Data Analytics", "Week 2 — Formulas", "https://example.com/trainee/courses/c1");
    expect(result.html).toContain("Excel for Data Analytics");
    expect(result.html).toContain("Week 2 — Formulas");
    expect(result.html).toContain("https://example.com/trainee/courses/c1");
    expect(result.text).toContain("Week 2 — Formulas");
  });
});

describe("assessmentResultEmail", () => {
  const base = {
    traineeName: "Ngozi",
    examTitle: "Week 1 Assessment",
    score: 8,
    totalQuestions: 10,
    percentage: 80,
    passed: true,
    passMarkPercent: 70,
    courseUrl: "https://example.com/trainee/courses/c1",
  };

  it("includes score, percentage, and pass mark", () => {
    const result = assessmentResultEmail(base);
    expect(result.html).toContain("8");
    expect(result.html).toContain("10");
    expect(result.html).toContain("80");
    expect(result.html).toContain("70");
  });

  it("says something different for a pass vs a fail", () => {
    const passed = assessmentResultEmail({ ...base, passed: true });
    const failed = assessmentResultEmail({ ...base, passed: false });
    expect(passed.html).not.toBe(failed.html);
  });

  it("omits the performance-summary section entirely when there isn't one", () => {
    const result = assessmentResultEmail({ ...base, performanceSummary: null });
    expect(result.html).not.toContain("HOW YOU DID BY TOPIC");
    expect(result.text).not.toContain("How you did by topic");
  });

  it("includes the performance-summary narrative when one is provided", () => {
    const result = assessmentResultEmail({
      ...base,
      performanceSummary: { strengths: ["Formulas"], weaknesses: ["Pivot Tables"], narrative: "You did well overall." },
    });
    expect(result.html).toContain("You did well overall.");
    expect(result.text).toContain("You did well overall.");
  });
});
