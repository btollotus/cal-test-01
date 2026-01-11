import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 서버에서만 사용
);

const MAX_RANK = 20;

function sanitizeName(input: string) {
  const noSpace = input.replace(/\s+/g, "");
  const only = noSpace.replace(/[^0-9A-Za-z가-힣_-]/g, "");
  return only.slice(0, 5);
}

function sanitizeGame(input: string) {
  // game은 영문/숫자/_-만 허용
  const only = String(input ?? "").replace(/[^0-9A-Za-z_-]/g, "");
  return only.slice(0, 20);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const game = sanitizeGame(url.searchParams.get("game") || "galaga");

  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game", game)                       // ✅ 갈라가만!
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_RANK);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r) => ({
    name: r.name,
    score: r.score,
    date: r.created_at,
  }));

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const game = sanitizeGame(body?.game || "galaga");
  const name = sanitizeName(body?.name ?? "");
  const score = Number(body?.score ?? NaN);

  if (!game || !name || !Number.isFinite(score) || score < 0) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  // 간단 치트 방지(너무 큰 점수 막기)
  if (score > 10_000_000) {
    return NextResponse.json({ ok: false, error: "score too large" }, { status: 400 });
  }

  const { error } = await supabase.from("scores").insert({ game, name, score });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
