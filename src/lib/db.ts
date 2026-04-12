import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

function makeClient() {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  // Resolve relative paths to absolute so the DB works regardless of cwd
  const url = raw.startsWith("file:./")
    ? `file:${require("path").resolve(process.cwd(), raw.slice(5))}`
    : raw;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
