'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export default function LottoPage() {
  const [history, setHistory] = useState<number[][]>([]);

  const current = history[0] ?? null;

  const generate = () => {
    const set = new Set<number>();
    while (set.size < 6) set.add(Math.floor(Math.random() * 45) + 1);
    const nums = Array.from(set).sort((a, b) => a - b);

    setHistory((prev) => {
      const next = [nums, ...prev];
      return next.slice(0, 10); // 최근 10개만 보관(원하면 변경)
    });
  };

  const reset = () => setHistory([]);

  const totalCount = useMemo(() => history.length, [history]);

  return (
    <div className="min-h-[100dvh] bg-gray-100 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-4 shadow dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-lg bg-gray-500 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600 active:bg-gray-700"
          >
            ← 홈으로
          </Link>

          <div className="text-xs text-gray-600 dark:text-gray-300">
            1~45 중 6개 자동 추출
          </div>
        </div>

        {/* ✅ 제목: 주사위 → 복주머니 */}
        <h1 className="mb-4 text-center text-2xl font-extrabold text-gray-900 dark:text-gray-100">
          🧧 로또번호 생성기
        </h1>

        {/* ✅ 번호 표시 영역 (무조건 한 줄 / 좁으면 가로 스크롤) */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
          {current ? (
            <div className="overflow-x-auto">
              <div className="inline-flex min-w-max items-center justify-center gap-3 whitespace-nowrap">
                {current.map((n) => (
                  <div
                    key={n}
                    className="grid h-14 w-14 place-items-center rounded-full bg-white text-lg font-extrabold text-gray-900 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              생성 버튼을 누르면 번호가 표시됩니다.
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            onClick={generate}
            className="rounded-xl bg-blue-600 px-4 py-4 text-base font-extrabold text-white hover:bg-blue-700 active:bg-blue-800"
          >
            🎯 생성
          </button>
          <button
            onClick={reset}
            className="rounded-xl bg-gray-700 px-4 py-4 text-base font-extrabold text-white hover:bg-gray-800 active:bg-gray-900"
          >
            🧹 초기화
          </button>
        </div>

        {/* 최근 기록 */}
        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
              최근 생성 기록 (최대 10개 표시)
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              총 {totalCount}회 생성
            </div>
          </div>

          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              아직 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((nums, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-900 dark:bg-gray-900/40 dark:text-gray-100"
                >
                  {nums.join('  ')}
                  {idx === 0 && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                      최신
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ 녹색 박스(안내 문구) 삭제 완료 */}
        {/* ✅ 최근 1등 당첨 판매점/당첨 정보 표시 삭제 완료 */}
      </div>
    </div>
  );
}
