import { Router, raw } from "express";
import { Webhook } from "svix";
import { prisma } from "@cramr/db";

export const webhooksRouter = Router();

webhooksRouter.post("/clerk", raw({ type: "*/*" }), async (req, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "webhook_not_configured" });

  const svixId = req.header("svix-id");
  const svixTs = req.header("svix-timestamp");
  const svixSig = req.header("svix-signature");
  if (!svixId || !svixTs || !svixSig) {
    return res.status(400).json({ error: "missing_svix_headers" });
  }

  let evt: {
    type: string;
    data: {
      id: string;
      email_addresses?: Array<{ email_address: string }>;
      first_name?: string | null;
      last_name?: string | null;
      image_url?: string | null;
    };
  };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(req.body as Buffer, {
      "svix-id": svixId,
      "svix-timestamp": svixTs,
      "svix-signature": svixSig,
    }) as typeof evt;
  } catch (err) {
    console.error("[webhook] verify failed", err);
    return res.status(400).json({ error: "invalid_signature" });
  }

  const { type, data } = evt;
  const email = data.email_addresses?.[0]?.email_address;
  const displayName =
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    email?.split("@")[0] ||
    "user";

  if (type === "user.created" || type === "user.updated") {
    if (!email) return res.status(400).json({ error: "missing_email" });
    await prisma.user.upsert({
      where: { clerkId: data.id },
      update: { email, displayName, avatarUrl: data.image_url ?? null },
      create: {
        clerkId: data.id,
        email,
        displayName,
        avatarUrl: data.image_url ?? null,
      },
    });
  } else if (type === "user.deleted") {
    await prisma.user.deleteMany({ where: { clerkId: data.id } });
  }

  res.json({ ok: true });
});
