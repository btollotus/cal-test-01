'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import OnlineStats from "@/components/OnlineStats";


export default function Home() {
  // ✅ Intro 상태
  const [showIntro, setShowIntro] = useState(true);

  // 계산기 상태들 (기존 그대로)
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

  // ✅ Intro 타이밍 제어
  useEffect(() => {
    // 3초 후 인트로 제거
    const t = setTimeout(() => setShowIntro(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const handleNumber = (num: string) => {
    if (error) {
      setDisplay(num);
      setError(false);
      setWaitingForNewValue(false);
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

    const currentValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(currentValue);
    } else if (operation) {
      const result = calculate(previousValue, currentValue, operation);
      if (result === null) {
        setDisplay('Error');
        setError(true);
        setPreviousValue(null);
        setOperation(null);
        return;
      }
      setPreviousValue(result);
      setDisplay(String(result));
    }

    setOperation(op);
    setWaitingForNewValue(true);
  };

  const handleEquals = () => {
    if (error || operation === null || previousValue === null) return;

    const currentValue = parseFloat(display);
    const result = calculate(previousValue, currentValue, operation);

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
  };

  const handleBackspace = () => {
    if (error) {
      handleClear();
      return;
    }

    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const handleDecimal = () => {
    if (error) {
      setDisplay('0.');
      setError(false);
      setWaitingForNewValue(false);
      return;
    }

    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const getEmoji = (value: string): string => {
    if (value === 'Error' || value === '' || error) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    const absValue = Math.abs(numValue);
    if (absValue >= 10000) return ' 🎉';
    if (absValue >= 1000) return ' 🙂';
    return '';
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

          {/* ✅ 바로가기 버튼 영역 */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Link
              href="/cannon"
              className="rounded-lg bg-blue-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-blue-600 active:bg-blue-700"
            >
              🎯 포쏘기
            </Link>

            <Link
              href="/archery"
              className="rounded-lg bg-green-500 px-3 py-3 text-center text-base font-bold text-white hover:bg-green-600 active:bg-green-700"
            >
              🏹 활쏘기
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

            {/* ✅ NEW: 겔러그(갈라가) 버튼 */}
            <Link
              href="/galaga"
              className="rounded-lg bg-sky-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-sky-700 active:bg-sky-800"
            >
              🛸 겔러그
            </Link>

            {/* ✅ 로또 버튼 */}
            <Link
              href="/lotto"
              className="rounded-lg bg-amber-600 px-3 py-3 text-center text-base font-bold text-white hover:bg-amber-700 active:bg-amber-800"
            >
              🧧 로또번호 생성기
            </Link>

            {/* 필요하면 2열 꽉 채우기: 로또를 col-span-2로 유지하고 싶으면 아래처럼 바꾸면 됨
              - 겔러그 추가로 버튼 수가 늘어서 로또가 자동으로 다음 줄로 내려가요.
              - “로또는 크게(2칸)”를 계속 원하면 로또에 col-span-2를 다시 넣으면 됩니다.
            */}
          </div>


          {/* Display */}
          <div className="mb-6 rounded-lg bg-gray-900 p-6 text-right dark:bg-gray-950">
            <div className="min-h-[60px] text-4xl font-mono font-semibold text-white">
              {formatDisplay(display)}
              {getEmoji(display)}
            </div>
          </div>

          <OnlineStats />


          {/* Buttons */}
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
              onClick={() => handleOperation('÷')}
              className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
            >
              ÷
            </button>

            <button onClick={() => handleNumber('7')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">7</button>
            <button onClick={() => handleNumber('8')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">8</button>
            <button onClick={() => handleNumber('9')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">9</button>
            <button onClick={() => handleOperation('×')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">×</button>

            <button onClick={() => handleNumber('4')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">4</button>
            <button onClick={() => handleNumber('5')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">5</button>
            <button onClick={() => handleNumber('6')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">6</button>
            <button onClick={() => handleOperation('-')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">−</button>

            <button onClick={() => handleNumber('1')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">1</button>
            <button onClick={() => handleNumber('2')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">2</button>
            <button onClick={() => handleNumber('3')} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">3</button>
            <button onClick={() => handleOperation('+')} className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700">+</button>

            <button onClick={() => handleNumber('0')} className="col-span-2 rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">0</button>
            <button onClick={handleDecimal} className="rounded-lg bg-gray-200 px-4 py-4 text-lg font-semibold text-gray-800 transition-colors hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">.</button>
            <button onClick={handleEquals} className="rounded-lg bg-green-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-600 active:bg-green-700">=</button>
          </div>
        </div>
      </div>
    </>
  );
}

