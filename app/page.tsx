'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import OnlineStats from '@/components/OnlineStats';

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────
function zodiacKorean(birthYear: number) {
  // 기준: 2008년 = 쥐띠
  const animals = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  const idx = ((birthYear - 2008) % 12 + 12) % 12;
  return animals[idx];
}

function formatUSNow() {
  // ✅ 미국 시계: 뉴욕(ET) 기준
  const tz = 'America/New_York';
  const d = new Date();

  // 날짜/요일
  const dateWeekday = new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(d);

  // 시간
  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);

  return { dateWeekday, time };
}

export default function Home() {
  // ✅ Intro
  const [showIntro, setShowIntro] = useState(true);

  // ✅ 미국 시계
  const [usClock, setUsClock] = useState<{ dateWeekday: string; time: string }>(() => ({
    dateWeekday: '—',
    time: '—',
  }));

  // 계산기 상태
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

  // 과정(식)
  const [expr, setExpr] = useState<string>('');

  // 나이 결과
  const [ageInfo, setAgeInfo] = useState<string>('');

  // ─────────────────────────────────────────────────────────────
  // FX(환율) - “단순” 버전: 외화 → 원화
  // ─────────────────────────────────────────────────────────────
  type FxCode = 'USD' | 'CNY' | 'EUR' | 'JPY';
  const [fxCode, setFxCode] = useState<FxCode>('USD');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxErr, setFxErr] = useState<string>('');

  // Intro 타이밍
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // ✅ 미국 시계 틱
  useEffect(() => {
    const tick = () => setUsClock(formatUSNow());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const formatDisplay = (value: string): string => {
    if (value === 'Error' || value === '' || error) return value;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;

    if (value.includes('.')) {
      const [integerPart, decimalPart] = value.split('.');
      const formattedInteger = parseFloat(integerPart).toLocaleString('en-US');
      return `${formattedInteger}.${decimalPart}`;
    }
    return numValue.toLocaleString('en-US');
  };

  // ✅ FX 표시(소숫점 2자리)
  const fxRateText = useMemo(() => {
    if (fxRate == null) return '—';
    return fxRate.toFixed(2);
  }, [fxRate]);

  // ─────────────────────────────────────────────────────────────
  // 계산기 입력/연산
  // ─────────────────────────────────────────────────────────────
  const handleNumber = (num: string) => {
    if (ageInfo) setAgeInfo('');
    if (fxErr) setFxErr('');

    if (error) {
      setDisplay(num);
      setError(false);
      setWaitingForNewValue(false);
      setExpr('');
      return;
    }

    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const calculate = (prev: number, current: number, op: string): number | null => {
    switch (op) {
      case '+':
        return prev + current;
      case '-':
        return prev - current;
      case '×':
        return prev * current;
      case '÷':
        if (current === 0) return null;
        return prev / current;
      default:
        return current;
    }
  };

  const handleOperation = (op: string) => {
    if (error) return;
    if (ageInfo) setAgeInfo('');
    if (fxErr) setFxErr('');

    const currentValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(currentValue);
      setExpr(`${formatDisplay(display)} ${op}`);
    } else if (operation) {
      const result = calculate(previousValue, currentValue, operation);
      if (result === null) {
        setDisplay('Error');
        setError(true);
        setPreviousValue(null);
        setOperation(null);
        setExpr('');
        return;
      }
      setPreviousValue(result);
      setDisplay(String(result));
      setExpr(`${formatDisplay(String(result))} ${op}`);
    }

    setOperation(op);
    setWaitingForNewValue(true);
  };

  const handleEquals = () => {
    if (error || operation === null || previousValue === null) return;

    const currentValue = parseFloat(display);
    const result = calculate(previousValue, currentValue, operation);

    const left = formatDisplay(String(previousValue));
    const right = formatDisplay(display);
    setExpr(`${left} ${operation} ${right}`);

    if (result === null) {
      setDisplay('Error');
      setError(true);
    } else {
      setDisplay(String(result));
    }

    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
    setError(false);
    setExpr('');
    setAgeInfo('');
    setFxErr('');
  };

  const handleBackspace = () => {
    if (ageInfo) setAgeInfo('');
    if (fxErr) setFxErr('');

    if (error) {
      handleClear();
      return;
    }
    if (waitingForNewValue) return;

    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const handleDecimal = () => {
    if (ageInfo) setAgeInfo('');
    if (fxErr) setFxErr('');

    if (error) {
      setDisplay('0.');
      setError(false);
      setWaitingForNewValue(false);
      setExpr('');
      return;
    }

    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // AGE
  // ─────────────────────────────────────────────────────────────
  const handleAge = () => {
    if (fxErr) setFxErr('');

    const y = parseInt(display, 10);
    const now = new Date();
    const currentYear = now.getFullYear();

    if (isNaN(y) || String(y).length !== 4 || y < 1900 || y > currentYear) {
      setAgeInfo('⚠️ 출생년도 4자리(예: 1983)를 입력하세요.');
      setWaitingForNewValue(true);
      return;
    }

    const koreanAge = currentYear - y + 1;
    const z = zodiacKorean(y);
    setAgeInfo(`세는나이 ${koreanAge}세 · ${z}띠`);
    setWaitingForNewValue(true);
  };

  // ─────────────────────────────────────────────────────────────
  // FX: 환율 불러오기 + 외화→원화 계산
  // ─────────────────────────────────────────────────────────────
  const fetchFxRate = async () => {
    setFxErr('');
    try {
      // ✅ exchangerate.host (무료, 키 없이 동작하는 경우가 많음)
      // base=KRW 이면 1KRW당 외화가 나옴 → 우리가 원하는건 1외화 = ? KRW 이므로 base를 외화로 잡는다.
      const res = await fetch(`https://api.exchangerate.host/latest?base=${fxCode}&symbols=KRW`, {
        cache: 'no-store',
      });

      if (!res.ok) throw new Error('rate fetch failed');
      const data = await res.json();

      const rate = data?.rates?.KRW;
      if (typeof rate !== 'number' || !isFinite(rate)) throw new Error('invalid rate');

      setFxRate(rate);
      return rate as number;
    } catch {
      setFxErr('환율을 불러오지 못했습니다. RATE로 새로고침 해주세요.');
      setFxRate(null);
      return null;
    }
  };

  const handleFxConvert = async () => {
    setAgeInfo('');
    setExpr('');

    const amount = parseFloat(display);
    if (!isFinite(amount)) {
      setFxErr('금액을 입력하세요.');
      return;
    }

    let rate = fxRate;
    if (rate == null) {
      rate = await fetchFxRate();
      if (rate == null) return;
    }

    const krw = amount * rate;
    // ✅ 결과는 원화니까 소수점 없이 보통 보여줌(원하면 소수점도 가능)
    setDisplay(String(Math.round(krw)));
    setWaitingForNewValue(true);
  };

  // 첫 로딩에 한 번 환율 자동 로드(원하면 제거 가능)
  useEffect(() => {
    fetchFxRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxCode]);

  return (
    <>
      {showIntro && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center intro-bg">
          <div className="intro-logo select-none">JDg</div>
        </div>
      )}

      <div
        className={[
          'flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800',
          showIntro ? 'opacity-0' : 'opacity-100 transition-opacity duration-500',
        ].join(' ')}
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
          {/* ✅ “홈 화면에 추가(바로가기)” 버튼/메뉴는 제거 */}

          <OnlineStats />

          {/* ✅ 바로가기 버튼 */}
          <div className="mt-4 mb-5 grid grid-cols-2 gap-2">
            <Link
              href="/cannon"
              className="rounded-lg bg-blue-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-blue-600 active:bg-blue-700"
            >
              🎯 포쏘기
            </Link>

            <Link
              href="/level"
              className="rounded-lg bg-green-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-green-700 active:bg-green-800"
            >
              🧭 수평계
            </Link>

            <Link
              href="/runner"
              className="rounded-lg bg-purple-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-purple-700 active:bg-purple-800"
            >
              🚗 자동차 피하기
            </Link>

            <Link
              href="/rps"
              className="rounded-lg bg-pink-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-pink-700 active:bg-pink-800"
            >
              ✊✋✌️ 가위바위보
            </Link>

            <Link
              href="/galaga"
              className="rounded-lg bg-sky-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-sky-700 active:bg-sky-800"
            >
              🛸 겔러그
            </Link>

            <Link
              href="/lotto"
              className="rounded-lg bg-amber-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-amber-700 active:bg-amber-800"
            >
              🧧 로또번호 생성기
            </Link>
          </div>

          {/* ✅ 미국 시계 (환율 위) */}
          <div className="mb-3 rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm tracking-widest text-slate-600 dark:text-white/70">
                🇺🇸 USA TIME (NY)
              </div>
              <div className="font-mono text-xs text-slate-500 dark:text-white/50">ET</div>
            </div>

            <div className="mt-2 font-mono text-base text-slate-700 dark:text-white/70">
              {usClock.dateWeekday}
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold text-slate-900 dark:text-white">
              {usClock.time}
            </div>
          </div>

          {/* ✅ 환율 카드 */}
          <div className="mb-4 rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm tracking-widest text-slate-600 dark:text-white/70">
                FX → KRW
              </div>

              <button
                onClick={fetchFxRate}
                className="rounded-full bg-slate-900 px-3 py-2 font-mono text-xs text-white hover:bg-slate-800 active:bg-black"
                title="환율 새로고침"
              >
                RATE ↻
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_88px] gap-2">
              <select
                value={fxCode}
                onChange={(e) => setFxCode(e.target.value as FxCode)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-lg font-bold text-slate-900 shadow-sm outline-none dark:border-white/10 dark:bg-black/30 dark:text-white"
              >
                <option value="USD">USD (달러)</option>
                <option value="CNY">CNY (위엔화)</option>
                <option value="EUR">EUR (유로)</option>
                <option value="JPY">JPY (엔화)</option>
              </select>

              <button
                onClick={handleFxConvert}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-lg font-extrabold text-white hover:bg-indigo-700 active:bg-indigo-800"
                title="입력한 외화를 원화로 변환"
              >
                FX
              </button>
            </div>

            <div className="mt-3 font-mono text-sm text-slate-700 dark:text-white/70">
              1 {fxCode} = {fxRateText} KRW <span className="text-slate-500 dark:text-white/40">(소수점 2자리)</span>
            </div>

            {fxErr && (
              <div className="mt-2 font-mono text-sm text-rose-600 dark:text-rose-300">{fxErr}</div>
            )}
          </div>

          {/* ✅ 계산 과정 + 결과창 (폭 고정: w-full) */}
          <div className="mt-2 mb-6 w-full rounded-2xl bg-gray-900 p-6 text-right dark:bg-gray-950">
            <div className="min-h-[18px] font-mono text-sm text-white/60">{expr || '\u00A0'}</div>

            <div className="min-h-[54px] font-mono text-4xl font-semibold text-white">
              {formatDisplay(display)}
            </div>

            {ageInfo && <div className="mt-2 font-mono text-sm text-emerald-200">{ageInfo}</div>}
          </div>

          {/* Buttons */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <button
              onClick={handleClear}
              className="col-span-2 rounded-lg bg-red-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-600 active:bg-red-700"
            >
              AC
            </button>

            <button
              onClick={handleBackspace}
              className="rounded-lg bg-gray-400 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-gray-500 active:bg-gray-600"
            >
              ⌫
            </button>

            <button
              onClick={handleAge}
              className="rounded-lg bg-orange-600 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-700 active:bg-orange-800"
              title="출생년도 4자리 입력 후 AGE"
            >
              AGE
            </button>

            <button onClick={() => handleNumber('7')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              7
            </button>
            <button onClick={() => handleNumber('8')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              8
            </button>
            <button onClick={() => handleNumber('9')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              9
            </button>
            <button onClick={() => handleOperation('÷')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white hover:bg-orange-600 active:bg-orange-700">
              ÷
            </button>

            <button onClick={() => handleNumber('4')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              4
            </button>
            <button onClick={() => handleNumber('5')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              5
            </button>
            <button onClick={() => handleNumber('6')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              6
            </button>
            <button onClick={() => handleOperation('×')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white hover:bg-orange-600 active:bg-orange-700">
              ×
            </button>

            <button onClick={() => handleNumber('1')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              1
            </button>
            <button onClick={() => handleNumber('2')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              2
            </button>
            <button onClick={() => handleNumber('3')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              3
            </button>
            <button onClick={() => handleOperation('-')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white hover:bg-orange-600 active:bg-orange-700">
              −
            </button>

            <button onClick={() => handleNumber('0')} className="col-span-2 rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              0
            </button>
            <button onClick={handleDecimal} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              .
            </button>
            <button onClick={handleEquals} className="rounded-lg bg-green-500 px-4 py-4 text-lg font-semibold text-white hover:bg-green-600 active:bg-green-700">
              =
            </button>

            <button onClick={() => handleOperation('+')} className="col-span-4 rounded-lg bg-orange-500 px-4 py-3 text-lg font-semibold text-white hover:bg-orange-600 active:bg-orange-700">
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
