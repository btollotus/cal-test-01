'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Bullet = { x: number; y: number; vy: number; r: number; vx: number };
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

  // 다이브 중 목표값/패턴
  diveVX: number;
  diveSpeed: number;
  diveAmp: number;
  diveFreq: number;
};

type Explosion = { x: number; y: number; t: number };

type PowerUp = {
  x: number;
  y: number;
  vy: number;
  type: 'double';
  alive: boolean;
};

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
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function sanitizeName(input: string) {
  const trimmed = input.replace(/\s+/g, '').slice(0, MAX_NAME_LEN);
  const ok = trimmed.replace(/[^0-9A-Za-z가-힣_-]/g, '');
  return ok.slice(0, MAX_NAME_LEN);
}

/** 외부 파일 없이 효과음(오실레이터) */
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

  const api = useMemo(() => {
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
    const power = () => {
      beep(880, 0.05, 'square', 0.06);
      setTimeout(() => beep(988, 0.05, 'square', 0.06), 60);
    };

    return { unlock, shoot, hit, dead, clear, power };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return api;
}

export default function GalagaPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const sfx = useSfx();

  const [status, setStatus] = useState<'ready' | 'playing' | 'over' | 'submit'>('ready');
  const statusRef = useRef<'ready' | 'playing' | 'over' | 'submit'>('ready');
  const setStatusSafe = (s: 'ready' | 'playing' | 'over' | 'submit') => {
    statusRef.current = s;
    setStatus(s);
  };

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

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const W = 420;
    const H = 700;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let running = false;

    const player = { x: W / 2, y: H - 70, w: 34, h: 22, speed: 5 };
    let bullets: Bullet[] = [];
    let enemies: Enemy[] = [];
    let explosions: Explosion[] = [];
    let powerUps: PowerUp[] = [];

    let keys = { left: false, right: false, fire: false };
    let fireCooldown = 0;
    let t = 0;

    let localStage = 1;
    let localScore = 0;
    let localLives = 3;

    // ✅ 보너스: 더블샷
    let doubleShot = false;
    let doubleShotUntil = 0; // timestamp(ms)
    const DOUBLE_SHOT_DURATION_MS = 20000;

    const difficulty = () => {
      // 다이브 이벤트 주기(낮을수록 자주)
      const diveEvery = Math.max(55, 230 - (localStage - 1) * 16);
      // 다이브 기본 속도
      const baseDiveSpeed = 2.8 + (localStage - 1) * 0.28;

      // 동시에 다이브 가능한 최대 수
      const maxDivers = clamp(1 + Math.floor((localStage - 1) / 2), 1, 6);

      // 가끔 러시(다수 동시)
      const rushChance = clamp(0.06 + (localStage - 1) * 0.01, 0.06, 0.18);

      // 플레이어 발사 쿨다운
      const fireCd = Math.max(6, 10 - Math.floor((localStage - 1) / 2));

      // 파워업 드롭 확률(너무 높으면 쉬움)
      const powerDrop = clamp(0.10, 0.08, 0.12); // 고정 근처(취향)

      return { diveEvery, baseDiveSpeed, maxDivers, rushChance, fireCd, powerDrop };
    };

    const spawnFormation = () => {
      const cols = 8;
      const rows = 4;
      const gapX = 42;
      const gapY = 34;
      const startX = (W - (cols - 1) * gapX) / 2;
      const startY = 90;

      enemies = [];
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

            diveVX: 0,
            diveSpeed: 3,
            diveAmp: 2.2,
            diveFreq: 10,
          });
        }
      }
    };

    const rectHit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    const syncUI = () => {
      setScore(localScore);
      setStage(localStage);
      setLives(localLives);
    };

    const resetAll = () => {
      bullets = [];
      enemies = [];
      explosions = [];
      powerUps = [];

      keys = { left: false, right: false, fire: false };
      fireCooldown = 0;
      t = 0;

      localStage = 1;
      localScore = 0;
      localLives = 3;

      doubleShot = false;
      doubleShotUntil = 0;

      player.x = W / 2;

      running = false;
      setStatusSafe('ready');
      syncUI();
    };

    const start = async () => {
      await sfx.unlock();

      const st = statusRef.current;
      if (st === 'submit') return;

      if (st === 'over' || st === 'ready') {
        if (st === 'over') {
          localStage = 1;
          localScore = 0;
          localLives = 3;
          bullets = [];
          explosions = [];
          powerUps = [];
          doubleShot = false;
          doubleShotUntil = 0;
          player.x = W / 2;
        }

        spawnFormation();
        setStatusSafe('playing');
        running = true;
        syncUI();
      }
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

      // ✅ 목숨 잃으면 보너스 해제(아케이드 느낌)
      doubleShot = false;
      doubleShotUntil = 0;

      player.x = W / 2;
      bullets = [];
      explosions.push({ x: player.x, y: player.y, t: 0 });

      if (localLives <= 0) {
        running = false;
        setStatusSafe('submit');
      }
    };

    // ✅ 여러 대 다이브 시작시키기
    const startDives = (count: number) => {
      const alive = enemies.filter((e) => e.alive && !e.diving);
      if (alive.length === 0) return;

      // count 만큼 랜덤으로 뽑기
      const picks: Enemy[] = [];
      for (let i = 0; i < count; i++) {
        if (alive.length === 0) break;
        const idx = Math.floor(Math.random() * alive.length);
        const e = alive.splice(idx, 1)[0];
        picks.push(e);
      }

      const { baseDiveSpeed } = difficulty();
      for (const e of picks) {
        e.diving = true;
        e.diveT = 0;

        // 랜덤 패턴값 부여 (각자 다른 궤적)
        e.diveSpeed = baseDiveSpeed * (0.9 + Math.random() * 0.35);
        e.diveAmp = 1.6 + Math.random() * 3.0;
        e.diveFreq = 8 + Math.floor(Math.random() * 8);

        // 좌우 드리프트(너무 심하면 탈선하니 약하게)
        e.diveVX = (Math.random() - 0.5) * 1.2;
      }
    };

    const dropPowerUpMaybe = (x: number, y: number) => {
      const { powerDrop } = difficulty();
      // 확률 드롭
      if (Math.random() < powerDrop) {
        powerUps.push({
          x,
          y,
          vy: 2.4 + Math.random() * 0.8,
          type: 'double',
          alive: true,
        });
      }
    };

    const fireBullet = () => {
      const { fireCd } = difficulty();

      fireCooldown = fireCd;

      // 더블샷 상태면 2발
      if (doubleShot) {
        bullets.push({ x: player.x - 6, y: player.y - 18, vy: -8.6, r: 3, vx: -0.35 });
        bullets.push({ x: player.x + 6, y: player.y - 18, vy: -8.6, r: 3, vx: 0.35 });
      } else {
        bullets.push({ x: player.x, y: player.y - 18, vy: -8.3, r: 3, vx: 0 });
      }

      sfx.shoot();
    };

    // 입력 처리
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowRight') keys.right = true;
      if (e.key === ' ') keys.fire = true;

      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
        const st = statusRef.current;
        if (st === 'ready' || st === 'over') start();
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

      // 더블샷 만료 체크
      if (doubleShot && Date.now() > doubleShotUntil) {
        doubleShot = false;
        doubleShotUntil = 0;
      }

      // BG
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);

      // 별
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 26; i++) ctx.fillRect(((i * 97 + t * 2) % W), ((i * 193 + t * 3) % H), 2, 2);

      // HUD (상단)
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`SCORE ${localScore}`, 14, 24);
      ctx.fillText(`STAGE ${localStage}`, W / 2 - 40, 24);
      ctx.fillText(`LIVES ${localLives}`, W - 110, 24);

      // 더블샷 표시
      if (doubleShot) {
        const remain = Math.max(0, Math.ceil((doubleShotUntil - Date.now()) / 1000));
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(`DOUBLE x2 (${remain}s)`, 14, 44);
      }

      // ready/over 안내
      const st = statusRef.current;
      if (!running && (st === 'ready' || st === 'over')) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, monospace';
        const msg = st === 'over' ? 'GAME OVER - PRESS ENTER' : 'PRESS ENTER TO START';
        const w = ctx.measureText(msg).width;

        // 박스 느낌
        const bx = (W - w) / 2 - 16;
        const by = H / 2 - 22;
        ctx.strokeStyle = 'rgba(150,255,80,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, w + 32, 44);

        ctx.fillText(msg, (W - w) / 2, H / 2 + 5);
      }

      if (running) {
        const { diveEvery, maxDivers, rushChance } = difficulty();

        // 플레이어 이동
        if (keys.left) player.x -= player.speed;
        if (keys.right) player.x += player.speed;
        player.x = clamp(player.x, player.w / 2, W - player.w / 2);

        // 발사
        fireCooldown = Math.max(0, fireCooldown - 1);
        if (keys.fire && fireCooldown === 0) {
          fireBullet();
        }

        // 총알 업데이트
        bullets = bullets
          .map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))
          .filter((b) => b.y > -40);

        // ✅ 다이브 이벤트: 일정 주기마다 1~N대 랜덤 + 가끔 러시
        t += 1;
        const sway = Math.sin(t / 60) * 0.8;

        if (t % diveEvery === 0) {
          const isRush = Math.random() < rushChance;
          const count = isRush
            ? clamp(Math.floor(maxDivers * 1.6), 2, 8)
            : clamp(1 + Math.floor(Math.random() * maxDivers), 1, maxDivers);

          startDives(count);
        }

        // 적 업데이트
        enemies.forEach((e, idx) => {
          if (!e.alive) return;

          if (!e.diving) {
            e.x = e.homeX + sway;
            e.y = e.homeY + Math.sin((t + idx) / 80) * 0.2;
          } else {
            e.diveT += 1;

            // 내려오면서 사인 + 드리프트
            e.y += e.diveSpeed;
            e.x += e.diveVX + Math.sin((e.diveT + idx) / e.diveFreq) * e.diveAmp;

            // 화면 밖으로 너무 벗어나면 살짝 되돌림
            e.x = clamp(e.x, 20, W - 20);

            if (e.y > H + 40) {
              e.diving = false;
              e.diveT = 0;
              e.x = e.homeX;
              e.y = e.homeY;
            }
          }
        });

        // ✅ 파워업 업데이트(떨어짐)
        powerUps.forEach((p) => {
          if (!p.alive) return;
          p.y += p.vy;
          if (p.y > H + 30) p.alive = false;

          // 플레이어와 충돌 시 획득
          const hit = rectHit(
            player.x - player.w / 2,
            player.y - player.h / 2,
            player.w,
            player.h,
            p.x - 10,
            p.y - 10,
            20,
            20
          );
          if (hit) {
            p.alive = false;
            doubleShot = true;
            doubleShotUntil = Date.now() + DOUBLE_SHOT_DURATION_MS;
            sfx.power();
          }
        });
        powerUps = powerUps.filter((p) => p.alive);

        // 충돌: 총알 vs 적
        for (const b of bullets) {
          for (const e of enemies) {
            if (!e.alive) continue;
            if (
              rectHit(
                b.x - b.r,
                b.y - b.r,
                b.r * 2,
                b.r * 2,
                e.x - e.w / 2,
                e.y - e.h / 2,
                e.w,
                e.h
              )
            ) {
              e.alive = false;
              b.y = -9999;

              localScore += 100 + (localStage - 1) * 10;
              setScore(localScore);

              explosions.push({ x: e.x, y: e.y, t: 0 });
              sfx.hit();

              // ✅ 파워업 드롭(가끔)
              dropPowerUpMaybe(e.x, e.y);

              break;
            }
          }
        }
        bullets = bullets.filter((b) => b.y > -1000);

        // 충돌: 적 vs 플레이어
        for (const e of enemies) {
          if (!e.alive) continue;
          if (
            rectHit(
              player.x - player.w / 2,
              player.y - player.h / 2,
              player.w,
              player.h,
              e.x - e.w / 2,
              e.y - e.h / 2,
              e.w,
              e.h
            )
          ) {
            e.alive = false;
            loseLife();
            break;
          }
        }

        // 스테이지 클리어
        if (enemies.length > 0 && enemies.every((e) => !e.alive)) {
          nextStage();
        }
      }

      // 폭발 이펙트
      explosions = explosions.map((ex) => ({ ...ex, t: ex.t + 1 })).filter((ex) => ex.t < 18);
      for (const ex of explosions) {
        const r = ex.t * 2.2;
        ctx.strokeStyle = `rgba(255,200,80,${1 - ex.t / 18})`;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // DRAW: 플레이어
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 14);
      ctx.lineTo(player.x - 18, player.y + 12);
      ctx.lineTo(player.x + 18, player.y + 12);
      ctx.closePath();
      ctx.fill();

      // DRAW: 총알
      ctx.fillStyle = '#fbbf24';
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // DRAW: 파워업
      for (const p of powerUps) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.95)'; // amber
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText('x2', p.x - 8, p.y + 3);
      }

      // DRAW: 적
      for (const e of enemies) {
        if (!e.alive) continue;
        ctx.fillStyle = e.diving ? '#fb7185' : '#60a5fa';
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(e.x - 6, e.y - 3, 12, 6);
      }

      // 프레임
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(10, 40, W - 20, H - 60);
    };

    loop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setStatusSafe('over');
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
          <canvas
            ref={canvasRef}
            className="rounded-xl"
            onPointerDown={() => {
              sfx.unlock();
            }}
          />
          <div className="mt-3 flex items-center justify-between text-xs font-mono opacity-80">
            <div>SCORE: {score}</div>
            <div>STAGE: {stage}</div>
            <div>LIVES: {lives}</div>
          </div>
          <div className="mt-2 text-xs font-mono opacity-60">
            * 효과음이 안 나면 화면을 한 번 클릭/키입력(ENTER) 후 시작하세요(브라우저 정책).
          </div>
          <div className="mt-1 text-xs font-mono opacity-60">
            * 보너스: 적 처치 시 가끔 x2(더블샷) 드롭 → 먹으면 20초간 2발 발사
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="rounded-2xl p-4 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm">🏆 RANKING</div>
            <button onClick={resetRanking} className="text-xs font-mono opacity-70 hover:opacity-100">
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
                  if (e.key === 'Enter' || e.key === 'NumpadEnter') submitScore();
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
                  setStatusSafe('over');
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
