import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { getQueueStatus } from "@/src/modules/battle";

// GET /api/battle/queue/status — polling leve enquanto espera pareamento
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getQueueStatus(session.user.id);
  return NextResponse.json(result);
}
