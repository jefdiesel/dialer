"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { stripe, AUDIT_PRICE_CENTS } from "@/lib/stripe";

function getOrigin(): string {
  // Allow override for the production deploy via env, fall back to the
  // request's origin so local dev works without config.
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  );
}

export async function createCheckoutSession(formData: FormData) {
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  if (!customerEmail || !customerName || !businessName) {
    throw new Error("name, business name, and email are all required");
  }

  const origin = getOrigin();

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: AUDIT_PRICE_CENTS,
          product_data: {
            name: "AI Audit",
            description:
              "4-page written report on 3 ways AI could save your business real money. 48-hour delivery. Full refund if not worth $10k/year.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/audit/upload/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/audit?canceled=1`,
    metadata: {
      customerName,
      businessName,
    },
  });

  // Pre-create the AuditOrder so the upload page can verify it exists even
  // if the webhook hasn't fired yet (Stripe usually delivers within seconds
  // but races are possible).
  await prisma.auditOrder.create({
    data: {
      stripeSessionId: session.id,
      customerEmail,
      customerName,
      businessName,
      amountCents: AUDIT_PRICE_CENTS,
      status: "pending",
    },
  });

  if (!session.url) throw new Error("Stripe didn't return a checkout URL");
  redirect(session.url);
}

export async function acceptNdaAndUpload(
  sessionId: string,
  formData: FormData,
) {
  const ndaAccepted = formData.get("nda") === "on";
  if (!ndaAccepted) throw new Error("you must accept the NDA to upload");

  const order = await prisma.auditOrder.findUnique({
    where: { stripeSessionId: sessionId },
  });
  if (!order) throw new Error("order not found");
  if (order.status === "pending") {
    throw new Error("payment has not been confirmed yet — try again in 30 seconds");
  }

  // Files arrive as File entries on the FormData. We persist filenames + sizes
  // to the order; the actual files get written to disk under
  // /tmp/dialer-uploads/<orderId>/ for the consultant to grab.
  const files = formData.getAll("files");
  const fileMeta: Array<{ name: string; size: number; type: string }> = [];

  if (files.length > 0) {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const uploadDir = path.join("/tmp", "dialer-uploads", order.id);
    await mkdir(uploadDir, { recursive: true });

    for (const f of files) {
      if (!(f instanceof File) || f.size === 0) continue;
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const buf = Buffer.from(await f.arrayBuffer());
      await writeFile(path.join(uploadDir, safeName), buf);
      fileMeta.push({ name: f.name, size: f.size, type: f.type });
    }
  }

  // Also collect any free-text fields
  const notes = String(formData.get("notes") ?? "").trim();

  const ipHeader =
    (await headers()).get("x-forwarded-for") ??
    (await headers()).get("x-real-ip") ??
    null;

  await prisma.auditOrder.update({
    where: { id: order.id },
    data: {
      status: "uploaded",
      ndaAcceptedAt: new Date(),
      ndaIp: ipHeader,
      uploadedAt: new Date(),
      uploadedFiles: JSON.stringify(fileMeta),
      notes: notes || null,
    },
  });

  revalidatePath(`/audit/upload/${sessionId}`);
  redirect(`/audit/done/${sessionId}`);
}
