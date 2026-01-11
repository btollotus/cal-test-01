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

// ✅ 공유 랭킹: 갈라가 전용 game id
const GAME_ID = 'galaga';

// ✅ 이름 10자까지 (한글 포함)
const MAX_NAME_LEN = 10;

// 랭킹 표시 개수
const MAX_RANK = 20;

// 게임 내부 기준 해상도(물리 캔버스는 이 값으로 고정, 화면에는 viewSize로 스케일)
const BASE_W = 420;
const BASE_H = 700;

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
  // ✅ 공백 제거 + 허용 문자만 + 10자 제한
  const noSpace = input.replace(/\s+/g, '');
  const only = noSpace.replace(/[^0-9A-Za-z가-힣_-]/g, '');
  return only.slice(0, MAX_NAME_LEN);
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
  }, []);

  return api;
}

export default function GalagaPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // ✅ 화면(기종 무관) 자동 스케일: vw/vh 기반
  const [viewSize, setViewSize] = useState({ w: BASE_W, h: BASE_H });

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
  const [rankLoading, setRankLoading] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);

  // ✅ 입력 상태는 ref로(멀티터치/키보드 모두)
  const inputRef = useRef({
    mobile: { left: false, right: false, fire: false },
    kb: { left: false, right: false, fire: false },
    pid: { left: -1, right: -1, fire: -1 },
  });

  const clearMobileKeys = () => {
    inputRef.current.mobile = { left: false, right: false, fire: false };
    inputRef.current.pid = { left: -1, right: -1, fire: -1 };
  };

  // ✅ 공유 랭킹 불러오기
  const loadRanking = async () => {
    setRankLoading(true);
    setRankError(null);
    try {
      const res = await fetch(`/api/ranking?game=${GAME_ID}`, { cache: 'no-store' });
      const json = await res.json();
      if (json?.ok) setLeaderboard(json.rows ?? []);
      else setRankError(json?.error ?? 'ranking load failed');
    } catch (e: any) {
      setRankError(e?.message ?? 'ranking load failed');
    } finally {
      setRankLoading(false);
    }
  };

  // ✅ 최초 1회 로드
  useEffect(() => {
    loadRanking();
  }, []);

  const sortedBoard = useMemo(() => {
    const copy = [...leaderboard];
    copy.sort((a, b) => (b.score - a.score) || (new Date(b.date).getTime() - new Date(a.date).getTime()));
    return copy.slice(0, MAX_RANK);
  }, [leaderboard]);

  // ✅ 기종별(=화면별) 자동 크기
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Tailwind sm(640) 기준과 유사하게 분기
      const isWide = vw >= 640;

      // 바깥 여백
      const outerPadding = 16; // p-3~p-6 정도의 평균
      const safeW = Math.max(0, vw - outerPadding * 2);

      // 넓은 화면에서는 우측에 랭킹이 붙어서 게임영역 가로가 줄어듦
      // (sm:grid-cols-[1fr_320px] 기준)
      const sideRankW = isWide ? 340 : 0;
      const gap = isWide ? 16 : 0;

      // 게임 영역에서 실제로 쓸 수 있는 최대 폭
      const maxGameW = Math.max(320, safeW - sideRankW - gap);

      // 너무 넓은 기기(태블릿/노트)에서 과하게 커지지 않도록 상한
      const wCandidate = Math.min(720, maxGameW);

      // 세로는 화면 높이에서(상단바/점수줄/패드/설명 등) 빼고 남은 높이로 제한
      // 넓은 화면은 랭킹이 옆으로 가서 reserved가 더 작음
      const reserved = isWide ? 220 : 320;
      const maxGameH = Math.max(520, vh - reserved);

      // 비율 유지해서 w->h 계산 후, h가 넘치면 h로 다시 w를 계산
      let h = Math.round((wCandidate / BASE_W) * BASE_H);
      let w = wCandidate;

      if (h > maxGameH) {
        h = Math.floor(maxGameH);
        w = Math.floor((h / BASE_H) * BASE_W);
      }

      // 최소값 보정
      w = clamp(w, 320, 720);
      h = Math.floor((w / BASE_W) * BASE_H);

      setViewSize({ w, h });
    };

    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('orientationchange', calc);
    return () => {
      window.removeEventListener('resize', calc);
      window.removeEventListener('orientationchange', calc);
    };
  }, []);

  // -------------------- GAME LOOP --------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = BASE_W * dpr;
    canvas.height = BASE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let running = false;

    const W = BASE_W;
    const H = BASE_H;

    const player = { x: W / 2, y: H - 70, w: 34, h: 22, speed: 5 };
    let bullets: Bullet[] = [];
    let enemies: Enemy[] = [];
    let explosions: Explosion[] = [];
    let powerUps: PowerUp[] = [];

    let fireCooldown = 0;
    let t = 0;

    let localStage = 1;
    let localScore = 0;
    let localLives = 3;

    let doubleShot = false;
    let doubleShotUntil = 0;
    const DOUBLE_SHOT_DURATION_MS = 20000;

    const difficulty = () => {
      const diveEvery = Math.max(55, 230 - (localStage - 1) * 16);
      const baseDiveSpeed = 2.8 + (localStage - 1) * 0.28;
      const maxDivers = clamp(1 + Math.floor((localStage - 1) / 2), 1, 6);
      const rushChance = clamp(0.06 + (localStage - 1) * 0.01, 0.06, 0.18);
      const fireCd = Math.max(6, 10 - Math.floor((localStage - 1) / 2));
      const powerDrop = 0.10;
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

    const startDives = (count: number) => {
      const alive = enemies.filter((e) => e.alive && !e.diving);
      if (alive.length === 0) return;

      const picks: Enemy[] = [];
      for (let i = 0; i < count; i++) {
        if (alive.length === 0) break;
        const idx = Math.floor(Math.random() * alive.length);
        picks.push(alive.splice(idx, 1)[0]);
      }

      const { baseDiveSpeed } = difficulty();
      for (const e of picks) {
        e.diving = true;
        e.diveT = 0;
        e.diveSpeed = baseDiveSpeed * (0.9 + Math.random() * 0.35);
        e.diveAmp = 1.6 + Math.random() * 3.0;
        e.diveFreq = 8 + Math.floor(Math.random() * 8);
        e.diveVX = (Math.random() - 0.5) * 1.2;
      }
    };

    const dropPowerUpMaybe = (x: number, y: number) => {
      const { powerDrop } = difficulty();
      if (Math.random() < powerDrop) {
        powerUps.push({ x, y, vy: 2.4 + Math.random() * 0.8, type: 'double', alive: true });
      }
    };

    const fireBullet = () => {
      const { fireCd } = difficulty();
      fireCooldown = fireCd;

      if (doubleShot) {
        bullets.push({ x: player.x - 6, y: player.y - 18, vy: -8.6, r: 3, vx: -0.35 });
        bullets.push({ x: player.x + 6, y: player.y - 18, vy: -8.6, r: 3, vx: 0.35 });
      } else {
        bullets.push({ x: player.x, y: player.y - 18, vy: -8.3, r: 3, vx: 0 });
      }

      sfx.shoot();
    };

    // 키보드 → ref에만 기록
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') inputRef.current.kb.left = true;
      if (e.key === 'ArrowRight') inputRef.current.kb.right = true;
      if (e.key === ' ') inputRef.current.kb.fire = true;

      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
        const st = statusRef.current;
        if (st === 'ready' || st === 'over') start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') inputRef.current.kb.left = false;
      if (e.key === 'ArrowRight') inputRef.current.kb.right = false;
      if (e.key === ' ') inputRef.current.kb.fire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);

      // ✅ 매 프레임 “새로 계산”(누적 OR 금지)
      const st = statusRef.current;
      const mk = inputRef.current.mobile;
      const kb = inputRef.current.kb;

      const keys =
        st === 'playing'
          ? {
              left: kb.left || mk.left,
              right: kb.right || mk.right,
              fire: kb.fire || mk.fire,
            }
          : { left: false, right: false, fire: false };

      if (doubleShot && Date.now() > doubleShotUntil) {
        doubleShot = false;
        doubleShotUntil = 0;
      }

      // BG
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);

      // stars
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 26; i++) ctx.fillRect(((i * 97 + t * 2) % W), ((i * 193 + t * 3) % H), 2, 2);

      // HUD
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`SCORE ${localScore}`, 14, 24);
      ctx.fillText(`STAGE ${localStage}`, W / 2 - 40, 24);
      ctx.fillText(`LIVES ${localLives}`, W - 110, 24);

      if (doubleShot) {
        const remain = Math.max(0, Math.ceil((doubleShotUntil - Date.now()) / 1000));
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(`DOUBLE x2 (${remain}s)`, 14, 44);
      }

      if (!running && (st === 'ready' || st === 'over')) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, monospace';
        const msg = st === 'over' ? 'GAME OVER - PRESS START' : 'PRESS START';
        const mw = ctx.measureText(msg).width;
        const bx = (W - mw) / 2 - 16;
        const by = H / 2 - 22;
        ctx.strokeStyle = 'rgba(150,255,80,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, mw + 32, 44);
        ctx.fillText(msg, (W - mw) / 2, H / 2 + 5);
      }

      if (running) {
        const { diveEvery, maxDivers, rushChance } = difficulty();

        // move
        if (keys.left) player.x -= player.speed;
        if (keys.right) player.x += player.speed;
        player.x = clamp(player.x, player.w / 2, W - player.w / 2);

        // fire
        fireCooldown = Math.max(0, fireCooldown - 1);
        if (keys.fire && fireCooldown === 0) fireBullet();

        // bullets
        bullets = bullets.map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy })).filter((b) => b.y > -40);

        // dive events
        t += 1;
        const sway = Math.sin(t / 60) * 0.8;

        if (t % diveEvery === 0) {
          const isRush = Math.random() < rushChance;
          const count = isRush
            ? clamp(Math.floor(maxDivers * 1.6), 2, 8)
            : clamp(1 + Math.floor(Math.random() * maxDivers), 1, maxDivers);
          startDives(count);
        }

        // enemies
        enemies.forEach((e, idx) => {
          if (!e.alive) return;

          if (!e.diving) {
            e.x = e.homeX + sway;
            e.y = e.homeY + Math.sin((t + idx) / 80) * 0.2;
          } else {
            e.diveT += 1;
            e.y += e.diveSpeed;
            e.x += e.diveVX + Math.sin((e.diveT + idx) / e.diveFreq) * e.diveAmp;
            e.x = clamp(e.x, 20, W - 20);

            if (e.y > H + 40) {
              e.diving = false;
              e.diveT = 0;
              e.x = e.homeX;
              e.y = e.homeY;
            }
          }
        });

        // powerups
        powerUps.forEach((p) => {
          if (!p.alive) return;
          p.y += p.vy;
          if (p.y > H + 30) p.alive = false;

          const hit = rectHit(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, p.x - 10, p.y - 10, 20, 20);
          if (hit) {
            p.alive = false;
            doubleShot = true;
            doubleShotUntil = Date.now() + DOUBLE_SHOT_DURATION_MS;
            sfx.power();
          }
        });
        powerUps = powerUps.filter((p) => p.alive);

        // bullet vs enemy
        for (const b of bullets) {
          for (const e of enemies) {
            if (!e.alive) continue;
            if (rectHit(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
              e.alive = false;
              b.y = -9999;
              localScore += 100 + (localStage - 1) * 10;
              setScore(localScore);
              explosions.push({ x: e.x, y: e.y, t: 0 });
              sfx.hit();
              dropPowerUpMaybe(e.x, e.y);
              break;
            }
          }
        }
        bullets = bullets.filter((b) => b.y > -1000);

        // enemy vs player
        for (const e of enemies) {
          if (!e.alive) continue;
          if (rectHit(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
            e.alive = false;
            loseLife();
            break;
          }
        }

        if (enemies.length > 0 && enemies.every((e) => !e.alive)) nextStage();
      }

      // explosions
      explosions = explosions.map((ex) => ({ ...ex, t: ex.t + 1 })).filter((ex) => ex.t < 18);
      for (const ex of explosions) {
        const r = ex.t * 2.2;
        ctx.strokeStyle = `rgba(255,200,80,${1 - ex.t / 18})`;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // player
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 14);
      ctx.lineTo(player.x - 18, player.y + 12);
      ctx.lineTo(player.x + 18, player.y + 12);
      ctx.closePath();
      ctx.fill();

      // bullets draw
      ctx.fillStyle = '#fbbf24';
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // powerup draw
      for (const p of powerUps) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText('x2', p.x - 8, p.y + 3);
      }

      // enemies draw
      for (const e of enemies) {
        if (!e.alive) continue;
        ctx.fillStyle = e.diving ? '#fb7185' : '#60a5fa';
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(e.x - 6, e.y - 3, 12, 6);
      }

      // frame
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(10, 40, W - 20, H - 60);
    };

    loop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [sfx]);

  // -------------------- SCORE SUBMIT (공유 랭킹 저장) --------------------
  const submitScore = async () => {
    const safe = sanitizeName(nameInput);
    if (!safe) return;

    try {
      await fetch('/api/ranking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: GAME_ID, name: safe, score }),
      });
    } catch {
      // 저장 실패해도 일단 모달 닫아주고, 랭킹 로드는 실패 표시로 남김
    }

    setNameInput('');
    setStatusSafe('over');
    clearMobileKeys();
    loadRanking(); // ✅ 저장 후 새로고침
  };

  // ✅ START 버튼
  const startByButton = async () => {
    await sfx.unlock();
    const st = statusRef.current;
    if (st === 'ready' || st === 'over') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }
  };

  // ✅ 버튼 핸들러: pointer capture로 멀티터치 안정화
  const bindHold = (key: 'left' | 'right' | 'fire') => {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        sfx.unlock();
        if (inputRef.current.pid[key] !== -1) return;

        inputRef.current.pid[key] = e.pointerId;
        inputRef.current.mobile[key] = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (inputRef.current.pid[key] === e.pointerId) {
          inputRef.current.pid[key] = -1;
          inputRef.current.mobile[key] = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}
        }
      },
      onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (inputRef.current.pid[key] === e.pointerId) {
          inputRef.current.pid[key] = -1;
          inputRef.current.mobile[key] = false;
        }
      },
    };
  };

  const padBtn =
    'select-none touch-none rounded-2xl px-4 py-4 font-mono text-base shadow-[0_0_0_1px_rgba(255,255,255,0.10)] active:scale-[0.98] transition';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-start gap-3 p-3 sm:p-6">
      {/* ✅ max width를 늘려서 노트/큰 화면에서 옆으로 랭킹 배치가 자연스럽게 */}
      <div className="w-full max-w-[980px] flex items-center justify-between pt-2">
        <Link href="/" className="text-sm font-mono opacity-80 hover:opacity-100">
          ← HOME
        </Link>
        <div className="text-[12px] sm:text-sm font-mono opacity-80">PC: ← → / SPACE / ENTER</div>
      </div>

      <div className="w-full max-w-[980px] grid grid-cols-1 sm:grid-cols-[1fr_340px] gap-3 sm:gap-4 items-start">
        {/* GAME */}
        <div className="rounded-2xl p-3 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <canvas
            ref={canvasRef}
            className="rounded-xl block mx-auto"
            style={{ width: `${viewSize.w}px`, height: `${viewSize.h}px` }}
          />

          <div className="mt-3 flex items-center justify-between text-xs font-mono opacity-80">
            <div>SCORE: {score}</div>
            <div>STAGE: {stage}</div>
            <div>LIVES: {lives}</div>
          </div>

          {/* ✅ 모바일 조작 패드 */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <button onClick={startByButton} className={`${padBtn} col-span-1 bg-emerald-600/80 hover:bg-emerald-600`}>
              START
            </button>

            <button className={`${padBtn} bg-white/10`} {...bindHold('left')}>
              ←
            </button>

            <button className={`${padBtn} bg-amber-500/80 hover:bg-amber-500 text-black`} {...bindHold('fire')}>
              FIRE
            </button>

            <button className={`${padBtn} bg-white/10`} {...bindHold('right')}>
              →
            </button>
          </div>

          <div className="mt-2 text-[11px] font-mono opacity-60 leading-relaxed">
            * 모바일: ←/→ 누른 채로 FIRE도 동시에 누를 수 있습니다(멀티터치 OK).<br />
            * 보너스: 적 처치 시 가끔 x2 드롭 → 먹으면 20초간 2발 발사
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="rounded-2xl p-4 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm">🏆 RANKING</div>
            <button onClick={loadRanking} className="text-xs font-mono opacity-70 hover:opacity-100">
              refresh
            </button>
          </div>

          <div className="mt-2 text-[11px] font-mono opacity-60">
            {rankLoading ? '불러오는 중…' : rankError ? `불러오기 실패: ${rankError}` : '공유 랭킹(오락실 1대 느낌)'}
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
                    <div className="opacity-95 break-all">{r.name}</div>
                    <div className="opacity-50">{formatKST(r.date)}</div>
                  </div>
                  <div className="text-right opacity-90">{r.score.toLocaleString('en-US')}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 text-[11px] font-mono opacity-60">
            이름: 한글/영문/숫자 가능, {MAX_NAME_LEN}자 이내
          </div>
        </div>
      </div>

      {/* SUBMIT MODAL */}
      {status === 'submit' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-5 shadow-2xl">
            <div className="font-mono text-lg">GAME OVER</div>
            <div className="mt-2 font-mono text-sm opacity-80">
              점수: {score.toLocaleString('en-US')} / 스테이지: {stage}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-mono opacity-70 mb-2">이름 입력 (한글 {MAX_NAME_LEN}자까지)</label>
              <input
                autoFocus
                value={nameInput}
                maxLength={MAX_NAME_LEN}
                inputMode="text"
                enterKeyHint="done"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setNameInput(sanitizeName(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'NumpadEnter') submitScore();
                }}
                placeholder="예) 홍길동"
                className="w-full rounded-lg bg-black/40 px-3 py-3 text-base font-mono outline-none ring-1 ring-white/10 focus:ring-white/20"
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
                  clearMobileKeys();
                }}
                className="rounded-lg bg-zinc-700 px-3 py-3 text-sm font-mono hover:bg-zinc-600 active:bg-zinc-500"
              >
                건너뛰기
              </button>
            </div>

            <div className="mt-3 text-[11px] font-mono opacity-60 leading-relaxed">모바일에서도 한글 입력 가능합니다.</div>
          </div>
        </div>
      )}
    </div>
  );
}
