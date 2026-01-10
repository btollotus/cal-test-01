'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

function genLottoSix(): number[] {
  const set = new Set<number>();
  while (set.size < 6) {
    const n = Math.floor(Math.random() * 45) + 1; // 1~45
    set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export default function LottoPage() {
  const [current, setCurrent] = useState<number[] | null>(null);
  const [history, setHistory] = useState<number[][]>([]);

  const last10 = useMemo(() => history.slice(0, 10), [history]);

  const handleGenerate = () => {
    const nums = genLottoSix();
    setCurrent(nums);
    setHistory((prev) => [nums, ...prev]);
  };

  const handleReset = () => {
    setCurrent(null);
    setHistory([]);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-4 md:p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/"
            className="inline-block rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600"
          >
            ← 홈으로
          </Link>

          <div className="text-xs text-gray-500 dark:text-gray-300">
            1~45 중 6개 자동 추출
          </div>
        </div>

        <h1 className="mb-4 text-center text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          🎲 로또번호 생성기
        </h1>

        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900">
          {current ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {current.map((n) => (
                <span
                  key={n}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-bold text-gray-900 shadow dark:bg-gray-800 dark:text-gray-100"
                >
                  {n}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              아래 “생성”을 누르면 번호가 나옵니다.
            </div>
          )}
        </div>

        <div className="mb-5 flex gap-3">
          <button
            onClick={handleGenerate}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-500 active:bg-blue-700"
          >
            🎯 생성
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg bg-gray-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-500 active:bg-gray-700"
          >
            🧹 초기화
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              최근 생성 기록 (최대 10개 표시)
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-300">
              총 {history.length}회 생성
            </div>
          </div>

          {last10.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-300">기록이 없습니다.</div>
          ) : (
            <ul className="space-y-2">
              {last10.map((nums, idx) => (
                <li
                  key={`${nums.join('-')}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"
                >
                  <span className="font-mono text-gray-700 dark:text-gray-200">
                    {nums.join('  ')}
                  </span>
                  {idx === 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                      최신
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 참고 섹션 */}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-300">
          “최근 1등 판매점(어디서 나왔는지)” 표시는 공식/외부 데이터 소스를 붙이면 가능합니다. 아래 설명을 참고해 주세요.
        </div>
      </div>
    </div>
  );
}
