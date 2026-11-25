import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

// Receives expense submissions from the intranet (kindred-site-system
// plugin). Authenticated by an HMAC-SHA256 signature over the raw body
// with the shared INTRANET_WEBHOOK_SECRET.

function signatureValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.INTRANET_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(header, "hex");
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!signatureValid(rawBody, request.headers.get("x-kss-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    source_id?: number;
    name?: string;
    email?: string;
    phone?: string;
    description?: string;
    amount?: number;
    receipt_urls?: string[];
    submitted_at?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const sourceId = Number(payload.source_id);
  const amount = Number(payload.amount);
  if (
    !Number.isInteger(sourceId) ||
    sourceId <= 0 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 100_000 ||
    !payload.name ||
    !payload.email ||
    !payload.description
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("reimbursements").upsert(
    {
      source_id: sourceId,
      name: String(payload.name).slice(0, 200),
      email: String(payload.email).toLowerCase().slice(0, 200),
      phone: payload.phone ? String(payload.phone).slice(0, 50) : null,
      description: String(payload.description).slice(0, 2000),
      amount: Math.round(amount * 100) / 100,
      receipt_urls: Array.isArray(payload.receipt_urls)
        ? payload.receipt_urls.slice(0, 20).map((u) => String(u).slice(0, 500))
        : [],
      submitted_at: payload.submitted_at ?? new Date().toISOString(),
    },
    { onConflict: "source_id", ignoreDuplicates: false }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit("system", "reimbursement.received", {
    source_id: sourceId,
    name: payload.name,
    amount,
  });

  return NextResponse.json({ ok: true });
}
