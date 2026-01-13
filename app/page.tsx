'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import OnlineStats from '@/components/OnlineStats';
import LevelWidget from '@/components/LevelWidget';
import CompassWidget from '@/components/CompassWidget';

function zodiacKorean(birthYear: number) {
  // 기준: 2008년 = 쥐띠
  const animals = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  const idx = ((birthYear - 2008) % 12 + 12) % 12;
  return animals[idx];
}

export default function Home() {
  // ✅ Intro 상태
  const [showIntro, setShowIntro] = useState(true);

  // 계산기 상태
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

  // ✅ “과정 표시(식)” 라인
  const [expr, setExpr] = useState<string>(''); // 예: "1 + 1"

  // ✅ 나이 계산 결과 라인
  const [ageInfo, setAgeInfo] = useState<string>(''); // 예: "만 41세 / 세는나이 42세 · 돼지띠"

  // ✅ Intro 타이밍
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
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

  const handleNumber = (num: string) => {
    // 나이결과는 “새 입력” 시작하면 자동으로 지움
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

    // 첫 연산 세팅
    if (previousValue === null) {
      setPreviousValue(currentValue);
      setExpr(`${formatDisplay(display)} ${op}`);
    } else if (operation) {
      // 중간 계산 진행
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

    // 식 표시는 "A op B" 형태로 남기기
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

  // ✅ NEW: 나이/띠 계산 버튼
  const handleAge = () => {
    setErrSafe(null);

    const y = parseInt(display, 10);
    const now = new Date();
    const currentYear = now.getFullYear();

    if (isNaN(y) || String(y).length !== 4 || y < 1900 || y > currentYear) {
      setAgeInfo('⚠️출생년도 4자리(예:1983)를 입력');
      return;
    }

    const birthDateUnknown = true;
    // 생일 모르면 만나이는 정확히 못 맞출 수 있어요 → 기준을 “올해 생일 지났다고 가정” 대신
    // 안내용으로: 만 나이(대략) = 올해 - 출생년도 (생일 전이면 -1)
    // 여기서는 사용자 혼란 줄이려고 "만 나이(생일 기준)"을 안내 문구 포함.
    const approxMan = currentYear - y; // 생일 지났으면 이 값, 안 지났으면 -1
    const koreanAge = currentYear - y + 1;

    const z = zodiacKorean(y);
    setExpr(`(${y})년생`);
    setAgeInfo(`세는나이 ${koreanAge}세 · ${z}띠`);
    setWaitingForNewValue(true);
  };

  // ageInfo용 에러 세팅(간단 처리)
  const [errSafe, setErrSafe] = useState<string | null>(null);

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
          {/* 바로가기 버튼 */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Link href="/cannon" className="rounded-lg bg-blue-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-blue-600 active:bg-blue-700">
              🎯 포쏘기
            </Link>
            <Link href="/archery" className="rounded-lg bg-green-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-green-600 active:bg-green-700">
              🏹 활쏘기
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
          </div>

          <OnlineStats />

          {/* 수평계 */}
          <div className="mt-4 mb-6">
            <LevelWidget />
          </div>

          {/* 나침반 */}
          <div className="mb-6">
            <CompassWidget />
          </div>

          {/* ✅ 계산 과정 + 결과창 */}
          <div className="mt-2 mb-6 rounded-lg bg-gray-900 p-6 text-right dark:bg-gray-950">
            {/* 과정(식) */}
            <div className="min-h-[18px] font-mono text-sm text-white/60">
              {expr || '\u00A0'}
            </div>

            {/* 결과값 */}
            <div className="min-h-[54px] text-4xl font-mono font-semibold text-white">
              {formatDisplay(display)}
            </div>

            {/* 나이/띠 결과 */}
            {ageInfo && (
              <div className="mt-2 font-mono text-sm text-emerald-200">
                {ageInfo}
              </div>
            )}
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

            {/* ✅ NEW: AGE 버튼 (오렌지 톤으로 맞춤) */}
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

            <button onClick={() => handleOperation('+')} className="col-span-4 rounded-lg bg-orange-500 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
