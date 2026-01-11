import { NextResponse } from "next/server";

const MAX_RANK = 20;
const MAX_NAME_LEN = 10;

/**
 * ✅ 이름 규칙 (서버 최종 기준)
 * - 공백 제거
 * - 항상 대문자로 저장
 * - 허용: A-Z, 0-9, 한글(가-힣), 그리고 아래 특수문자
 *   _ - . ! @ # $ % ^ & * ( ) + = { } [ ] ? / : ; , ~
 *
 * ※ 필요하면 허용 문자 더 늘릴 수 있음.
 */
function sanitizeName(input: string) {
  const noSpace = String(input ?? "").replace(/\s+/g, "");
  const upper = noSpace.toUpperCase();

  // 허용: 0-9, A-Z, 가-힣 + 특수문자 세트
  const only = upper.replace(/[^0-9A-Z가-힣_\-\.!@#$%^&*()+={}\[\]?/:;,~]/g, "");

  return only.slice(0, MAX_NAME_LEN);
}

function sanitizeGame(input: string | null | undefined) {
  const only = String(input ?? "").replace(/[^0-9A-Za-z_-]/g, "");
  return only.slice(0, 20) || "galaga";
}

/**
 * ✅ 빌드/로컬에서 환경변수 없을 때도 터지지 않게:
 * - env 없으면 ok:false로 안내만 하고 200 반환
 * - env 있으면 그때만 supabase import & 사용
 */
async function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  // ✅ 동적 import: env가 있을 때만 패키지 로딩
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const game = sanitizeGame(urlObj.searchParams.get("game"));

  const supabase = await getSupabase();
  if (!supabase) {
    // 환경변수 없으면 “빌드는 통과” + “API는 안내”
    return NextResponse.json({
      ok: false,
      error: "Supabase env missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
      rows: [],
    });
  }

  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at, game")
    .eq("game", game)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_RANK);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, rows: [] }, { status: 200 });
  }

  const rows = (data ?? []).map((r: any) => ({
    name: r.name,
    score: r.score,
    date: r.created_at,
  }));

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const game = sanitizeGame(body?.game);
  const name = sanitizeName(body?.name);
  const score = Number(body?.score);

  if (!name || !Number.isFinite(score) || score < 0) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  // 간단한 이상치 방지
  if (score > 10_000_000) {
    return NextResponse.json({ ok: false, error: "score too large" }, { status: 400 });
  }

  const supabase = await getSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: false,
      error: "Supabase env missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    });
  }

  const { error } = await supabase.from("scores").insert({ game, name, score });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
