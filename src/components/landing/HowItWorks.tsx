import { EmployerScene, LearningScene, WorkshopScene } from "@/components/landing/art/Scenes";

const STEPS = [
  {
    title: "Learn",
    text: "Trainees join structured programs from training organizations, with assessments, feedback after every attempt, and certificates anyone can verify.",
    scene: <LearningScene className="h-full w-full" label="Illustration: an instructor presenting a chart to trainees working at laptops" />,
  },
  {
    title: "Build and share",
    text: "They work on real projects and, if they choose, present what they learned in short videos published by their organization.",
    scene: <WorkshopScene className="h-full w-full" label="Illustration: a team working together around a table with notes on the wall" />,
  },
  {
    title: "Get discovered",
    text: "Employers and organizations find people by skills, post roles, and reach out. Contact details are only shared when a trainee agrees.",
    scene: <EmployerScene className="h-full w-full" label="Illustration: an employer and a trainee shaking hands in an office" />,
  },
];

/** The ecosystem in three steps, drawn. The pictures are illustrations and are described as such. */
export default function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-t border-brand-gray bg-brand-mint/30">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h2 id="how-heading" className="font-display text-2xl font-semibold text-brand-ink">
          How the ecosystem works
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="overflow-hidden rounded-2xl border border-brand-gray bg-brand-surface">
              <div className="aspect-[3/2] w-full overflow-hidden bg-brand-mint">{s.scene}</div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-teal">Step {i + 1}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-brand-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
