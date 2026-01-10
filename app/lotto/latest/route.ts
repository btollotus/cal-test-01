import { NextResponse } from 'next/server';

export async function GET() {
  // 지금은 "최근 1회차" 같은 외부 데이터 표시를 안 하기로 했으니
  // 일단 빈 값(또는 null)을 내려주면 됨
  return NextResponse.json({
    ok: true,
    latest: null,
  });
}
