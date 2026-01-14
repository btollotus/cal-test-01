'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import OnlineStats from '@/components/OnlineStats';

/* =========================
   미국 시간 (뉴욕 기준)
========================= */
function formatUSNow() {
  const tz = 'America/New_York';
  const d = new Date();

  const dateWeekday = new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(d);

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  let period = '';
  let hour = '';
  let minute = '';

  for (const p of parts) {
    if (p.type === 'dayPeriod') {
      period = p.value === 'AM' ? '오전' : '오후';
    }
    if (p.type === 'hour') hour = p.value;
    if (p.type === 'minute') minute = p.value;
  }

  return {
    dateWeekday,
    time: `${period} ${hour}:${minute}`,
  };
}

/* =========================
   띠 계산
========================= */
function zodiacKorean(birthYear: number) {
  const animals = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  const idx = ((birthYear - 2008) % 12 + 12) % 12;
  return animals[idx];
}

/* =========================
   환율 (단순 / KRW 기준)
========================= */
const FX_RATE: Record<string, number> = {
  USD: 1474.08,
  CNY: 203.45,
  EUR: 1602.31,
  JPY: 9.92, // 1엔 기준
};

export default function Home() {
  const [display, setDisplay] = useState('0');
  const [expr, setExpr] = useState('');
  const [ageInfo, setAgeInfo] = useState('');

  /* 미국 시계 */
  const [usTime, setUsTime] = useState(formatUSNow());

  useEffect(() => {
    const t = setInterval(() => setUsTime(formatUSNow()), 60000);
    return () => clearInterval(t);
  }, []);

  /* 환율 */
  const [currency, setCurrency] = useState<'USD' | 'CNY' | 'EUR' | 'JPY'>('USD');

  const formattedDisplay = useMemo(() => {
    const n = parseFloat(display);
    if (isNaN(n)) return display;
    return n.toLocaleString('en-US');
  }, [display]);

  /* =========================
     계산기 입력
  ========================= */
  const handleNumber = (n: string) => {
    if (ageInfo) setAgeInfo('');
    setDisplay(display === '0' ? n : display + n);
  };

  const handleClear = () => {
    setDisplay('0');
    setExpr('');
    setAgeInfo('');
  };

  const handleBackspace = () => {
    if (display.length <= 1) setDisplay('0');
    else setDisplay(display.slice(0, -1));
  };

  const handleDecimal = () => {
    if (!display.includes('.')) setDisplay(display + '.');
  };

  /* =========================
     AGE 계산
  ========================= */
  const handleAge = () => {
    const y = parseInt(display, 10);
    const currentYear = new Date().getFullYear();

    if (isNaN(y) || String(y).length !== 4 || y < 1900 || y > currentYear) {
      setAgeInfo('⚠️ 출생년도 4자리를 입력하세요');
      return;
    }

    const koreanAge = currentYear - y + 1;
    setAgeInfo(`세는나이 ${koreanAge}세 · ${zodiacKorean(y)}띠`);
  };

  /* =========================
     환율 계산 (외화 → 원화)
  ========================= */
  const fxResult = useMemo(() => {
    const n = parseFloat(display);
    if (isNaN(n)) return '0';
    const rate = FX_RATE[currency];
    return (n * rate).toFixed(2);
  }, [display, currency]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">

        <OnlineStats />

        {/* =========================
            메뉴
        ========================= */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link href="/cannon" className="rounded-xl bg-blue-500 py-4 text-center font-bold text-white">🎯 포쏘기</Link>
          <Link href="/level" className="rounded-xl bg-green-500 py-4 text-center font-bold text-white">🧭 수평계</Link>
          <Link href="/runner" className="rounded-xl bg-purple-600 py-4 text-center font-bold text-white">🚗 자동차 피하기</Link>
          <Link href="/rps" className="rounded-xl bg-pink-600 py-4 text-center font-bold text-white">✊✋✌️ 가위바위보</Link>
          <Link href="/galaga" className="rounded-xl bg-sky-600 py-4 text-center font-bold text-white">🛸 겔러그</Link>
          <Link href="/lotto" className="rounded-xl bg-amber-600 py-4 text-center font-bold text-white">🧧 로또번호</Link>
          <Link href="/fortune" className="rounded-lg bg-emerald-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-emerald-700 active:bg-emerald-800">🔮 관상·띠·나이·오늘운세</Link>

        </div>

        {/* =========================
            🇺🇸 미국 시계
        ========================= */}
        <div className="mb-4 rounded-xl bg-gray-100 p-4 text-center">
          <div className="text-sm text-gray-500">🇺🇸 미국 뉴욕</div>
          <div className="text-sm">{usTime.dateWeekday}</div>
          <div className="text-xl font-bold">{usTime.time}</div>
        </div>

        {/* =========================
            환율
        ========================= */}
        <div className="mb-4 rounded-xl bg-gray-100 p-4">
          <div className="mb-2 font-mono text-sm">FX → KRW</div>

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="mb-2 w-full rounded-lg border px-3 py-2"
          >
            <option value="USD">USD (달러)</option>
            <option value="CNY">CNY (위안)</option>
            <option value="EUR">EUR (유로)</option>
            <option value="JPY">JPY (엔)</option>
          </select>

          <div className="text-sm text-gray-600">
            1 {currency} = {FX_RATE[currency].toFixed(2)} KRW
          </div>
        </div>

        {/* =========================
            계산 결과창 (폭 고정)
        ========================= */}
        <div className="mb-6 rounded-xl bg-gray-900 p-6 text-right min-h-[120px]">
          <div className="min-h-[20px] font-mono text-sm text-white/60">{expr || ' '}</div>
          <div className="text-4xl font-mono text-white">{formattedDisplay}</div>
          <div className="mt-2 text-sm text-emerald-300">≈ {fxResult} 원</div>
          {ageInfo && <div className="mt-1 text-sm text-emerald-200">{ageInfo}</div>}
        </div>

        {/* =========================
            키패드
        ========================= */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={handleClear} className="col-span-2 rounded-lg bg-red-500 py-4 text-white font-bold">AC</button>
          <button onClick={handleBackspace} className="rounded-lg bg-gray-400 py-4 text-white">⌫</button>
          <button onClick={handleAge} className="rounded-lg bg-orange-600 py-4 text-white">AGE</button>

          {[7,8,9].map(n => (
            <button key={n} onClick={() => handleNumber(String(n))} className="rounded-lg bg-gray-200 py-4">{n}</button>
          ))}
          <button className="rounded-lg bg-orange-500 py-4 text-white">÷</button>

          {[4,5,6].map(n => (
            <button key={n} onClick={() => handleNumber(String(n))} className="rounded-lg bg-gray-200 py-4">{n}</button>
          ))}
          <button className="rounded-lg bg-orange-500 py-4 text-white">×</button>

          {[1,2,3].map(n => (
            <button key={n} onClick={() => handleNumber(String(n))} className="rounded-lg bg-gray-200 py-4">{n}</button>
          ))}
          <button className="rounded-lg bg-orange-500 py-4 text-white">−</button>

          <button onClick={() => handleNumber('0')} className="col-span-2 rounded-lg bg-gray-200 py-4">0</button>
          <button onClick={handleDecimal} className="rounded-lg bg-gray-200 py-4">.</button>
          <button className="rounded-lg bg-green-500 py-4 text-white">=</button>

          <button className="col-span-4 rounded-lg bg-orange-500 py-4 text-white">+</button>
        </div>
      </div>
    </div>
  );
}
