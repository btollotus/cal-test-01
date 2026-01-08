'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [error, setError] = useState(false);

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

  const calculate = (prev: number, current: number, op: string): number | null => {
    switch (op) {
      case '+':
        return prev + current;
      case '-':
        return prev - current;
      case '×':
        return prev * current;
      case '÷':
        if (current === 0) {
          return null;
        }
        return prev / current;
      default:
        return current;
    }
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

    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
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

  // 이모지를 결정하는 함수
  const getEmoji = (value: string): string => {
    // Error나 빈값이면 이모지 없음
    if (value === 'Error' || value === '' || error) {
      return '';
    }

    // 숫자로 파싱 시도
    const numValue = parseFloat(value);
    
    // 숫자가 아니면 이모지 없음
    if (isNaN(numValue)) {
      return '';
    }

    // 절댓값 기준으로 이모지 결정
    const absValue = Math.abs(numValue);
    if (absValue >= 10000) {
      return ' 🎉';
    } else if (absValue >= 1000) {
      return ' 🙂';
    }
    
    return '';
  };

  // 숫자 포맷팅 함수 (천 단위 구분 기호 추가)
  const formatDisplay = (value: string): string => {
    // Error나 빈값이면 그대로 반환
    if (value === 'Error' || value === '' || error) {
      return value;
    }

    // 숫자로 파싱 시도
    const numValue = parseFloat(value);
    
    // 숫자가 아니면 그대로 반환
    if (isNaN(numValue)) {
      return value;
    }

    // 소수점이 있으면 정수부와 소수부 분리
    if (value.includes('.')) {
      const [integerPart, decimalPart] = value.split('.');
      const formattedInteger = parseFloat(integerPart).toLocaleString('en-US');
      return `${formattedInteger}.${decimalPart}`;
    }

    // 정수만 있으면 천 단위 구분 기호 추가
    return numValue.toLocaleString('en-US');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 flex gap-2">
          <Link
            href="/cannon"
            className="flex-1 rounded-lg bg-blue-500 px-4 py-3 text-center text-lg font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
          >
            🎯 포쏘기
          </Link>
          <Link
            href="/archery"
            className="flex-1 rounded-lg bg-green-500 px-4 py-3 text-center text-lg font-semibold text-white transition-colors hover:bg-green-600 active:bg-green-700"
          >
            🏹 활쏘기
          </Link>
        </div>
        {/* Display */}
        <div className="mb-6 rounded-lg bg-gray-900 p-6 text-right dark:bg-gray-950">
          <div className="min-h-[60px] text-4xl font-mono font-semibold text-white">
            {formatDisplay(display)}{getEmoji(display)}
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-4 gap-3">
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
            onClick={() => handleOperation('÷')}
            className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
          >
            ÷
          </button>

          {/* Row 2 */}
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
            onClick={() => handleOperation('×')}
            className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
          >
            ×
          </button>

          {/* Row 3 */}
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
            onClick={() => handleOperation('-')}
            className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
          >
            −
          </button>

          {/* Row 4 */}
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
            onClick={() => handleOperation('+')}
            className="rounded-lg bg-orange-500 px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
          >
            +
          </button>

          {/* Row 5 */}
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
  );
}
