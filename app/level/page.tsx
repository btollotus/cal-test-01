import LevelWidget from '@/components/LevelWidget';

export default function LevelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 font-mono text-xs tracking-widest text-gray-600 dark:text-gray-300">
          LEVEL HUD
        </div>
        <LevelWidget />
      </div>
    </div>
  );
}
