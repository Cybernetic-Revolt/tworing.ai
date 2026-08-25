-- Public marketing signups (sales-led onboarding queue).
CREATE TABLE "Signup" (
    "id" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "trade" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Signup_createdAt_idx" ON "Signup"("createdAt");
