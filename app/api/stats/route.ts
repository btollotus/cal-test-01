import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function GET() {
  const tKey = `visits:${todayKey()}`;
  const zKey = `active:${todayKey()}`;

  const now = Date.now();
  const cutoff = now - 60_000;

  // 오래된 활성 세션 제거 후 카운트
  await redis.zremrangebyscore(zKey, 0, cutoff);

  const [visits, active] = await Promise.all([
    redis.get<number>(tKey).then((v) => v ?? 0),
    redis.zcard(zKey).then((v) => v ?? 0),
  ]);

  return NextResponse.json({ visitsToday: visits, activeNow: active });
}
