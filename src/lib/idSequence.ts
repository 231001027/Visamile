import { prisma } from "./prisma";

/** Atomically increments a named sequence and returns the new value. */
export async function nextSequenceValue(name: string): Promise<number> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.idSequence.findUnique({ where: { name } });
    if (existing) {
      return tx.idSequence.update({
        where: { name },
        data: { value: { increment: 1 } },
      });
    }
    return tx.idSequence.create({ data: { name, value: 1 } });
  });
  return row.value;
}
