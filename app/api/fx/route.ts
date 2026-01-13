import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// 10분 캐시(너무 잦은 호출 방지)
export const revalidate = 600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get('base') || 'USD').toUpperCase();
  const to = (searchParams.get('to') || 'KRW').toUpperCase();

  // 최소한의 화이트리스트
  const allowedBase = new Set(['USD', 'CNY', 'EUR', 'JPY', 'KRW']);
  const allowedTo = new Set(['KRW', 'USD', 'CNY', 'EUR', 'JPY']);

  if (!allowedBase.has(base) || !allowedTo.has(to)) {
    return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
  }

  try {
    // ✅ 키 없이 쓰기 쉬운 공개 환율 소스(응답 구조: conversion_rates)
    // 필요하면 다른 소스로 바꿔도 됨(여기만)
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    const r = await fetch(url, {
      headers: { 'accept': 'application/json' },
      // Next가 서버에서 캐시/재검증 처리
      next: { revalidate },
    });

    if (!r.ok) throw new Error('Upstream API failed');

    const json: any = await r.json();
    const rate = json?.conversion_rates?.[to];

    if (!rate || !Number.isFinite(rate)) {
      throw new Error('Bad rate');
    }

    return NextResponse.json({
      base,
      to,
      rate: Number(rate),
      date: json?.time_last_update_utc ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'FX fetch failed' },
      { status: 500 }
    );
  }
}
