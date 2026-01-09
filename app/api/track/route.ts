import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function POST(req: Request) {
  const { sid } = await req.json();
  if (!sid) return NextResponse.json({ ok: false }, { status: 400 });

  const tKey = `visits:${todayKey()}`;
  const zKey = `active:${todayKey()}`;
  const now = Date.now();
  const cutoff = now - 60_000; // 최근 60초만 "현재 접속"

  // 오늘 페이지뷰(접속수) 누적
  await redis.incr(tKey);
  await redis.expire(tKey, 60 * 60 * 24 * 2);

  // 현재 접속자(heartbeat) 갱신
  await redis.zadd(zKey, { score: now, member: sid });
  await redis.zremrangebyscore(zKey, 0, cutoff);
  await redis.expire(zKey, 60 * 60 * 24 * 2);

  return NextResponse.json({ ok: true });
}
