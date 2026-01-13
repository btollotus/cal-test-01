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

// FX 데이터 소스(무료 JSON, 최신값)
const fxUrl = (base: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`;

type FxCur = 'USD' | 'CNY' | 'EUR' | 'JPY';
type FxDir = 'KRW_TO_FX' | 'FX_TO_KRW';

export default function Home() {
  // ✅ Intro
  const [showIntro, setShowIntro] = useState(true);

  // ✅ 계산기 상태
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

  // ✅ 과정(식) + AGE 결과
  const [expr, setExpr] = useState<string>('');
  const [ageInfo, setAgeInfo] = useState<string>('');

  // ✅ PWA 설치 버튼
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const canInstall = !!deferredPrompt;

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  // ✅ FX 상태
  const [fxCur, setFxCur] = useState<FxCur>('USD');
  const [fxDir, setFxDir] = useState<FxDir>('KRW_TO_FX');
  const [fxLoading, setFxLoading] = useState(false);
  const [fxErr, setFxErr] = useState<string | null>(null);
  const [fxDate, setFxDate] = useState<string | null>(null);
  // 1 외화 = ? KRW (예: 1 USD = 1320 KRW)
  const [fxKRWPer, setFxKRWPer] = useState<Record<FxCur, number> | null>(null);

  // ✅ Intro 타이밍
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ✅ PWA beforeinstallprompt 캐치
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  const handleInstall = async () => {
    try {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } catch {
      // 무시
    }
  };

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

  const clearCalcStateKeepDisplay = () => {
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
    setError(false);
  };

  const handleNumber = (num: string) => {
    if (ageInfo) setAgeInfo('');
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
  };

  const handleBackspace = () => {
    if (ageInfo) setAgeInfo('');
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
    const y = parseInt(display, 10);
    const now = new Date();
    const currentYear = now.getFullYear();

    if (isNaN(y) || String(y).length !== 4 || y < 1900 || y > currentYear) {
      setExpr('AGE');
      setAgeInfo('⚠️ 출생년도 4자리(예: 1983)를 입력해주세요.');
      setWaitingForNewValue(true);
      return;
    }

    const koreanAge = currentYear - y + 1;
    const z = zodiacKorean(y);

    setExpr(`AGE(${y})`);
    setAgeInfo(`세는나이 ${koreanAge}세 · ${z}띠`);
    setWaitingForNewValue(true);
  };

  // ✅ FX: 최신 환율 로드
  const loadFx = async () => {
    setFxLoading(true);
    setFxErr(null);

    try {
      const [usd, cny, eur, jpy] = await Promise.all([
        fetch(fxUrl('usd')).then((r) => r.json()),
        fetch(fxUrl('cny')).then((r) => r.json()),
        fetch(fxUrl('eur')).then((r) => r.json()),
        fetch(fxUrl('jpy')).then((r) => r.json()),
      ]);

      const date =
        usd?.date || cny?.date || eur?.date || jpy?.date || null;

      const next: Record<FxCur, number> = {
        USD: Number(usd?.usd?.krw),
        CNY: Number(cny?.cny?.krw),
        EUR: Number(eur?.eur?.krw),
        JPY: Number(jpy?.jpy?.krw),
      };

      if (!next.USD || !next.CNY || !next.EUR || !next.JPY) {
        throw new Error('환율 데이터를 읽지 못했습니다.');
      }

      setFxDate(date);
      setFxKRWPer(next);
    } catch (e: any) {
      setFxErr(e?.message ?? '환율 불러오기 실패');
      setFxKRWPer(null);
      setFxDate(null);
    } finally {
      setFxLoading(false);
    }
  };

  // 첫 진입 시 자동 로드
  useEffect(() => {
    loadFx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycleFxCur = () => {
    const order: FxCur[] = ['USD', 'CNY', 'EUR', 'JPY'];
    const i = order.indexOf(fxCur);
    setFxCur(order[(i + 1) % order.length]);
  };

  const toggleFxDir = () => {
    setFxDir((d) => (d === 'KRW_TO_FX' ? 'FX_TO_KRW' : 'KRW_TO_FX'));
  };

  // ✅ FX 계산 실행
  const handleFX = () => {
    if (!fxKRWPer) {
      setExpr('FX');
      setAgeInfo(fxErr ? `⚠️ ${fxErr}` : '⚠️ 환율을 불러오는 중입니다.');
      setWaitingForNewValue(true);
      return;
    }

    const v = parseFloat(display);
    if (isNaN(v)) return;

    const rate = fxKRWPer[fxCur]; // 1 FX = rate KRW
    const dirText = fxDir === 'KRW_TO_FX' ? `KRW→${fxCur}` : `${fxCur}→KRW`;

    let result: number;
    if (fxDir === 'KRW_TO_FX') {
      result = v / rate;
    } else {
      result = v * rate;
    }

    clearCalcStateKeepDisplay();
    setExpr(`FX ${dirText}${fxDate ? ` (${fxDate})` : ''}`);
    setAgeInfo(`1 ${fxCur} = ${rate.toLocaleString('en-US')} KRW`);
    setDisplay(String(result));
    setWaitingForNewValue(true);
  };

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
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Link
              href="/cannon"
              className="rounded-lg bg-blue-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-blue-600 active:bg-blue-700"
            >
              🎯 포쏘기
            </Link>

            {/* ✅ 활쏘기 삭제 → 수평계 메뉴로 대체 */}
            <Link
              href="/level"
              className="rounded-lg bg-emerald-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-emerald-700 active:bg-emerald-800"
            >
              📐 수평계
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
          <div className="mb-4">
            {canInstall ? (
              <button
                onClick={handleInstall}
                className="w-full rounded-lg bg-zinc-900 px-3 py-3 text-center text-sm font-bold text-white hover:bg-black active:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                📲 홈 화면에 바로가기 설치
              </button>
            ) : (
              <div className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                {isIOS
                  ? 'iPhone: 공유 버튼 → “홈 화면에 추가”로 설치할 수 있어요.'
                  : '설치 가능한 환경이면 “홈 화면에 설치” 버튼이 자동으로 표시됩니다.'}
              </div>
            )}
          </div>

          <OnlineStats />

          {/* ✅ 계산 과정 + 결과창 */}
          <div className="mt-4 mb-6 rounded-lg bg-gray-900 p-6 text-right dark:bg-gray-950">
            {/* 과정(식) */}
            <div className="min-h-[18px] font-mono text-sm text-white/60">{expr || '\u00A0'}</div>

            {/* 결과값 */}
            <div className="min-h-[54px] text-4xl font-mono font-semibold text-white">
              {formatDisplay(display)}
            </div>

            {/* 부가 정보(AGE/FX 안내) */}
            {ageInfo && <div className="mt-2 font-mono text-sm text-emerald-200">{ageInfo}</div>}

            {/* FX 상태 */}
            <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-white/55">
              <div className="flex items-center gap-2">
                <span>FX:</span>
                <span className="text-white/80">{fxCur}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/80">{fxDir === 'KRW_TO_FX' ? 'KRW→FX' : 'FX→KRW'}</span>
              </div>
              <div className="flex items-center gap-2">
                {fxLoading ? (
                  <span>환율 불러오는 중…</span>
                ) : fxErr ? (
                  <button onClick={loadFx} className="underline decoration-white/30 hover:text-white">
                    환율 다시불러오기
                  </button>
                ) : (
                  <span>{fxDate ? `기준일 ${fxDate}` : '기준일 —'}</span>
                )}
              </div>
            </div>
          </div>

          {/* ✅ Buttons */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {/* Row 1 */}
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
              onClick={handleFX}
              className="rounded-lg bg-teal-600 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-teal-700 active:bg-teal-800"
              title="환율 계산"
            >
              FX
            </button>

            {/* Row 2 */}
            <button
              onClick={cycleFxCur}
              className="rounded-lg bg-zinc-700 px-4 py-4 text-base font-semibold text-white transition-colors hover:bg-zinc-600 active:bg-zinc-500"
              title="통화 변경(순환)"
            >
              {fxCur}
            </button>

            <button
              onClick={toggleFxDir}
              className="rounded-lg bg-zinc-700 px-4 py-4 text-base font-semibold text-white transition-colors hover:bg-zinc-600 active:bg-zinc-500"
              title="방향 전환(KRW↔외화)"
            >
              ↔
            </button>

            <button
              onClick={() => handleOperation('÷')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              ÷
            </button>

            <button
              onClick={() => handleOperation('×')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              ×
            </button>

            {/* Row 3 */}
            <button onClick={() => handleNumber('7')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              7
            </button>
            <button onClick={() => handleNumber('8')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              8
            </button>
            <button onClick={() => handleNumber('9')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              9
            </button>
            <button onClick={() => handleOperation('-')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              −
            </button>

            {/* Row 4 */}
            <button onClick={() => handleNumber('4')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              4
            </button>
            <button onClick={() => handleNumber('5')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              5
            </button>
            <button onClick={() => handleNumber('6')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              6
            </button>
            <button onClick={() => handleOperation('+')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              +
            </button>

            {/* Row 5 */}
            <button onClick={() => handleNumber('1')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              1
            </button>
            <button onClick={() => handleNumber('2')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              2
            </button>
            <button onClick={() => handleNumber('3')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              3
            </button>
            <button
              onClick={handleAge}
              className="rounded-lg bg-orange-600 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-700 active:bg-orange-800"
              title="출생년도 4자리 입력 후 AGE"
            >
              AGE
            </button>

            {/* Row 6 */}
            <button onClick={() => handleNumber('0')} className="col-span-2 rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              0
            </button>
            <button onClick={handleDecimal} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
              .
            </button>
            <button onClick={handleEquals} className="rounded-lg bg-green-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-600 active:bg-green-700">
              =
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
