import { gradeItem, serveItem, type ItemContent, type ItemFormat, type MatchingContent, type OrderingContent, type ScenarioContent } from "@/lib/quest/games";
import type { PlayFormat, PlayItem, PlayResult, PlayerApi } from "@/components/games/GamePlayer";

/**
 * Sample games for the demo page: ten items in each of the four formats, about everyday AI automation. They exist so staff can see
 * and feel a round without building anything. Nothing is saved and no XP is paid. Matching, ordering and scenarios are graded by the
 * same functions the server uses; the quiz is graded here the same way (the chosen key against the right one).
 */

interface DemoQuiz {
  question: string;
  options: string[];
  right: number;
  explanation: string;
}

const m = (prompt: string, pairs: [string, string][]): MatchingContent => ({ prompt, pairs: pairs.map(([left, right]) => ({ left, right })) });
const o = (prompt: string, steps: string[]): OrderingContent => ({ prompt, steps });
const sc = (situation: string, options: [string, string, boolean][]): ScenarioContent => ({ situation, options: options.map(([text, outcome, correct]) => ({ text, outcome, correct })) });

const QUIZ: DemoQuiz[] = [
  { question: "What is an automation trigger?", options: ["The event that starts a workflow", "The last step of a workflow", "A report about errors", "A password for a tool"], right: 0, explanation: "A trigger is the event that starts the workflow, such as a new email or a form being submitted." },
  { question: "Which task is the best first candidate for automation?", options: ["A rare task that needs careful judgement", "A repetitive task done the same way every time", "A task nobody understands", "A task that changes every week"], right: 1, explanation: "Repetitive, rule-based tasks are where automation saves the most time with the least risk." },
  { question: "A workflow copies new form entries into a spreadsheet. What is the action?", options: ["The form being submitted", "Adding the row to the spreadsheet", "Opening the spreadsheet", "Reading the entries"], right: 1, explanation: "The submission is the trigger. Adding the row is the action the workflow takes." },
  { question: "Why should you test a workflow with sample data first?", options: ["To make it run faster", "To catch mistakes before real people are affected", "Because tools require it", "To use up free credits"], right: 1, explanation: "Testing with sample data finds mistakes while they are still harmless." },
  { question: "What does 'human in the loop' mean?", options: ["A person reviews or approves key steps", "Everything runs without anyone watching", "Only humans can build workflows", "A workflow repeats forever"], right: 0, explanation: "It means a person checks or approves important steps instead of leaving everything to the machine." },
  { question: "An AI assistant drafts a customer reply. What should happen before it is sent?", options: ["Nothing, send it straight away", "A person checks it for accuracy and tone", "It is translated twice", "It is deleted"], right: 1, explanation: "AI drafts can contain errors, so a person should check accuracy and tone before sending." },
  { question: "Which is a sign a workflow needs fixing?", options: ["It runs on time", "It keeps failing on the same step", "It saves time", "It has a clear name"], right: 1, explanation: "A step that fails again and again points to a problem to find and fix." },
  { question: "What is a good way to keep personal data safe in an automation?", options: ["Send it to as many tools as possible", "Share only what each step needs", "Put it in the workflow name", "Email it to the whole team"], right: 1, explanation: "Sharing only the data each step needs keeps risk low." },
  { question: "What makes a prompt for an AI tool clearer?", options: ["Being vague so it can be creative", "Saying the goal, the context and the format you want", "Using as few words as possible", "Writing it in capital letters"], right: 1, explanation: "A clear goal, helpful context and the format you want give the tool much more to work with." },
  { question: "How do you know an automation is worth keeping?", options: ["It looks impressive", "It reliably saves time or reduces mistakes", "It uses many tools", "It was hard to build"], right: 1, explanation: "Worth is measured by reliable results: time saved or mistakes avoided." },
];

const MATCHING: MatchingContent[] = [
  m("Match each term to its meaning.", [["Trigger", "The event that starts a workflow"], ["Action", "A step the workflow carries out"], ["Workflow", "A chain of steps that runs on its own"], ["Prompt", "The instruction you give an AI tool"]]),
  m("Match each tool type to its job.", [["Spreadsheet", "Stores rows of data"], ["Form", "Collects answers from people"], ["Chatbot", "Answers questions in conversation"], ["Calendar", "Tracks dates and bookings"]]),
  m("Match each task to the automation that suits it.", [["New sign-up arrives", "Send a welcome message"], ["Invoice is paid", "Update the payment record"], ["File is uploaded", "Sort it into the right folder"], ["Weekly deadline", "Send a reminder"]]),
  m("Match each word to its meaning.", [["Input", "What goes into a step"], ["Output", "What comes out of a step"], ["Error", "A step that did not work"], ["Log", "A record of what happened"]]),
  m("Match each risk to a safeguard.", [["Wrong answer from AI", "A person reviews it"], ["Private data leaking", "Share only what is needed"], ["Workflow keeps failing", "Check the log"], ["Unexpected change", "Test with sample data first"]]),
  m("Match each AI skill to an example.", [["Summarising", "Turning a long report into key points"], ["Drafting", "Writing a first version of an email"], ["Classifying", "Sorting messages by topic"], ["Translating", "Changing a message into another language"]]),
  m("Match each role to what it does.", [["Builder", "Sets up the workflow"], ["Reviewer", "Checks the output"], ["Owner", "Decides what should be automated"], ["User", "Relies on the result"]]),
  m("Match each measure to what it tells you.", [["Time saved", "How much work it removed"], ["Error rate", "How often it goes wrong"], ["Run count", "How often it ran"], ["Feedback", "What people think of it"]]),
  m("Match each step to its purpose.", [["Plan", "Decide what to automate"], ["Build", "Create the steps"], ["Test", "Check it works"], ["Improve", "Fix and refine it"]]),
  m("Match each prompt part to its role.", [["Goal", "What you want done"], ["Context", "Background the tool needs"], ["Format", "How the answer should look"], ["Example", "A sample of what good looks like"]]),
];

const ORDERING: OrderingContent[] = [
  o("Put the steps of building a workflow in order.", ["Choose a repetitive task", "Describe the steps on paper", "Build the workflow", "Test it with sample data", "Turn it on and watch the first runs"]),
  o("Put the steps of writing a good prompt in order.", ["Decide what you want", "Add the background", "Say how the answer should look", "Read the answer", "Improve the prompt and try again"]),
  o("Put the steps of handling a failed run in order.", ["Notice the failure", "Open the log", "Find the step that failed", "Fix the cause", "Run it again to confirm"]),
  o("Put the steps of an automated welcome email in order.", ["A person signs up", "The workflow starts", "The details are checked", "The email is prepared", "The email is sent"]),
  o("Put the steps of checking an AI draft in order.", ["Read the whole draft", "Check the facts", "Check the tone", "Fix anything that is wrong", "Approve it"]),
  o("Put the steps of choosing what to automate in order.", ["List your regular tasks", "Mark the repetitive ones", "Check the risks", "Pick the best first one", "Plan how to measure it"]),
  o("Put the steps of protecting personal data in order.", ["Find where the data goes", "Remove what is not needed", "Limit who can see the rest", "Test the workflow", "Review it regularly"]),
  o("Put the steps of rolling out a new automation in order.", ["Try it with a small group", "Collect their feedback", "Fix problems", "Share it with everyone", "Keep measuring the results"]),
  o("Put the steps of reviewing a workflow in order.", ["Check what it was meant to do", "Look at recent runs", "Count the errors", "Decide what to change", "Make the change"]),
  o("Put the steps of a monthly report automation in order.", ["The month ends", "Data is collected", "Totals are calculated", "The report is drafted", "A person approves it", "It is sent to the team"]),
];

const SCENARIO: ScenarioContent[] = [
  sc("Your workflow sent the same email to a customer three times.", [["Switch it off, check the log and fix the cause", "Good. Stopping it limits the harm, and the log shows why it repeated.", true], ["Leave it and hope it stops", "It will probably keep repeating and annoy more customers.", false], ["Delete the whole workflow", "That loses the work and the cause stays unknown.", false]]),
  sc("An AI tool drafted a reply that quotes a price you don't recognise.", [["Send it, the tool is usually right", "A wrong price could cost you the customer's trust.", false], ["Check the price against the real price list before sending", "Good. Facts in an AI draft always need checking.", true]]),
  sc("A colleague asks you to automate a task that happens once a year.", [["Build it straight away", "The time spent building may never be earned back.", false], ["Suggest a checklist instead and automate something regular", "Good. Rare tasks rarely repay the effort of automating them.", true], ["Refuse to help", "Unhelpful. A simple checklist could still help them.", false]]),
  sc("Your new workflow passed its test, but the test used only one example.", [["Test a few more varied examples before turning it on", "Good. Different inputs reveal problems one example can't.", true], ["Turn it on for everyone now", "A problem with unusual input would reach real people.", false]]),
  sc("A form collects phone numbers, but the workflow doesn't need them.", [["Keep collecting them just in case", "Collecting data you don't need adds risk for no benefit.", false], ["Remove the phone number field from the form and workflow", "Good. Share and keep only what each step needs.", true], ["Send them to every tool in the workflow", "That spreads personal data further than needed.", false]]),
  sc("Your automation saves ten minutes a week but takes an hour to fix each month.", [["Review whether it is still worth keeping", "Good. Worth means the time saved is greater than the effort spent.", true], ["Keep it, automations are always worth it", "Not always. Count what it saves and what it costs.", false]]),
  sc("Your manager wants an AI tool to send replies with nobody checking.", [["Agree, it will save the most time", "It saves time but risks sending errors to customers.", false], ["Suggest a person approves replies at first, then review how it goes", "Good. A human in the loop builds trust before loosening checks.", true], ["Say AI can't be trusted at all", "Too absolute. Careful use with checks can work well.", false]]),
  sc("A teammate shares a workflow that no one else understands.", [["Ask them to name the steps clearly and write a short guide", "Good. A workflow others can read can be kept running.", true], ["Keep using it without understanding it", "If it breaks, nobody will know how to fix it.", false]]),
  sc("The log shows a step fails whenever a name has an apostrophe.", [["Ignore it, it is rare", "It will keep failing for those people.", false], ["Find the step, fix how it handles apostrophes and test it", "Good. A repeated pattern in the log points to a fixable cause.", true]]),
  sc("You want to ask an AI tool for help but you're not sure how to phrase it.", [["Say what you want, give some background and say how you want the answer", "Good. A clear goal, context and format get a better answer.", true], ["Type a single word", "One word gives the tool too little to work with.", false], ["Paste in private customer details", "Private details should not go into a tool unless it is approved for that.", false]]),
];

const CONTENT: Record<Exclude<PlayFormat, "QUIZ">, ItemContent[]> = { MATCHING, ORDERING, SCENARIO };

export const DEMO_FORMATS: { format: PlayFormat; label: string; blurb: string }[] = [
  { format: "QUIZ", label: "Quiz", blurb: "Pick the best answer from the options." },
  { format: "MATCHING", label: "Matching", blurb: "Match each term to its meaning." },
  { format: "ORDERING", label: "Ordering", blurb: "Put the steps in the right order." },
  { format: "SCENARIO", label: "Scenario", blurb: "Choose what you would do in a short case." },
];

export const DEMO_COUNT = 10;

/** A player that serves the ten samples of a format in a fresh order and grades them in the browser. Nothing is recorded. */
export function createDemoApi(format: PlayFormat, shuffle: <T>(a: readonly T[]) => T[]): PlayerApi {
  const size = format === "QUIZ" ? QUIZ.length : CONTENT[format].length;
  let order = shuffle(Array.from({ length: size }, (_, i) => i));
  let cursor = 0;
  let serial = 0;
  const served = new Map<string, { index: number; options?: string[] }>();

  return {
    async next() {
      if (cursor >= order.length) {
        order = shuffle(order);
        cursor = 0;
      }
      const index = order[cursor++];
      const playId = `demo-${format}-${index}-${serial++}`;
      if (format === "QUIZ") {
        const q = QUIZ[index];
        const options = shuffle(q.options.map((text, i) => ({ text, right: i === q.right })));
        const keyed = options.map((x, i) => ({ key: String.fromCharCode(65 + i), text: x.text }));
        served.set(playId, { index, options: options.map((x) => (x.right ? "1" : "0")) });
        const item: PlayItem = { playId, format, objective: "AI automation basics", served: { format, question: q.question, options: keyed } };
        return { item };
      }
      const content = CONTENT[format][index];
      served.set(playId, { index });
      const item: PlayItem = { playId, format, objective: "AI automation basics", served: serveItem(format as ItemFormat, content, shuffle) };
      return { item };
    },
    async answer(item, response) {
      const entry = served.get(item.playId);
      if (!entry) return { error: "That question is no longer available." };
      if (format === "QUIZ") {
        const choice = (response as { choice?: string } | null)?.choice;
        const q = QUIZ[entry.index];
        const idx = choice ? choice.charCodeAt(0) - 65 : -1;
        const flags = entry.options ?? [];
        if (idx < 0 || idx >= flags.length) return { error: "Choose an answer first." };
        const correctKey = String.fromCharCode(65 + flags.indexOf("1"));
        const ok = flags[idx] === "1";
        const result: PlayResult = { score: ok ? 1 : 0, correct: ok, feedback: { correctOptionKey: correctKey, explanation: q.explanation } };
        return { result };
      }
      const graded = gradeItem(format as ItemFormat, CONTENT[format][entry.index], response);
      if (!graded) return { error: "Finish your answer first." };
      return { result: { score: graded.score, correct: graded.correct, feedback: graded.feedback } };
    },
  };
}
