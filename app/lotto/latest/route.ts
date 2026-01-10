'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Latest = {
  drawNo: number;
  drawDate?: string;
  numbers?: number[];
  bonus?: number;
  firstStore?: { region?: string; name?: string } | null;
};

export default function LottoPage() {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [loading, setLoading] = useState(true);

  // 생성기 상태(예시)
  const [history, setHistory] = useState<number[][]>([]);

  const generate = () => {
    const set = new Set<number>();
    while (set.size < 6) set.add(Math.floor(Math.random() * 45) + 1);
    const nums = Array.from(set).sort((a, b) => a - b);
    setHistory((prev) => [nums, ...prev]);
  };

  const reset = () => setHistory([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/lotto/latest', { cache: 'no-store' });
        const json = await res.json();
        if (json?.ok) setLatest(json.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const latestText = useMemo(() => {
    if (!latest) return null;
    const nums = latest.numbers?.join(', ');
    const bonus = latest.bonus != null ? ` + [${latest.bonus}]` : '';
    const date = latest.drawDate ? ` (${latest.drawDate})` : '';
    return `${latest.drawNo}회${date} : ${nums ?? '번호 불러오기 실패'}${bonus}`;
  }, [latest]);

  return (
    <div className="min-h-[100dvh] bg-gray-100 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-4 shadow dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/" className="rounded-lg bg-gray-500 px-3 py-2 text-sm font-semibold text-white">
            ← 홈
          </Link>
          <div className="text-sm text-gray-600 dark:text-gray-300">로또 번호 생성기</div>
        </div>

        {/* ✅ 최근 1회차: 1개만 */}
        <div className="mb-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
          <div className="text-xs text-gray-500 dark:text-gray-400">최근 1회차</div>
          <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {loading ? '불러오는 중...' : (latestText ?? '데이터 없음')}
          </div>

          {/* ✅ 최신 1회차 기준 1등 판매점(지역/상호) 1개만 */}
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            1등 판매점(1개):{' '}
            {latest?.firstStore?.name
              ? `${latest.firstStore.region ?? ''} / ${latest.firstStore.name}`
              : '불러오기 실패 또는 정보 없음'}
          </div>
        </div>

        {/* 생성/초기화 */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={generate}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white active:bg-blue-700"
          >
            🎲 생성
          </button>
          <button
            onClick={reset}
            className="flex-1 rounded-xl bg-gray-700 px-4 py-3 text-sm font-bold text-white active:bg-gray-800"
          >
            ♻ 초기화
          </button>
        </div>

        {/* 결과 */}
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              생성 버튼을 누르면 번호가 나옵니다.
            </div>
          ) : (
            history.map((nums, idx) => (
              <div key={idx} className="rounded-xl bg-gray-50 p-3 text-sm font-semibold dark:bg-gray-900/40">
                {nums.join(' · ')}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
