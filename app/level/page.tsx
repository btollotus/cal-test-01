'use client';

import LevelWidget from '@/components/LevelWidget';
import Link from 'next/link';

export default function LevelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <Link href="/" className="mb-4 inline-block rounded-lg bg-zinc-900 px-3 py-2 text-sm font-bold text-white dark:bg-white dark:text-black">
          ← 홈으로
        </Link>

        <LevelWidget />
      </div>
    </div>
  );
}
