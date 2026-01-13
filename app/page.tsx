'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import OnlineStats from '@/components/OnlineStats';

function zodiacKorean(birthYear: number) {
  // 기준: 2008년 = 쥐띠
  const animals = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  const idx = ((birthYear - 2008) % 12 + 12) % 12;
  return animals[idx];
}

type FxCur = 'USD' | 'CNY' | 'EUR' | 'JPY';
type FxDir = 'KRW_TO' | 'TO_KRW';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function Home() {
  // ✅ Intro 상태
  const [showIntro, setShowIntro] = useState(true);

  // -------------------- 계산기 상태 --------------------
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

  // ✅ “과정 표시(식)”
  const [expr, setExpr] = useState<string>(''); // 예: "1 + 1"

  // ✅ 나이 계산 결과 라인
  const [ageInfo, setAgeInfo] = useState<string>(''); // 예: "세는나이 42세 · 돼지띠"

  // ✅ 환율 계산 결과 라인
  const [fxInfo, setFxInfo] = useState<string>(''); // 예: "1 USD = 1324.78 KRW"
  const [fxCur, setFxCur] = useState<FxCur>('USD');
  const [fxDir, setFxDir] = useState<FxDir>('KRW_TO');
  const [fxRatesKRWPer, setFxRatesKRWPer] = useState<Record<FxCur, number> | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxErr, setFxErr] = useState<string | null>(null);

  // ✅ PWA 설치 버튼
  const [canInstall, setCanInstall] = useState(false);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // ✅ Intro 타이밍
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ✅ PWA install prompt 잡기
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    const p = installPromptRef.current;
    if (!p) return;
    try {
      await p.prompt();
      await p.userChoice;
    } finally {
      installPromptRef.current = null;
      setCanInstall(false);
    }
  };

  const formatDisplay = (value: string): string => {
    if (value === 'Error' || value === '' || error) return value;

    const numValue = Number(value);
    if (!Number.isFinite(numValue)) return value;

    if (value.includes('.')) {
      const [integerPart, decimalPart] = value.split('.');
      const formattedInteger = Number(integerPart || '0').toLocaleString('en-US');
      return `${formattedInteger}.${decimalPart}`;
    }
    return numValue.toLocaleString('en-US');
  };

  // 입력 시작 시 정보라인 정리(나이/환율)
  const clearInfosForNewTyping = () => {
    if (ageInfo) setAgeInfo('');
    if (fxInfo) setFxInfo('');
    if (fxErr) setFxErr(null);
  };

  const handleNumber = (num: string) => {
    clearInfosForNewTyping();

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
    clearInfosForNewTyping();

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
    setFxInfo('');
    setFxErr(null);
  };

  const handleBackspace = () => {
    clearInfosForNewTyping();

    if (error) {
      handleClear();
      return;
    }
    if (waitingForNewValue) return;

    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const handleDecimal = () => {
    clearInfosForNewTyping();

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

  // -------------------- 나이 계산 --------------------
  const handleAge = () => {
    setFxErr(null);
    setFxInfo('');

    const y = parseInt(display, 10);
    const now = new Date();
    const currentYear = now.getFullYear();

    if (Number.isNaN(y) || String(y).length !== 4 || y < 1900 || y > currentYear) {
      setAgeInfo('⚠️ 출생년도 4자리(예: 1983)를 입력하세요');
      setWaitingForNewValue(true);
      return;
    }

    const koreanAge = currentYear - y + 1;
    const z = zodiacKorean(y);
    setAgeInfo(`세는나이 ${koreanAge}세 · ${z}띠`);
    setWaitingForNewValue(true);
  };

  // -------------------- 환율 로드 --------------------
  const fetchFx = async () => {
    setFxLoading(true);
    setFxErr(null);

    try {
      // 무료/키 없이 사용 가능한 환율 API (기기/지역에 따라 값이 약간 다를 수 있음)
      // base=KRW면: rates.USD = "1 KRW = ? USD"
      const res = await fetch('https://api.exchangerate.host/latest?base=KRW&symbols=USD,EUR,CNY,JPY', {
        cache: 'no-store',
      });

      const json = await res.json();

      if (!json || !json.rates) throw new Error('환율 응답이 올바르지 않습니다.');

      const r = json.rates as Record<string, number>;

      const usd = r.USD;
      const eur = r.EUR;
      const cny = r.CNY;
      const jpy = r.JPY;

      if (!usd || !eur || !cny || !jpy) throw new Error('환율 데이터가 부족합니다.');

      // KRW per 1 foreign = 1 / (foreign per 1 KRW)
      const ratesKRWPer: Record<FxCur, number> = {
        USD: 1 / usd,
        EUR: 1 / eur,
        CNY: 1 / cny,
        JPY: 1 / jpy,
      };

      setFxRatesKRWPer(ratesKRWPer);
    } catch (e: any) {
      setFxRatesKRWPer(null);
      setFxErr(e?.message ?? '환율 로드 실패');
    } finally {
      setFxLoading(false);
    }
  };

  useEffect(() => {
    fetchFx();
  }, []);

  // -------------------- 환율 계산 --------------------
  const handleFX = () => {
    setAgeInfo('');
    setExpr('');

    if (!fxRatesKRWPer) {
      setFxErr('환율이 아직 준비되지 않았습니다. (새로고침 후 다시 시도)');
      setWaitingForNewValue(true);
      return;
    }

    const amount = Number(display);
    if (!Number.isFinite(amount)) {
      setFxErr('숫자를 입력하세요');
      setWaitingForNewValue(true);
      return;
    }

    const rate = fxRatesKRWPer[fxCur]; // 1 fxCur = rate KRW

    // ✅ 환율 표시: 소수점 2자리
    setFxInfo(`1 ${fxCur} = ${rate.toFixed(2)} KRW`);

    let result = 0;

    if (fxDir === 'KRW_TO') {
      // KRW -> FX : amount(KRW) / (KRW per 1 FX)
      result = amount / rate;
    } else {
      // FX -> KRW : amount(FX) * (KRW per 1 FX)
      result = amount * rate;
    }

    // ✅ 결과값: 소수점 2자리 고정
    setDisplay(result.toFixed(2));
    setWaitingForNewValue(true);
  };

  const fxTitle = useMemo(() => {
    const from = fxDir === 'KRW_TO' ? 'KRW' : fxCur;
    const to = fxDir === 'KRW_TO' ? fxCur : 'KRW';
    return `${from} → ${to}`;
  }, [fxCur, fxDir]);

  return (
    <>
      {/* ✅ Intro Overlay */}
      {showIntro && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center intro-bg">
          <div className="intro-logo select-none">JDg</div>
        </div>
      )}

      {/* ✅ Main UI */}
      <div
        className={[
          'flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800',
          showIntro ? 'opacity-0' : 'opacity-100 transition-opacity duration-500',
        ].join(' ')}
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
          {/* ✅ 바로가기 버튼 영역 */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Link
              href="/cannon"
              className="rounded-lg bg-blue-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-blue-600 active:bg-blue-700"
            >
              🎯 포쏘기
            </Link>

            {/* ❌ 활쏘기 삭제 / ✅ 수평계 메뉴로 대체 */}
            <Link
              href="/level"
              className="rounded-lg bg-emerald-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-emerald-700 active:bg-emerald-800"
            >
              🧰 수평계
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

          {/* ✅ 홈 화면 설치 버튼(PWA) */}
          <button
            onClick={handleInstall}
            disabled={!canInstall}
            className={[
              'mb-4 w-full rounded-lg px-3 py-3 text-center text-sm font-bold transition-colors',
              canInstall
                ? 'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 dark:bg-white dark:text-black dark:hover:bg-white/90'
                : 'bg-zinc-400/60 text-white/80 cursor-not-allowed',
            ].join(' ')}
            title={canInstall ? '홈 화면에 설치(바로가기)' : '설치 버튼은 PWA 조건에서만 활성화됩니다'}
          >
            📲 홈 화면에 설치(바로가기)
          </button>

          <OnlineStats />

          {/* ✅ 계산 과정 + 결과창 (폭 고정) */}
          <div className="mt-4 mb-6 w-full min-w-0 rounded-lg bg-gray-900 p-6 text-right dark:bg-gray-950">
            {/* 과정(식) */}
            <div className="min-h-[18px] font-mono text-sm text-white/60">
              {expr || '\u00A0'}
            </div>

            {/* 결과값 (tabular-nums로 폭 흔들림 최소화) */}
            <div className="min-h-[54px] font-mono text-4xl font-semibold text-white tabular-nums">
              {formatDisplay(display)}
            </div>

            {/* 나이/띠 결과 (항상 자리 확보 -> 레이아웃 흔들림 방지) */}
            <div className="mt-2 min-h-[20px] font-mono text-sm text-emerald-200">
              {ageInfo || '\u00A0'}
            </div>

            {/* 환율 정보 (항상 자리 확보) */}
            <div className="mt-1 min-h-[18px] font-mono text-xs text-white/65">
              {fxInfo || '\u00A0'}
            </div>

            {/* 환율 에러 (필요 시) */}
            {fxErr && (
              <div className="mt-1 font-mono text-xs text-rose-200">
                {fxErr}
              </div>
            )}
          </div>

          {/* ✅ 환율 설정 UI */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
              <div className="mb-2 font-mono text-[11px] tracking-widest text-black/60 dark:text-white/60">
                FX CURRENCY
              </div>
              <select
                value={fxCur}
                onChange={(e) => setFxCur(e.target.value as FxCur)}
                className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-black shadow-sm outline-none ring-1 ring-black/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10"
              >
                <option value="USD">USD (달러)</option>
                <option value="CNY">CNY (위안)</option>
                <option value="EUR">EUR (유로)</option>
                <option value="JPY">JPY (엔)</option>
              </select>
            </div>

            <div className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
              <div className="mb-2 font-mono text-[11px] tracking-widest text-black/60 dark:text-white/60">
                DIRECTION
              </div>
              <select
                value={fxDir}
                onChange={(e) => setFxDir(e.target.value as FxDir)}
                className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-black shadow-sm outline-none ring-1 ring-black/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10"
              >
                <option value="KRW_TO">KRW → 외화</option>
                <option value="TO_KRW">외화 → KRW</option>
              </select>
            </div>
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

            {/* ✅ AGE 버튼 */}
            <button
              onClick={handleAge}
              className="rounded-lg bg-orange-600 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-700 active:bg-orange-800"
              title="출생년도 4자리 입력 후 AGE"
            >
              AGE
            </button>

            <button onClick={() => handleNumber('7')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              7
            </button>
            <button onClick={() => handleNumber('8')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              8
            </button>
            <button onClick={() => handleNumber('9')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              9
            </button>
            <button onClick={() => handleOperation('÷')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              ÷
            </button>

            <button onClick={() => handleNumber('4')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              4
            </button>
            <button onClick={() => handleNumber('5')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              5
            </button>
            <button onClick={() => handleNumber('6')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              6
            </button>
            <button onClick={() => handleOperation('×')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              ×
            </button>

            <button onClick={() => handleNumber('1')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              1
            </button>
            <button onClick={() => handleNumber('2')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              2
            </button>
            <button onClick={() => handleNumber('3')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              3
            </button>
            <button onClick={() => handleOperation('-')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              −
            </button>

            <button onClick={() => handleNumber('0')} className="col-span-2 rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              0
            </button>
            <button onClick={handleDecimal} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              .
            </button>
            <button onClick={handleEquals} className="rounded-lg bg-green-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-600 active:bg-green-700">
              =
            </button>

            {/* ✅ FX 버튼 + 환율 새로고침 */}
            <button
              onClick={handleFX}
              className="col-span-2 rounded-lg bg-indigo-600 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
              title="현재 표시된 숫자를 환율 변환"
            >
              FX ({fxTitle})
            </button>

            <button
              onClick={fetchFx}
              disabled={fxLoading}
              className="col-span-2 rounded-lg bg-zinc-700 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-zinc-600 active:bg-zinc-800 disabled:opacity-50"
              title="오늘 환율 다시 불러오기"
            >
              {fxLoading ? 'RATE…' : 'RATE ↻'}
            </button>

            <button onClick={() => handleOperation('+')} className="col-span-4 rounded-lg bg-orange-500 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
