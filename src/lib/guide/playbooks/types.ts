/**
 * A step-by-step guide Loop walks someone through, one step at a time.
 * Written from the real screens: every **bold** phrase in a step is a
 * label that appears in the interface, and a test checks that each one
 * still exists in the code, so a renamed button fails a test instead of
 * quietly leaving the guide wrong.
 */
export interface PlaybookStep {
  title: string;
  /** What to do. Wrap exact interface labels in **double asterisks**. */
  text: string;
  /** The page this step happens on. Must be a real route (a test checks). */
  href?: string;
  hrefLabel?: string;
  /** A short extra note: a limit, a common slip, what happens next. */
  tip?: string;
}

export interface Playbook {
  id: string;
  /** What someone would ask, shown as the guide's name. */
  title: string;
  /** The question this guide answers; it is added to the guide's questions. */
  question: string;
  /** One or two sentences said before the steps start. */
  summary: string;
  keywords: string[];
  steps: PlaybookStep[];
  /** Guides worth doing after this one. */
  next?: string[];
}
