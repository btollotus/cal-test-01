'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Hand = 'rock' | 'paper' | 'scissors';
type Phase = 'idle' | 'countdown' | 'reveal';

const HANDS: { key: Hand; label: string; emoji: string }[] = [
  { key: 'rock', label: '바위', emoji: '✊' },
  { key: 'paper', label: '보', emoji: '✋' },
  { key: 'scissors', label: '가위', emoji: '✌️' },
];

function pickComputerHand(): Hand {
  const r = Math.random();
  if (r < 1 / 3) return 'rock';
  if (r < 2 / 3) return 'paper';
  return 'scissors';
}

function judge(player: Hand, cpu: Hand): 'win' | 'lose' | 'draw' {
  if (player === cpu) return 'draw';
  if (
    (player === 'rock' && cpu === 'scissors') ||
    (player === 'paper' && cpu === 'rock') ||
    (player === 'scissors' && cpu === 'paper')
  ) return 'win';
  return 'lose';
}

// ✅ WebAudio 효과음 (파일 없이 코드로 생성)
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private inited = false;

  ensureInit() {
    if (this.inited && this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.inited = true;
    } catch {
      // 오디오 불가 환경이면 조용히 패스
    }
  }

  private resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  private beep(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.25) {
    this.ensureInit();
    this.resume();
    if (!this.ctx || !this.master) return;

    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);

    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);

    o.connect(g);
    g.connect(this.master);

    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  tick() { this.beep(520, 0.08, 'square', 0.18); }         // 3,2,1
  go() { this.beep(860, 0.12, 'sawtooth', 0.22); }         // GO
  win() { this.beep(880, 0.12, 'triangle', 0.22); setTimeout(() => this.beep(1320, 0.14, 'triangle', 0.22), 90); }
  lose() { this.beep(220, 0.18, 'sine', 0.20); setTimeout(() => this.beep(160, 0.20, 'sine', 0.20), 90); }
  draw() { this.beep(440, 0.12, 'sine', 0.18); }
  late() { this.beep(120, 0.28, 'square', 0.25); }
}

export default function RpsPage() {
  const sfxRef = useRef(new Sfx());

  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState<number>(3);
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);

  const [playerPick, setPlayerPick] = useState<Hand | null>(null);
  const [cpuPick, setCpuPick] = useState<Hand | null>(null);

  const [result, setResult] = useState<string>('');
  const [score, setScore] = useState({ win: 0, lose: 0, draw: 0, late: 0 });

  const [msLeft, setMsLeft] = useState<number>(0);

  const canPick = phase === 'countdown';

  const resetRound = () => {
    setPhase('idle');
    setCount(3);
    setDeadlineTs(null);
    setPlayerPick(null);
    setCpuPick(null);
    setResult('');
    setMsLeft(0);
  };

  const startRound = () => {
    sfxRef.current.ensureInit();
    setPlayerPick(null);
    setCpuPick(null);
    setResult('');
    setCount(3);
    setPhase('countdown');

    // 3초 카운트 종료 시점(= 제출 마감) : 지금부터 3초 후
    const dl = Date.now() + 3000;
    setDeadlineTs(dl);
  };

  // ✅ 카운트다운 + 남은 시간 표시
  useEffect(() => {
    if (phase !== 'countdown' || !deadlineTs) return;

    let raf = 0;
    let lastSecSpoken = 3;

    const loop = () => {
      const now = Date.now();
      const left = Math.max(0, deadlineTs - now);
      setMsLeft(left);

      const sec = Math.ceil(left / 1000); // 3..2..1..0
      setCount(sec);

      if (sec !== lastSecSpoken && sec > 0) {
        lastSecSpoken = sec;
        sfxRef.current.tick();
      }

      // 마감(0초)인데 아직 선택 안 했으면 "늦음 패배"
      if (left <= 0) {
        if (!playerPick) {
          sfxRef.current.late();
          setPhase('reveal');
          setCpuPick(pickComputerHand());
          setResult('⏰ 늦으셨습니다. 이번 판은 패배입니다.');
          setScore((s) => ({ ...s, late: s.late + 1, lose: s.lose + 1 }));
        }
        return;
      }

      raf = requestAnimationFrame(loop);
    };

    // 시작 비프 (3부터 바로 표시되니 첫 tick은 생략하고 2로 내려갈 때부터 나게 함)
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, [phase, deadlineTs, playerPick]);

  const finalize = (picked: Hand) => {
    if (phase !== 'countdown') return;
    if (!deadlineTs) return;

    const now = Date.now();
    if (now > deadlineTs) {
      // 이론상 거의 안 걸리지만 안전장치
      sfxRef.current.late();
      setPhase('reveal');
      setCpuPick(pickComputerHand());
      setResult('⏰ 늦으셨습니다. 이번 판은 패배입니다.');
      setScore((s) => ({ ...s, late: s.late + 1, lose: s.lose + 1 }));
      return;
    }

    sfxRef.current.go();

    const cpu = pickComputerHand();
    const j = judge(picked, cpu);

    setPlayerPick(picked);
    setCpuPick(cpu);
    setPhase('reveal');

    if (j === 'win') {
      sfxRef.current.win();
      setResult('🎉 승리!');
      setScore((s) => ({ ...s, win: s.win + 1 }));
    } else if (j === 'lose') {
      sfxRef.current.lose();
      setResult('😵 패배...');
      setScore((s) => ({ ...s, lose: s.lose + 1 }));
    } else {
      sfxRef.current.draw();
      setResult('😐 무승부');
      setScore((s) => ({ ...s, draw: s.draw + 1 }));
    }
  };

  const playerEmoji = useMemo(() => {
    if (!playerPick) return '❔';
    return HANDS.find(h => h.key === playerPick)?.emoji ?? '❔';
  }, [playerPick]);

  const cpuEmoji = useMemo(() => {
    if (!cpuPick) return '❔';
    return HANDS.find(h => h.key === cpuPick)?.emoji ?? '❔';
  }, [cpuPick]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-lg bg-gray-600 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            ← 홈
          </Link>

          <button
            onClick={() => { sfxRef.current.ensureInit(); }}
            className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            🔊 소리 활성화
          </button>
        </div>

        <h1 className="mb-4 text-center text-2xl font-extrabold text-gray-900 dark:text-gray-100">
          ✊✋✌️ 가위바위보 (3초 제한)
        </h1>

        {/* 상태/타이머 */}
        <div className="mb-4 rounded-xl bg-gray-900 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="text-sm opacity-90">상태</div>
            <div className="text-sm opacity-90">
              {phase === 'countdown' ? `남은 시간: ${(msLeft / 1000).toFixed(2)}s` : '—'}
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between">
            <div className="text-lg font-bold">
              {phase === 'idle' && '시작 버튼을 누르시면 3초 카운트 후 제출합니다.'}
              {phase === 'countdown' && `카운트: ${count} (3초 안에 선택)` }
              {phase === 'reveal' && result}
            </div>
          </div>
        </div>

        {/* 대결 표시 */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-100 p-4 text-center dark:bg-gray-700">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">나</div>
            <div className="mt-2 text-5xl">{phase === 'reveal' ? playerEmoji : '❔'}</div>
          </div>
          <div className="rounded-xl bg-gray-100 p-4 text-center dark:bg-gray-700">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">컴퓨터</div>
            <div className="mt-2 text-5xl">{phase === 'reveal' ? cpuEmoji : '❔'}</div>
          </div>
        </div>

        {/* 선택 버튼 */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          {HANDS.map((h) => (
            <button
              key={h.key}
              onClick={() => finalize(h.key)}
              disabled={!canPick}
              className={[
                "rounded-xl px-3 py-4 text-lg font-extrabold transition",
                canPick
                  ? "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700"
                  : "bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300 cursor-not-allowed",
              ].join(' ')}
            >
              <div className="text-3xl">{h.emoji}</div>
              <div className="mt-1">{h.label}</div>
            </button>
          ))}
        </div>

        {/* 조작 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={startRound}
            disabled={phase === 'countdown'}
            className={[
              "flex-1 rounded-xl px-4 py-3 text-lg font-bold text-white transition",
              phase === 'countdown'
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 active:bg-green-700",
            ].join(' ')}
          >
            ▶ 시작
          </button>

          <button
            onClick={resetRound}
            className="flex-1 rounded-xl bg-gray-600 px-4 py-3 text-lg font-bold text-white hover:bg-gray-500 active:bg-gray-700"
          >
            🔄 리셋
          </button>
        </div>

        {/* 점수 */}
        <div className="mt-4 rounded-xl bg-white/60 p-3 text-sm text-gray-800 dark:bg-gray-900/30 dark:text-gray-200">
          <div className="flex justify-between">
            <span>승</span><span className="font-bold">{score.win}</span>
            <span>패</span><span className="font-bold">{score.lose}</span>
            <span>무</span><span className="font-bold">{score.draw}</span>
            <span>늦음</span><span className="font-bold">{score.late}</span>
          </div>
          <div className="mt-2 text-xs opacity-80">
            안내: 시작 후 3초 안에 선택해야 합니다. 시간이 지나면 자동으로 패배 처리됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}
