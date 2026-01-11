'use client';

import { useEffect, useRef, useState } from 'react';

type Bullet = { x: number; y: number; vy: number; r: number };
type Enemy = { x: number; y: number; w: number; h: number; vx: number; phase: number; alive: boolean };

export default function GalagaLikePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<'ready' | 'playing' | 'over'>('ready');

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
    ctx.scale(dpr, dpr);

    // 게임 상태(로컬 변수로 관리: 렌더 루프에서 state set 최소화)
    let running = false;

    const player = { x: W / 2, y: H - 70, w: 34, h: 22, speed: 5 };
    let bullets: Bullet[] = [];
    let enemies: Enemy[] = [];
    let keys = { left: false, right: false, fire: false };

    let fireCooldown = 0;
    let enemySpawned = false;
    let localLives = 3;
    let localScore = 0;

    const reset = () => {
      bullets = [];
      enemies = [];
      keys = { left: false, right: false, fire: false };
      fireCooldown = 0;
      enemySpawned = false;
      localLives = 3;
      localScore = 0;
      player.x = W / 2;
      setScore(0);
      setLives(3);
      setStatus('ready');
      running = false;
    };

    const spawnFormation = () => {
      // 겔러그 느낌: 상단 편대(격자)
      const cols = 8;
      const rows = 4;
      const gapX = 42;
      const gapY = 34;
      const startX = (W - (cols - 1) * gapX) / 2;
      const startY = 80;

      enemies = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          enemies.push({
            x: startX + c * gapX,
            y: startY + r * gapY,
            w: 26,
            h: 18,
            vx: 1.1,
            phase: Math.random() * Math.PI * 2,
            alive: true,
          });
        }
      }
      enemySpawned = true;
    };

    const rectHit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    const start = () => {
      if (status === 'over') reset();
      if (!enemySpawned) spawnFormation();
      setStatus('playing');
      running = true;
    };

    const loseLife = () => {
      localLives -= 1;
      setLives(localLives);
      // 잠깐 무적 느낌으로 중앙 복귀
      player.x = W / 2;
      bullets = [];
      if (localLives <= 0) {
        running = false;
        setStatus('over');
      }
    };

    // 입력 처리
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowRight') keys.right = true;
      if (e.key === ' ') keys.fire = true;
      if (e.key === 'Enter') start();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'ArrowRight') keys.right = false;
      if (e.key === ' ') keys.fire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let t = 0;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, W, H);

      // 배경
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);

      // 별(간단)
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 24; i++) ctx.fillRect(((i * 97 + t * 2) % W), ((i * 193 + t * 3) % H), 2, 2);

      // UI 텍스트
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`SCORE ${localScore}`, 14, 24);
      ctx.fillText(`LIVES ${localLives}`, W - 110, 24);

      // 상태 메시지
      if (!running) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, monospace';
        const msg = status === 'over' ? 'GAME OVER - PRESS ENTER' : 'PRESS ENTER TO START';
        const w = ctx.measureText(msg).width;
        ctx.fillText(msg, (W - w) / 2, H / 2);
      }

      if (running) {
        // 플레이어 이동
        if (keys.left) player.x -= player.speed;
        if (keys.right) player.x += player.speed;
        player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

        // 발사
        fireCooldown = Math.max(0, fireCooldown - 1);
        if (keys.fire && fireCooldown === 0) {
          bullets.push({ x: player.x, y: player.y - 18, vy: -8, r: 3 });
          fireCooldown = 10;
        }

        // 총알 업데이트
        bullets = bullets
          .map((b) => ({ ...b, y: b.y + b.vy }))
          .filter((b) => b.y > -20);

        // 적 편대 움직임 + 일부 급강하 느낌(간단)
        t += 1;
        const aliveEnemies = enemies.filter((e) => e.alive);

        // 편대 좌우 흔들림
        const sway = Math.sin(t / 60) * 0.8;

        enemies.forEach((e, idx) => {
          if (!e.alive) return;

          // 6초마다 한 마리씩 아래로 “급강하” 흉내
          const dive = (t % 360 === 0 && idx === (Math.floor(t / 360) % Math.max(1, aliveEnemies.length)));
          if (dive) e.phase = 999; // 다이브 상태 표시

          if (e.phase === 999) {
            // 다이브: 사선+사인
            e.y += 2.8;
            e.x += Math.sin((t + idx) / 10) * 2.2;
            // 화면 아래로 빠지면 상단으로 복귀
            if (e.y > H + 40) {
              e.y = 90 + (idx % 4) * 34;
              e.phase = Math.random() * Math.PI * 2;
            }
          } else {
            e.x += sway;
          }
        });

        // 충돌: 총알 vs 적
        for (const b of bullets) {
          for (const e of enemies) {
            if (!e.alive) continue;
            if (rectHit(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
              e.alive = false;
              b.y = -9999; // 제거 표시
              localScore += 100;
              setScore(localScore);
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

        // 스테이지 클리어(전멸)
        if (enemies.every((e) => !e.alive)) {
          spawnFormation();
        }
      }

      // 그리기: 플레이어
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 14);
      ctx.lineTo(player.x - 18, player.y + 12);
      ctx.lineTo(player.x + 18, player.y + 12);
      ctx.closePath();
      ctx.fill();

      // 그리기: 총알
      ctx.fillStyle = '#fbbf24';
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 그리기: 적
      for (const e of enemies) {
        if (!e.alive) continue;
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(e.x - 6, e.y - 3, 12, 6);
      }

      // 프레임 테두리(아케이드 느낌)
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
  }, [status]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 p-6">
      <div className="w-full max-w-[460px] flex items-center justify-between">
        <div className="font-mono text-sm opacity-80">GALAGA-LIKE</div>
        <div className="font-mono text-sm opacity-80">ENTER to start</div>
      </div>

      <canvas ref={canvasRef} className="rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />

      <div className="w-full max-w-[460px] text-xs font-mono opacity-70 leading-relaxed">
        ← → 이동 / SPACE 발사 / ENTER 시작
      </div>

      <div className="w-full max-w-[460px] text-xs font-mono opacity-70">
        SCORE: {score} / LIVES: {lives}
      </div>
    </div>
  );
}
