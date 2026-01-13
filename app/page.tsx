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

  // ✅ 과정 표시
  const [expr, setExpr] = useState<string>('');

  // ✅ 나이 계산 결과
  const [ageInfo, setAgeInfo] = useState<string>('');

  // ✅ FX(환율) — “외화 → 원화(KRW)”만 단순 제공
  const [fxCur, setFxCur] = useState<FxCur>('USD');
  const [fxRate, setFxRate] = useState<number | null>(null); // 1 CUR = fxRate KRW
  const [fxMsg, setFxMsg] = useState<string>(''); // 에러/상태 메세지

  // ✅ PWA 설치 버튼
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const installPromptRef = useRef<any>(null);

  // ✅ Intro 타이밍
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ✅ iOS 감지 + beforeinstallprompt
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua);
    setIsIOS(ios);

    const onBIP = (e: any) => {
      e.preventDefault();
      installPromptRef.current = e;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP as any);

    return () => window.removeEventListener('beforeinstallprompt', onBIP as any);
  }, []);

  const onInstallClick = async () => {
    // Android/Chrome 계열
    const prompt = installPromptRef.current;
    if (prompt) {
      prompt.prompt();
      try {
        await prompt.userChoice;
      } catch {}
      installPromptRef.current = null;
      setCanInstall(false);
      return;
    }
    // iOS는 직접 설치 불가 → 안내
    if (isIOS) {
      alert('iPhone(iOS)은 Safari에서 공유 버튼(⬆️) → "홈 화면에 추가"를 선택하세요.');
    }
  };

  // ✅ 표시 포맷
  const formatDisplay = (value: string): string => {
    if (value === 'Error' || value === '' || error) return value;

    const numValue = Number(value);
    if (!Number.isFinite(numValue)) return value;

    // 소수 있으면 그대로(이미 toFixed로 들어오기도 함)
    if (value.includes('.')) {
      const [i, d] = value.split('.');
      const iFmt = Number(i).toLocaleString('en-US');
      return `${iFmt}.${d}`;
    }
    return numValue.toLocaleString('en-US');
  };

  // ✅ 입력 시작 시 각종 “부가 결과” 정리
  const clearAuxOnInput = () => {
    if (ageInfo) setAgeInfo('');
    if (fxMsg) setFxMsg('');
  };

  const handleNumber = (num: string) => {
    clearAuxOnInput();

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
    clearAuxOnInput();

    const currentValue = Number(display);

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

    const currentValue = Number(display);
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
    setFxMsg('');
  };

  const handleBackspace = () => {
    clearAuxOnInput();

    if (error) {
      handleClear();
      return;
    }
    if (waitingForNewValue) return;

    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const handleDecimal = () => {
    clearAuxOnInput();

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

  // ✅ AGE 버튼
  const handleAge = () => {
    setFxMsg('');

    const y = parseInt(display, 10);
    const currentYear = new Date().getFullYear();

    if (!Number.isFinite(y) || String(y).length !== 4 || y < 1900 || y > currentYear) {
      setAgeInfo('⚠️ 출생년도 4자리(예: 1983)를 입력하세요.');
      // 폭(레이아웃) 흔들리지 않게 display는 그대로 둠
      setWaitingForNewValue(true);
      return;
    }

    const koreanAge = currentYear - y + 1;
    const z = zodiacKorean(y);
    setAgeInfo(`세는나이 ${koreanAge}세 · ${z}띠`);
    setWaitingForNewValue(true);
  };

  // ✅ FX 환율 불러오기 (Frankfurter: 무료, 키 없이 사용 가능)
  // 1 CUR = ? KRW
  const fetchFxRate = async (cur: FxCur) => {
    setFxMsg('환율 불러오는 중…');
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${cur}&to=KRW`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const r = Number(data?.rates?.KRW);
      if (!Number.isFinite(r)) throw new Error('bad rate');

      setFxRate(r);
      setFxMsg('');

      // 캐시(마지막 성공값) 저장
      try {
        localStorage.setItem(
          'fx_cache_v1',
          JSON.stringify({
            t: Date.now(),
            cur,
            rate: r,
          }),
        );
      } catch {}
    } catch {
      // 캐시 있으면 캐시 사용
      try {
        const raw = localStorage.getItem('fx_cache_v1');
        if (raw) {
          const c = JSON.parse(raw);
          if (c && c.cur === cur && Number.isFinite(Number(c.rate))) {
            setFxRate(Number(c.rate));
            setFxMsg('⚠️ 실시간 환율 실패 → 마지막 저장값 사용');
            return;
          }
        }
      } catch {}
      setFxRate(null);
      setFxMsg('⚠️ 환율을 불러오지 못했습니다. 네트워크/브라우저 설정을 확인하세요.');
    }
  };

  // 최초 1회 + 통화 변경 시 자동 갱신
  useEffect(() => {
    fetchFxRate(fxCur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxCur]);

  // ✅ FX 계산(외화 → 원화) : 선택통화 금액을 입력하고 FX 누르면 KRW 결과
  const handleFxToKRW = () => {
    setAgeInfo('');

    const amt = Number(display);
    if (!Number.isFinite(amt)) {
      setFxMsg('⚠️ 금액이 올바르지 않습니다.');
      return;
    }
    if (!fxRate) {
      setFxMsg('⚠️ 환율이 없습니다. RATE로 다시 불러오세요.');
      return;
    }

    const krw = amt * fxRate;
    setExpr(`FX ${formatDisplay(String(amt))} ${fxCur} → KRW`);
    setDisplay(krw.toFixed(2)); // 결과는 보기 편하게 2자리
    setWaitingForNewValue(true);
    setFxMsg('');
  };

  const fxRateText = useMemo(() => {
    if (!fxRate) return `1 ${fxCur} = — KRW`;
    return `1 ${fxCur} = ${fxRate.toFixed(2)} KRW`;
  }, [fxCur, fxRate]);

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
          {/* ✅ 홈 화면에 추가(바로가기) */}
          <button
            onClick={onInstallClick}
            className="mb-3 w-full rounded-xl bg-zinc-900 px-4 py-3 text-center font-bold text-white shadow-lg hover:bg-zinc-800 active:bg-zinc-950"
          >
            ⬇️ 홈 화면에 추가(바로가기)
          </button>

          <OnlineStats />

          {/* ✅ 바로가기 버튼 영역 (활쏘기 삭제, 수평계 메뉴 추가) */}
          <div className="mt-4 mb-4 grid grid-cols-2 gap-2">
            <Link
              href="/cannon"
              className="rounded-lg bg-blue-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-blue-600 active:bg-blue-700"
            >
              🎯 포쏘기
            </Link>

            <Link
              href="/level"
              className="rounded-lg bg-emerald-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-emerald-700 active:bg-emerald-800"
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

          {/* ✅ FX(환율) - 단순형: 통화선택 + RATE + FX(원화계산) */}
          <div className="mb-4 rounded-2xl bg-gray-100 p-4 dark:bg-gray-900/40">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm tracking-widest text-gray-800 dark:text-white/80">FX → KRW</div>
              <button
                onClick={() => fetchFxRate(fxCur)}
                className="rounded-xl bg-zinc-900 px-3 py-2 font-mono text-xs text-white hover:bg-zinc-800 active:bg-zinc-950"
                title="환율 새로고침"
              >
                RATE ↻
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_88px] gap-3">
              <select
                value={fxCur}
                onChange={(e) => setFxCur(e.target.value as FxCur)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-lg font-bold shadow-sm outline-none dark:border-white/10 dark:bg-gray-950 dark:text-white"
              >
                <option value="USD">{FX_LABEL.USD}</option>
                <option value="CNY">{FX_LABEL.CNY}</option>
                <option value="EUR">{FX_LABEL.EUR}</option>
                <option value="JPY">{FX_LABEL.JPY}</option>
              </select>

              <button
                onClick={handleFxToKRW}
                className="rounded-xl bg-indigo-600 px-3 py-3 text-lg font-extrabold text-white hover:bg-indigo-700 active:bg-indigo-800"
                title="현재 입력한 금액(외화)을 원화로 계산"
              >
                FX
              </button>
            </div>

            <div className="mt-2 font-mono text-sm text-gray-700 dark:text-white/70">{fxRateText}</div>
            {fxMsg && <div className="mt-1 font-mono text-sm text-rose-600 dark:text-rose-200">{fxMsg}</div>}
          </div>

          {/* ✅ 계산 과정 + 결과창 (폭 고정: w-full / 줄바꿈 방지) */}
          <div className="mb-6 w-full rounded-2xl bg-gray-900 p-6 text-right dark:bg-gray-950">
            <div className="min-h-[18px] w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm text-white/60">
              {expr || '\u00A0'}
            </div>

            <div className="min-h-[60px] w-full overflow-hidden text-ellipsis whitespace-nowrap text-4xl font-mono font-semibold text-white">
              {formatDisplay(display)}
            </div>

            {/* 나이/띠 결과 */}
            <div className="min-h-[22px] w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
              {ageInfo ? <span className="text-emerald-200">{ageInfo}</span> : <span className="opacity-0">.</span>}
            </div>
          </div>

          {/* ✅ Buttons */}
          <div className="grid grid-cols-4 gap-3">
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

            <button
              onClick={() => handleNumber('7')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              7
            </button>
            <button
              onClick={() => handleNumber('8')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              8
            </button>
            <button
              onClick={() => handleNumber('9')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              9
            </button>
            <button
              onClick={() => handleOperation('÷')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              ÷
            </button>

            <button
              onClick={() => handleNumber('4')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              4
            </button>
            <button
              onClick={() => handleNumber('5')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              5
            </button>
            <button
              onClick={() => handleNumber('6')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              6
            </button>
            <button
              onClick={() => handleOperation('×')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              ×
            </button>

            <button
              onClick={() => handleNumber('1')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              1
            </button>
            <button
              onClick={() => handleNumber('2')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              2
            </button>
            <button
              onClick={() => handleNumber('3')}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              3
            </button>
            <button
              onClick={() => handleOperation('-')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              −
            </button>

            <button
              onClick={() => handleNumber('0')}
              className="col-span-2 rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              0
            </button>
            <button
              onClick={handleDecimal}
              className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              .
            </button>
            <button
              onClick={handleEquals}
              className="rounded-lg bg-green-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-600 active:bg-green-700"
            >
              =
            </button>

            <button
              onClick={() => handleOperation('+')}
              className="col-span-4 rounded-lg bg-orange-500 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
