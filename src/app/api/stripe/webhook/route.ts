// Stripe webhook handler. Marks AuditOrders as paid when the corresponding
// checkout session completes. Add the endpoint URL to your Stripe dashboard:
//   https://YOUR-DOMAIN/api/stripe/webhook
// then copy the signing secret into STRIPE_WEBHOOK_SECRET in .env.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json(
      { error: "missing signature or webhook secret" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("stripe webhook signature failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const sessionId: string = session.id;
      const paymentIntent: string | null = session.payment_intent ?? null;

      await prisma.auditOrder.updateMany({
        where: { stripeSessionId: sessionId, status: "pending" },
        data: {
          status: "paid",
          paidAt: new Date(),
          stripePaymentIntent: paymentIntent,
        },
      });
      console.log(`[stripe] order paid: ${sessionId}`);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as any;
      const piId: string | null = charge.payment_intent ?? null;
      if (piId) {
        await prisma.auditOrder.updateMany({
          where: { stripePaymentIntent: piId },
          data: { status: "refunded" },
        });
        console.log(`[stripe] order refunded: ${piId}`);
      }
      break;
    }
    default:
      // ignore other events
      break;
  }

  return NextResponse.json({ received: true });
}
