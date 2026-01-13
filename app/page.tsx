'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import OnlineStats from '@/components/OnlineStats';

function zodiacKorean(birthYear: number) {
  // 기준: 2008년 = 쥐띠
  const animals = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  const idx = ((birthYear - 2008) % 12 + 12) % 12;
  return animals[idx];
}

type FxCur = 'USD' | 'CNY' | 'EUR' | 'JPY';

const FX_LABEL: Record<FxCur, string> = {
  USD: 'USD (달러)',
  CNY: 'CNY (위엔화)',
  EUR: 'EUR (유로)',
  JPY: 'JPY (엔화)',
};

export default function Home() {
  // ✅ Intro
  const [showIntro, setShowIntro] = useState(true);

  // ✅ 계산기 상태
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

  // ✅ 과정(식)
  const [expr, setExpr] = useState<string>('');

  // ✅ 나이 결과
  const [ageInfo, setAgeInfo] = useState<string>('');

  // ✅ FX UI
  const [fxCur, setFxCur] = useState<FxCur>('USD');
  const [fxRates, setFxRates] = useState<Record<FxCur, number | null>>({
    USD: null,
    CNY: null,
    EUR: null,
    JPY: null,
  });
  const [fxInfo, setFxInfo] = useState<string>(''); // 변환 결과 라인
  const [fxErr, setFxErr] = useState<string>('');

  // ✅ PWA 설치 버튼
  const [installable, setInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  // ✅ Intro 타이밍
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ✅ PWA install prompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {}
      setDeferredPrompt(null);
      setInstallable(false);
      return;
    }
    // iOS는 beforeinstallprompt가 없음 → 안내만
    if (isIOS) {
      alert('iPhone/iPad: Safari에서 공유 버튼 → "홈 화면에 추가"를 눌러주세요.');
    }
  };

  // ✅ 표시 포맷
  const formatDisplay = (value: string): string => {
    if (value === 'Error' || value === '' || error) return value;

    const numValue = Number(value);
    if (!Number.isFinite(numValue)) return value;

    // 소수 포함이면 그대로(자리수 유지)
    if (String(value).includes('.')) {
      const [i, d] = String(value).split('.');
      const ii = Number(i);
      const formattedI = Number.isFinite(ii) ? ii.toLocaleString('en-US') : i;
      return `${formattedI}.${d}`;
    }
    return numValue.toLocaleString('en-US');
  };

  const clearSideInfoOnInput = () => {
    if (ageInfo) setAgeInfo('');
    if (fxInfo) setFxInfo('');
    if (fxErr) setFxErr('');
  };

  const handleNumber = (num: string) => {
    clearSideInfoOnInput();

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
    clearSideInfoOnInput();

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
    setFxErr('');
  };

  const handleBackspace = () => {
    clearSideInfoOnInput();

    if (error) {
      handleClear();
      return;
    }
    if (waitingForNewValue) return;

    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const handleDecimal = () => {
    clearSideInfoOnInput();

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

  // ✅ AGE
  const handleAge = () => {
    setFxInfo('');
    setFxErr('');

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

    setExpr(''); // 나이 계산은 식 필요 없게
    setAgeInfo(`세는나이 ${koreanAge}세 · ${z}띠`);
    setWaitingForNewValue(true);
  };

  // ✅ FX: 환율 불러오기(오늘)
  const fetchRate = async (cur: FxCur) => {
    const res = await fetch(`/api/fx?base=${encodeURIComponent(cur)}&to=KRW`, { cache: 'no-store' });
    if (!res.ok) throw new Error('환율 API 실패');
    const data = (await res.json()) as { base: string; to: string; rate: number; date?: string };
    if (!data?.rate || !Number.isFinite(data.rate)) throw new Error('환율 응답이 올바르지 않습니다.');
    return data.rate;
  };

  const refreshFxRates = async () => {
    setFxErr('');
    try {
      const [usd, cny, eur, jpy] = await Promise.all([fetchRate('USD'), fetchRate('CNY'), fetchRate('EUR'), fetchRate('JPY')]);
      setFxRates({ USD: usd, CNY: cny, EUR: eur, JPY: jpy });
    } catch (e: any) {
      setFxErr(e?.message ?? '환율 불러오기 실패');
    }
  };

  useEffect(() => {
    refreshFxRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ FX: 외화 -> 원화(KRW)
  const handleFxToKRW = () => {
    setAgeInfo('');
    setExpr('');

    const rate = fxRates[fxCur];
    if (!rate) {
      setFxErr('환율을 불러오지 못했습니다. RATE로 새로고침 해주세요.');
      return;
    }

    const amt = Number(display);
    if (!Number.isFinite(amt)) {
      setFxErr('금액이 올바르지 않습니다.');
      return;
    }

    const krw = amt * rate;

    // 결과/환율은 소수점 2자리
    const amtStr = amt.toFixed(2);
    const rateStr = rate.toFixed(2);
    const krwStr = krw.toFixed(2);

    setFxInfo(`${fxCur} ${amtStr} → KRW ${Number(krwStr).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  (1 ${fxCur} = ${rateStr} KRW)`);
    setDisplay(krwStr);
    setWaitingForNewValue(true);
  };

  const currentRateLabel = useMemo(() => {
    const r = fxRates[fxCur];
    if (!r) return '—';
    return r.toFixed(2); // ✅ 환율 2자리
  }, [fxCur, fxRates]);

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
          {/* ✅ 바로가기 버튼 */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Link href="/cannon" className="rounded-lg bg-blue-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-blue-600 active:bg-blue-700">
              🎯 포쏘기
            </Link>

            {/* ✅ 활쏘기 삭제 → ✅ 수평계 메뉴(페이지 링크) */}
            <Link href="/level" className="rounded-lg bg-emerald-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-emerald-700 active:bg-emerald-800">
              🧰 수평계
            </Link>

            <Link href="/runner" className="rounded-lg bg-purple-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-purple-700 active:bg-purple-800">
              🚗 자동차 피하기
            </Link>

            <Link href="/rps" className="rounded-lg bg-pink-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-pink-700 active:bg-pink-800">
              ✊✋✌️ 가위바위보
            </Link>

            <Link href="/galaga" className="rounded-lg bg-sky-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-sky-700 active:bg-sky-800">
              🛸 겔러그
            </Link>

            <Link href="/lotto" className="rounded-lg bg-amber-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-amber-700 active:bg-amber-800">
              🧧 로또번호 생성기
            </Link>

            {/* ✅ 홈 화면 설치 버튼 (PWA) */}
            <button
              onClick={handleInstall}
              className="col-span-2 rounded-lg bg-zinc-800 px-3 py-3 text-center text-base font-bold text-white hover:bg-zinc-900 active:bg-black"
              title="홈 화면에 바로가기(앱처럼 설치)"
            >
              ⬇️ 홈 화면에 추가(바로가기)
              {installable ? '' : isIOS ? ' (iOS 안내)' : ''}
            </button>
          </div>

          <OnlineStats />

          {/* ✅ FX (단순형) */}
          <div className="mt-4 rounded-2xl bg-gray-100 p-3 dark:bg-gray-900/40">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-xs tracking-widest text-gray-700 dark:text-gray-200">FX → KRW</div>
              <button
                onClick={refreshFxRates}
                className="rounded-lg bg-gray-800 px-3 py-1.5 font-mono text-xs text-white hover:bg-black active:bg-black/80"
                title="오늘 환율 새로고침"
              >
                RATE ↻
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <select
                value={fxCur}
                onChange={(e) => setFxCur(e.target.value as FxCur)}
                className="w-full rounded-xl bg-white px-3 py-3 font-bold text-gray-900 shadow-sm outline-none ring-1 ring-black/10 dark:bg-gray-800 dark:text-white dark:ring-white/10"
              >
                <option value="USD">{FX_LABEL.USD}</option>
                <option value="CNY">{FX_LABEL.CNY}</option>
                <option value="EUR">{FX_LABEL.EUR}</option>
                <option value="JPY">{FX_LABEL.JPY}</option>
              </select>

              <button
                onClick={handleFxToKRW}
                className="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 active:bg-indigo-800"
                title="현재 입력 금액을 원화로 변환"
              >
                FX
              </button>
            </div>

            <div className="mt-2 font-mono text-xs text-gray-700 dark:text-gray-200">
              1 {fxCur} = <span className="font-bold">{currentRateLabel}</span> KRW (소수점 2자리)
            </div>

            {fxErr && <div className="mt-2 font-mono text-xs text-rose-600 dark:text-rose-300">{fxErr}</div>}
          </div>

          {/* ✅ 계산 과정 + 결과창 (폭 고정/안 줄어들게) */}
          <div className="mt-4 mb-6 w-full rounded-lg bg-gray-900 p-6 text-right dark:bg-gray-950">
            <div className="min-h-[18px] whitespace-nowrap font-mono text-sm text-white/60">
              {expr || '\u00A0'}
            </div>

            <div className="min-h-[54px] whitespace-nowrap text-4xl font-mono font-semibold text-white">
              {formatDisplay(display)}
            </div>

            {ageInfo && <div className="mt-2 font-mono text-sm text-emerald-200 whitespace-nowrap">{ageInfo}</div>}

            {fxInfo && <div className="mt-2 font-mono text-xs text-indigo-200 whitespace-nowrap">{fxInfo}</div>}
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

            {/* AGE */}
            <button
              onClick={handleAge}
              className="rounded-lg bg-orange-600 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-700 active:bg-orange-800"
              title="출생년도 4자리 입력 후 AGE"
            >
              AGE
            </button>

            <button onClick={() => handleNumber('7')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">7</button>
            <button onClick={() => handleNumber('8')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">8</button>
            <button onClick={() => handleNumber('9')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">9</button>
            <button onClick={() => handleOperation('÷')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">÷</button>

            <button onClick={() => handleNumber('4')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">4</button>
            <button onClick={() => handleNumber('5')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">5</button>
            <button onClick={() => handleNumber('6')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">6</button>
            <button onClick={() => handleOperation('×')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">×</button>

            <button onClick={() => handleNumber('1')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">1</button>
            <button onClick={() => handleNumber('2')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">2</button>
            <button onClick={() => handleNumber('3')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">3</button>
            <button onClick={() => handleOperation('-')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">−</button>

            <button onClick={() => handleNumber('0')} className="col-span-2 rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">0</button>
            <button onClick={handleDecimal} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">.</button>
            <button onClick={handleEquals} className="rounded-lg bg-green-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-600 active:bg-green-700">=</button>

            <button onClick={() => handleOperation('+')} className="col-span-4 rounded-lg bg-orange-500 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
