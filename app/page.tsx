'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import OnlineStats from '@/components/OnlineStats';
import LevelWidget from '@/components/LevelWidget';
import CompassWidget from '@/components/CompassWidget';

export default function Home() {
  // ✅ Intro 상태
  const [showIntro, setShowIntro] = useState(true);

  // ✅ 계산기 상태들
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

  // ✅ “식(과정)” 표시용
  const [expression, setExpression] = useState<string>(''); // 예: "1 + 1" / "1 + 1 = 2"

  // ✅ Intro 타이밍 제어
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);

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

  const handleNumber = (num: string) => {
    if (error) {
      setDisplay(num);
      setError(false);
      setWaitingForNewValue(false);
      setExpression('');
      return;
    }

    // ✅ 결과가 나온 뒤(= 눌러 waitingForNewValue=true, operation=null) 숫자 누르면 새 계산 시작
    if (waitingForNewValue && operation === null && previousValue === null) {
      setDisplay(num);
      setWaitingForNewValue(false);
      setExpression('');
      return;
    }

    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperation = (op: string) => {
    if (error) return;

    const currentValue = parseFloat(display);

    // ✅ 첫 연산
    if (previousValue === null) {
      setPreviousValue(currentValue);
      setOperation(op);
      setWaitingForNewValue(true);
      setExpression(`${display} ${op}`);
      return;
    }

    // ✅ 연속 계산(예: 2 + 3 × 4 ...)
    if (operation) {
      const result = calculate(previousValue, currentValue, operation);
      if (result === null) {
        setDisplay('Error');
        setError(true);
        setPreviousValue(null);
        setOperation(null);
        setExpression('');
        return;
      }

      setPreviousValue(result);
      setDisplay(String(result));
      setOperation(op);
      setWaitingForNewValue(true);

      // 식 갱신: "2 + 3"까지 보여주고 다음 연산자로 이어감
      setExpression(`${result} ${op}`);
      return;
    }

    // ✅ operation이 없는데 previousValue가 있는 경우(특수 케이스): 그냥 연산 설정
    setOperation(op);
    setWaitingForNewValue(true);
    setExpression(`${display} ${op}`);
  };

  const handleEquals = () => {
    if (error || operation === null || previousValue === null) return;

    const currentValue = parseFloat(display);
    const result = calculate(previousValue, currentValue, operation);

    if (result === null) {
      setDisplay('Error');
      setError(true);
      setExpression('');
    } else {
      // ✅ 식을 "A op B = C" 형태로 확정 표시
      setExpression(`${previousValue} ${operation} ${currentValue} = ${result}`);
      setDisplay(String(result));
    }

    // ✅ 다음 입력을 새 계산으로 받게 초기화
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
    setExpression('');
  };

  const handleBackspace = () => {
    if (error) {
      handleClear();
      return;
    }

    if (waitingForNewValue) return;

    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const handleDecimal = () => {
    if (error) {
      setDisplay('0.');
      setError(false);
      setWaitingForNewValue(false);
      setExpression('');
      return;
    }

    // ✅ 결과 직후 새 계산 시작
    if (waitingForNewValue && operation === null && previousValue === null) {
      setDisplay('0.');
      setWaitingForNewValue(false);
      setExpression('');
      return;
    }

    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
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

          {/* 🧭 나침반 */}
          <div className="mb-6">
            <CompassWidget />
          </div>

          {/* ✅ 계산 결과창 (식 + 결과) */}
          <div className="mt-2 mb-6 rounded-lg bg-gray-900 p-5 text-right dark:bg-gray-950">
            {/* 식(과정) */}
            <div className="min-h-[20px] font-mono text-sm text-white/55">
              {expression || '\u00A0'}
            </div>

            {/* 결과 */}
            <div className="mt-2 min-h-[56px] text-4xl font-mono font-semibold text-white">
              {formatDisplay(display)}
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
            <button
              onClick={() => handleOperation('÷')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              ÷
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
            <button
              onClick={() => handleOperation('×')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              ×
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
            <button
              onClick={() => handleOperation('-')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              −
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
            <button
              onClick={() => handleOperation('+')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              +
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
          </div>
        </div>
      </div>
    </>
  );
}
