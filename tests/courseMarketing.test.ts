import { describe, it, expect } from "vitest";
import { buildMarketingView, type MarketingSourceCourse } from "@/lib/courseMarketing";

function baseCourse(overrides: Partial<MarketingSourceCourse> = {}): MarketingSourceCourse {
  return {
    id: "course-1",
    title: "Data Analytics",
    description: "Learn data analytics.",
    isFree: false,
    priceKobo: 10000,
    billingInterval: "MONTHLY",
    category: "Analytics",
    level: "BEGINNER",
    durationDisplay: "6 weeks",
    trainingFormat: "SELF_PACED",
    instructorNames: "Jane Doe",
    flyerUrl: "https://blob.example/flyer.png",
    curriculumUrl: "https://blob.example/curriculum.pdf",
    curriculumUploadedAt: "2026-01-01T00:00:00.000Z",
    skillsGained: ["Excel"],
    learningOutcomes: ["Build dashboards"],
    whatToExpect: ["Hands-on projects"],
    prerequisites: ["A laptop"],
    targetAudience: "Aspiring analysts",
    showFlyer: true,
    showCurriculumDownload: true,
    showWhatYoullLearn: true,
    showWhatToExpect: true,
    showRequirements: true,
    showAudience: true,
    showOutline: true,
    modules: [
      {
        id: "m1",
        title: "Module 1",
        lessons: [{ id: "l1", title: "Lesson 1" }],
      },
    ],
    // Coming Soon Courses
    startDate: null,
    endDate: null,
    registrationDeadline: null,
    locationType: null,
    venue: null,
    capacity: null,
    lifecyclePhaseOverride: null,
    _count: { courseEnrollments: 0 },
    ...overrides,
  };
}

describe("buildMarketingView", () => {
  it("passes through core fields and full outline when every toggle is on", () => {
    const view = buildMarketingView(baseCourse());
    expect(view.flyerUrl).toBe("https://blob.example/flyer.png");
    expect(view.curriculumUrl).toBe("https://blob.example/curriculum.pdf");
    expect(view.skillsGained).toEqual(["Excel"]);
    expect(view.learningOutcomes).toEqual(["Build dashboards"]);
    expect(view.whatToExpect).toEqual(["Hands-on projects"]);
    expect(view.prerequisites).toEqual(["A laptop"]);
    expect(view.targetAudience).toBe("Aspiring analysts");
    expect(view.modules).toEqual([{ id: "m1", title: "Module 1", lessons: [{ id: "l1", title: "Lesson 1" }] }]);
  });

  it("hides the flyer when showFlyer is off, independent of every other toggle", () => {
    const view = buildMarketingView(baseCourse({ showFlyer: false }));
    expect(view.flyerUrl).toBeNull();
    expect(view.modules.length).toBe(1); // outline unaffected
  });

  it("hides the curriculum when showCurriculumDownload is off", () => {
    const view = buildMarketingView(baseCourse({ showCurriculumDownload: false }));
    expect(view.curriculumUrl).toBeNull();
    expect(view.curriculumUploadedAt).toBeNull();
  });

  it("hides skills and learning outcomes together under showWhatYoullLearn", () => {
    const view = buildMarketingView(baseCourse({ showWhatYoullLearn: false }));
    expect(view.skillsGained).toEqual([]);
    expect(view.learningOutcomes).toEqual([]);
  });

  it("hides what-to-expect, requirements, and audience independently", () => {
    const view = buildMarketingView(baseCourse({ showWhatToExpect: false, showRequirements: false, showAudience: false }));
    expect(view.whatToExpect).toEqual([]);
    expect(view.prerequisites).toEqual([]);
    expect(view.targetAudience).toBeNull();
  });

  it("hides the entire outline when showOutline is off, independent of other toggles", () => {
    const view = buildMarketingView(baseCourse({ showOutline: false }));
    expect(view.modules).toEqual([]);
  });

  it("never includes module/lesson description or materials, since the source shape has none to leak", () => {
    const view = buildMarketingView(baseCourse());
    for (const m of view.modules) {
      expect(m).not.toHaveProperty("description");
      for (const l of m.lessons) {
        expect(l).not.toHaveProperty("description");
        expect(l).not.toHaveProperty("materials");
      }
    }
  });

  it("survives every toggle off at once without throwing, degrading to the bare minimum", () => {
    const view = buildMarketingView(
      baseCourse({
        showFlyer: false,
        showCurriculumDownload: false,
        showWhatYoullLearn: false,
        showWhatToExpect: false,
        showRequirements: false,
        showAudience: false,
        showOutline: false,
      })
    );
    expect(view.flyerUrl).toBeNull();
    expect(view.curriculumUrl).toBeNull();
    expect(view.skillsGained).toEqual([]);
    expect(view.learningOutcomes).toEqual([]);
    expect(view.whatToExpect).toEqual([]);
    expect(view.prerequisites).toEqual([]);
    expect(view.targetAudience).toBeNull();
    expect(view.modules).toEqual([]);
    // Core identity/pricing fields are never toggle-gated.
    expect(view.title).toBe("Data Analytics");
    expect(view.isFree).toBe(false);
  });

  it("computes lifecyclePhase from schedule fields, and null when no startDate is set", () => {
    const noSchedule = buildMarketingView(baseCourse());
    expect(noSchedule.lifecyclePhase).toBeNull();

    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const scheduled = buildMarketingView(baseCourse({ startDate: future, registrationDeadline: future }));
    expect(scheduled.lifecyclePhase).toBe("REGISTRATION_OPEN");
  });

  it("passes through enrolledCount from _count.courseEnrollments", () => {
    const view = buildMarketingView(baseCourse({ _count: { courseEnrollments: 7 } }));
    expect(view.enrolledCount).toBe(7);
  });
});
