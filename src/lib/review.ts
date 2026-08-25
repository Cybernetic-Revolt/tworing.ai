// Review-request engine (Operations tier): when an appointment is completed,
// text the customer a Google-review link — once per customer per 90 days,
// only with consent and only if the org enabled it. (spec §4.8)
import { prisma } from "@/lib/db";
import { sendSmsToCustomer } from "@/lib/sms";

const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000;

export async function maybeSendReviewRequest(appointmentId: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { org: true },
  });
  if (!appt || !appt.customerPhone) return;
  const org = appt.org;
  if (!org.reviewRequests || !org.googleReviewUrl) return;

  // Once per customer per 90 days.
  const recent = await prisma.message.findFirst({
    where: {
      orgId: org.id,
      template: "review-request",
      toAddress: appt.customerPhone,
      createdAt: { gte: new Date(Date.now() - NINETY_DAYS_MS) },
    },
  });
  if (recent) return;

  await sendSmsToCustomer({
    orgId: org.id,
    toE164: appt.customerPhone,
    body: `Thanks for choosing ${org.name}! If we did a great job, a quick review means the world: ${org.googleReviewUrl}`,
    template: "review-request",
    appointmentId: appt.id,
  });
}
