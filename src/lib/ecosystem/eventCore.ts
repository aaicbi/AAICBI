import { z } from "zod";

const DAY = 24 * 3600 * 1000;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const EventSchema = z
  .object({
    title: z.string().trim().min(3, "Give the event a title.").max(120),
    description: optionalText(1000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    locationText: optionalText(160),
    registrationUrl: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), "The registration link must start with https://"),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, { message: "The event cannot end before it starts.", path: ["endsAt"] });

/** Upcoming = not yet over (an event with no end time stays listed for the day it starts). */
export function isUpcoming(e: { startsAt: Date; endsAt?: Date | null }, now = new Date()): boolean {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + DAY);
  return end.getTime() >= now.getTime();
}

/** New events must not be created in the past (a one-day grace for time zones). */
export function startsTooEarly(startsAt: Date, now = new Date()): boolean {
  return startsAt.getTime() < now.getTime() - DAY;
}
