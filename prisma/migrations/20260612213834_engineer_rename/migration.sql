-- Data-preserving rename: the platform-operator flag becomes isEngineer
-- (replaces Prisma's generated drop+add, which would lose who has the flag).
ALTER TABLE "User" RENAME COLUMN "isSuperadmin" TO "isEngineer";
