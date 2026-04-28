import { PrismaClient } from '@prisma/client'

/** Singleton Prisma client. Import this instead of constructing `new PrismaClient()` per file to avoid connection storms. */
export const prisma = new PrismaClient()
