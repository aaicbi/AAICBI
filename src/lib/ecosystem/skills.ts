import type { Prisma } from "@prisma/client";

/**
 * Finds a skill by name ignoring case, or creates it. The Skill table is
 * shared with trainee profiles and job postings, so "python" and "Python"
 * must resolve to one row or matching between them silently fails.
 */
export async function ensureSkill(tx: Prisma.TransactionClient, name: string) {
  const existing = await tx.skill.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  return existing ?? tx.skill.create({ data: { name } });
}
