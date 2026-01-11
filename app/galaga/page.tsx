'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Bullet = { x: number; y: number; vy: number; r: number };
type Enemy = {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  diving: boolean;
  diveT: number;
  homeX: number;
  homeY: number;
};
type Explosion = { x: number; y: number; t: number };

type RankRow = {
  name: string;
  score: number;
  date: string; // ISO string
};

const STORAGE_KEY = 'jdg_galaga_leaderboard_v1';
const MAX_NAME_LEN = 5;
const MAX_RANK = 20;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatKST(iso: string) {
  // KST 표기(간단): 사용자의 브라우저 로컬 시간 사용
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** 한/영(및 숫자) 허용, 공백 제거, 길이 1~5 */
function sanitizeName(input: string) {
  const trimmed = input.replace(/\s+/g, '').slice(0, MAX_NAME_LEN);
  // 너무 빡세게 제한하면 불편해서: 한글/영문/숫자/일부 기호(_-) 정도만 허용
  const ok = trimmed.replace(/[^0-9A-Za-z가-힣_-]/g, '');
  return ok.slice(0, MAX_NAME_LEN);
}

/** 아주 가벼운 효과음(외부 mp3 없이) */
function useSfx() {
  const ctxRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);

  const ensure = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctxRef.current;
  };

  const unlock = async () => {
    if (unlockedRef.current) return;
    const ctx = ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    // 무음 1틱으로 iOS/크롬 정책 잠금 해제
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
    unlockedRef.current = true;
  };

  const beep = (freq: number, dur = 0.06, type: OscillatorType = 'square', gain = 0.06) => {
    try {
      const ctx = ensure();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {}
  };

  const shoot = () => beep(740, 0.04, 'square', 0.05);
  const hit = () => {
    beep(220, 0.05, 'sawtooth', 0.07);
    setTimeout(() => beep(140, 0.06, 'sawtooth', 0.06), 40);
  };
  const dead = () => {
    beep(180, 0.08, 'triangle', 0.08);
    setTimeout(() => beep(120, 0.12, 'triangle', 0.07), 70);
    setTimeout(() => beep(80, 0.14, 'triangle', 0.06), 150);
  };
  const clear = () => {
    beep(523, 0.05, 'square', 0.06);
    setTimeout(() => beep(659, 0.05, 'square', 0.06), 60);
    setTimeout(() => beep(784, 0.06, 'square', 0.06), 120);
  };

  return { unlock, shoot, hit, dead, clear };
}

export default function GalagaPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const sfx = useSfx();

  // UI state
  const [status, setStatus] = useState<'ready' | 'playing' | 'over' | 'submit'>('ready');
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState(1);
  const [lives, setLives] = useState(3);

  const [nameInput, setNameInput] = useState('');
  const [leaderboard, setLeaderboard] = useState<RankRow[]>([]);

  // 로컬스토리지 로딩
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLeaderboard(JSON.parse(raw));
    } catch {
      setLeaderboard([]);
    }
  }, []);

  const saveLeaderboard = (rows: RankRow[]) => {
    setLeaderboard(rows);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {}
  };

  // 랭킹 정렬된 리스트(점수 내림차순, 동점이면 날짜 최신 우선)
  const sortedBoard = useMemo(() => {
    const copy = [...leaderboard];
    copy.sort((a, b) => (b.score - a.score) || (new Date(b.date).getTime() - new Date(a.date).getTime()));
    return copy.slice(0, MAX_RANK);
  }, [leaderboard]);

  // -------------------- GAME LOOP --------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR 대응
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const W = 420;
    const H = 700;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // local game state
    let running = false;

    const player = { x: W / 2, y: H - 70, w: 34, h: 22, speed: 5 };
    let bullets: Bullet[] = [];
    let enemies: Enemy[] = [];
    let explosions: Explosion[] = [];

    let keys = { left: false, right: false, fire: false };
    let fireCooldown = 0;

    let t = 0;

    // 난이도 파라미터(스테이지에 따라 증가)
    let localStage = 1;
    let localScore = 0;
    let localLives = 3;

    const difficulty = () => {
      // 스테이지가 오를수록:
      // - 다이브 빈도 증가(값 낮을수록 자주)
      // - 다이브 속도 증가
      // - 적 탄환 추가는 나중에 확장 가능
      const diveEvery = Math.max(90, 360 - (localStage - 1) * 30); // 360→330→... 최소 90
      const diveSpeed = 2.6 + (localStage - 1) * 0.25;           // 점점 빨라짐
      const fireCd = Math.max(7, 10 - Math.floor((localStage - 1) / 2)); // 발사 쿨타임 약간 개선(재미)
      return { diveEvery, diveSpeed, fireCd };
    };

    const spawnFormation = () => {
      const cols = 8;
      const rows = 4;
      const gapX = 42;
      const gapY = 34;
      const startX = (W - (cols - 1) * gapX) / 2;
      const startY = 90;

      enemies = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * gapX;
          const y = startY + r * gapY;
          enemies.push({
            x,
            y,
            w: 26,
            h: 18,
            alive: true,
            diving: false,
            diveT: 0,
            homeX: x,
            homeY: y,
          });
          idx++;
        }
      }
    };

    const rectHit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    const resetAll = () => {
      bullets = [];
      enemies = [];
      explosions = [];
      keys = { left: false, right: false, fire: false };
      fireCooldown = 0;
      t = 0;

      localStage = 1;
      localScore = 0;
      localLives = 3;

      player.x = W / 2;

      setStage(1);
      setScore(0);
      setLives(3);
      setStatus('ready');

      running = false;
    };

    const start = async () => {
      await sfx.unlock();
      // over 상태에서 Enter 누르면 리셋 후 시작
      if (status === 'over' || status === 'submit') resetAll();

      spawnFormation();
      setStatus('playing');
      running = true;
    };

    const nextStage = () => {
      localStage += 1;
      setStage(localStage);
      sfx.clear();
      spawnFormation();
    };

    const loseLife = () => {
      localLives -= 1;
      setLives(localLives);
      sfx.dead();

      player.x = W / 2;
      bullets = [];
      explosions.push({ x: player.x, y: player.y, t: 0 });

      if (localLives <= 0) {
        running = false;
        setStatus('submit'); // 게임오버 → 이름 입력 모달 띄우기
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowRight') keys.right = true;
      if (e.key === ' ') keys.fire = true;

      if (e.key === 'Enter') {
        if (status === 'ready' || status === 'over') start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'ArrowRight') keys.right = false;
      if (e.key === ' ') keys.fire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);

      // BG
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);

      // 별
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 26; i++) ctx.fillRect(((i * 97 + t * 2) % W), ((i * 193 + t * 3) % H), 2, 2);

      // UI
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`SCORE ${localScore}`, 14, 24);
      ctx.fillText(`STAGE ${localStage}`, W / 2 - 40, 24);
      ctx.fillText(`LIVES ${localLives}`, W - 110, 24);

      // 상태 텍스트
      if (!running && (status === 'ready' || status === 'over')) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, monospace';
        const msg = status === 'over' ? 'GAME OVER - PRESS ENTER' : 'PRESS ENTER TO START';
        const w = ctx.measureText(msg).width;
        ctx.fillText(msg, (W - w) / 2, H / 2);
      }

      if (running) {
        const { diveEvery, diveSpeed, fireCd } = difficulty();

        // 플레이어
        if (keys.left) player.x -= player.speed;
        if (keys.right) player.x += player.speed;
        player.x = clamp(player.x, player.w / 2, W - player.w / 2);

        // 발사
        fireCooldown = Math.max(0, fireCooldown - 1);
        if (keys.fire && fireCooldown === 0) {
          bullets.push({ x: player.x, y: player.y - 18, vy: -8.3, r: 3 });
          fireCooldown = fireCd;
          sfx.shoot();
        }

        // 총알
        bullets = bullets
          .map((b) => ({ ...b, y: b.y + b.vy }))
          .filter((b) => b.y > -30);

        // 적 편대 흔들기 + 다이브
        t += 1;
        const sway = Math.sin(t / 60) * 0.8;

        // 다이브할 적 선택 (스테이지 올라갈수록 자주)
        if (t % diveEvery === 0) {
          const alive = enemies.filter((e) => e.alive && !e.diving);
          if (alive.length > 0) {
            const pick = alive[Math.floor(Math.random() * alive.length)];
            pick.diving = true;
            pick.diveT = 0;
          }
        }

        enemies.forEach((e, idx) => {
          if (!e.alive) return;

          if (!e.diving) {
            // 대열 유지 + 좌우 흔들림
            e.x = e.homeX + sway;
            e.y = e.homeY + Math.sin((t + idx) / 80) * 0.2;
          } else {
            // 다이브: 아래로 내려오며 사인 곡선
            e.diveT += 1;
            e.y += diveSpeed;
            e.x += Math.sin((e.diveT + idx) / 10) * 2.2;

            // 화면 아래로 빠지면 원위치 복귀(다음 공격 위해)
            if (e.y > H + 40) {
              e.diving = false;
              e.diveT = 0;
              e.x = e.homeX;
              e.y = e.homeY;
            }
          }
        });

        // 충돌: 총알 vs 적
        for (const b of bullets) {
          for (const e of enemies) {
            if (!e.alive) continue;
            if (rectHit(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
              e.alive = false;
              b.y = -9999;
              localScore += 100 + (localStage - 1) * 10; // 스테이지 보너스
              setScore(localScore);
              explosions.push({ x: e.x, y: e.y, t: 0 });
              sfx.hit();
              break;
            }
          }
        }
        bullets = bullets.filter((b) => b.y > -1000);

        // 충돌: 적 vs 플레이어
        for (const e of enemies) {
          if (!e.alive) continue;
          if (rectHit(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
            e.alive = false;
            loseLife();
            break;
          }
        }

        // 스테이지 클리어
        if (enemies.every((e) => !e.alive)) {
          nextStage();
        }
      }

      // 폭발 이펙트(간단)
      explosions = explosions
        .map((ex) => ({ ...ex, t: ex.t + 1 }))
        .filter((ex) => ex.t < 18);

      for (const ex of explosions) {
        const r = ex.t * 2.2;
        ctx.strokeStyle = `rgba(255,200,80,${1 - ex.t / 18})`;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // DRAW: player
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 14);
      ctx.lineTo(player.x - 18, player.y + 12);
      ctx.lineTo(player.x + 18, player.y + 12);
      ctx.closePath();
      ctx.fill();

      // bullets
      ctx.fillStyle = '#fbbf24';
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // enemies
      for (const e of enemies) {
        if (!e.alive) continue;
        ctx.fillStyle = e.diving ? '#fb7185' : '#60a5fa'; // 다이브 중 색 변경
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(e.x - 6, e.y - 3, 12, 6);
      }

      // frame
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(10, 40, W - 20, H - 60);
    };

    loop();

    // 컴포넌트 밖으로 점수/스테이지/라이프 동기화는:
    // 내부 localScore/localStage/localLives를 setScore 등으로 유지.
    // 여기서는 리셋/스타트/라이프변화/점수 증가 시 이미 set하고 있음.

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]); // status만 의존(ready/playing/submit 전환 대응)

  // -------------------- SUBMIT SCORE --------------------
  const submitScore = () => {
    const safe = sanitizeName(nameInput);
    if (!safe || safe.length < 1) return;

    const row: RankRow = {
      name: safe,
      score,
      date: new Date().toISOString(),
    };

    const next = [...leaderboard, row]
      .sort((a, b) => (b.score - a.score) || (new Date(b.date).getTime() - new Date(a.date).getTime()))
      .slice(0, MAX_RANK);

    saveLeaderboard(next);
    setNameInput('');
    setStatus('over'); // 제출 후 over 화면(엔터로 재시작 가능)
  };

  const resetRanking = () => {
    saveLeaderboard([]);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-[520px] flex items-center justify-between">
        <Link href="/" className="text-sm font-mono opacity-80 hover:opacity-100">
          ← HOME
        </Link>
        <div className="text-sm font-mono opacity-80">← → 이동 / SPACE 발사 / ENTER 시작</div>
      </div>

      <div className="w-full max-w-[520px] grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4 items-start">
        {/* GAME */}
        <div className="rounded-2xl p-3 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <canvas ref={canvasRef} className="rounded-xl" />
          <div className="mt-3 flex items-center justify-between text-xs font-mono opacity-80">
            <div>SCORE: {score}</div>
            <div>STAGE: {stage}</div>
            <div>LIVES: {lives}</div>
          </div>
          <div className="mt-2 text-xs font-mono opacity-60">
            * 효과음이 안 나면 화면을 한 번 클릭/키입력(ENTER) 후 시작하세요(브라우저 정책).
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="rounded-2xl p-4 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm">🏆 RANKING</div>
            <button
              onClick={resetRanking}
              className="text-xs font-mono opacity-70 hover:opacity-100"
            >
              reset
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[40px_1fr_70px] gap-2 text-[11px] font-mono opacity-70">
            <div>순위</div>
            <div>이름 / 날짜</div>
            <div className="text-right">점수</div>
          </div>

          <div className="mt-2 space-y-2">
            {sortedBoard.length === 0 ? (
              <div className="text-xs font-mono opacity-60">아직 기록이 없습니다.</div>
            ) : (
              sortedBoard.map((r, i) => (
                <div key={`${r.name}-${r.date}-${i}`} className="grid grid-cols-[40px_1fr_70px] gap-2 text-xs font-mono">
                  <div className="opacity-80">#{i + 1}</div>
                  <div className="leading-tight">
                    <div className="opacity-95">{r.name}</div>
                    <div className="opacity-50">{formatKST(r.date)}</div>
                  </div>
                  <div className="text-right opacity-90">{r.score.toLocaleString('en-US')}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 text-[11px] font-mono opacity-60">
            이름: 한/영/숫자 가능, 5글자 이내
          </div>
        </div>
      </div>

      {/* SUBMIT MODAL */}
      {status === 'submit' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-5 shadow-2xl">
            <div className="font-mono text-lg">GAME OVER</div>
            <div className="mt-2 font-mono text-sm opacity-80">
              점수: {score.toLocaleString('en-US')} / 스테이지: {stage}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-mono opacity-70 mb-2">이름 입력 (최대 5글자)</label>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(sanitizeName(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitScore();
                }}
                placeholder="예) JDg"
                className="w-full rounded-lg bg-black/40 px-3 py-3 text-sm font-mono outline-none ring-1 ring-white/10 focus:ring-white/20"
              />
              <div className="mt-1 text-[11px] font-mono opacity-60">
                현재: {sanitizeName(nameInput).length}/{MAX_NAME_LEN}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={submitScore}
                disabled={sanitizeName(nameInput).length < 1}
                className="rounded-lg bg-emerald-600 px-3 py-3 text-sm font-mono disabled:opacity-40 hover:bg-emerald-700 active:bg-emerald-800"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setNameInput('');
                  setStatus('over');
                }}
                className="rounded-lg bg-zinc-700 px-3 py-3 text-sm font-mono hover:bg-zinc-600 active:bg-zinc-500"
              >
                건너뛰기
              </button>
            </div>

            <div className="mt-3 text-[11px] font-mono opacity-60">
              저장 후 랭킹에 #1부터 표시됩니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
