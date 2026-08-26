"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Sign in as platform staff.
 *
 * Separate from the client login for two reasons, one of them a bug the client flow has for
 * this purpose: it requires an org membership, so an engineer who belongs to no client
 * cannot sign in at all. Staff are not tenants, and making someone a member of a customer's
 * organisation just to get a back-office login is the wrong shape — it also puts them in
 * that customer's portal.
 *
 * The other reason is plainer: the back office and the customer portal are different
 * products with different audiences, and sharing an entrance blurs which one you are in.
 */
export async function staffLogin(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = email
    ? await prisma.user.findUnique({
        where: { email },
        include: { memberships: { orderBy: { orgId: "asc" } } },
      })
    : null;

  // Password is verified before the staff check, and both failures return the same error.
  // Distinguishing "wrong password" from "not staff" would let anyone enumerate who has
  // back-office access by trying addresses.
  const passwordOk =
    user?.passwordHash != null && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !passwordOk || !user.isEngineer) redirect("/admin/login?error=1");

  // Staff need no membership. orgId stays empty when they have none, and every back-office
  // page queries across organisations rather than through the session's tenant.
  const membership = user.memberships[0];
  await createSession(
    {
      userId: user.id,
      orgId: membership?.orgId ?? "",
      role: membership?.role ?? "ENGINEER",
      email: user.email,
      engineer: true,
    },
    user.sessionEpoch,
  );
  redirect("/admin");
}
