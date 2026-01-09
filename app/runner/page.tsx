'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Obstacle = {
  id: number;
  x: number;   // center x (px)
  y: number;   // top y (px)
  w: number;   // width
  h: number;   // height
  vy: number;  // speed (px/sec)
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export default function RunnerGamePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // ✅ 내부 로직 기준 해상도(고정)
  const BASE_W = 420;
  const BASE_H = 720;

  // ✅ 로직에서는 W/H를 BASE로 사용 (중복 제거)
  const W = BASE_W;
  const H = BASE_H;

  // ✅ 화면에 표시될 캔버스 크기(자동)
  const [viewSize, setViewSize] = useState({ w: BASE_W, h: BASE_H });

  useEffect(() => {
    const update = () => {
      // 모바일 주소창/하단바 고려(대략)
      // 화면을 꽉 채우되, 위쪽 UI와 아래 버튼 공간을 조금 확보합니다.
      const maxW = Math.min(window.innerWidth - 24, 520);
      const maxH = window.innerHeight - 220;

      const scale = Math.min(maxW / BASE_W, maxH / BASE_H);

      setViewSize({
        w: Math.max(240, Math.floor(BASE_W * scale)),
        h: Math.max(420, Math.floor(BASE_H * scale)),
      });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 자동차
  const carW = 46;
  const carH = 72;
  const carY = H - carH - 18;

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);

  // 내부 게임 상태 (ref로 유지)
  const carXRef = useRef<number>(W / 2 - carW / 2);
  const velXRef = useRef<number>(0);

  const obstaclesRef = useRef<Obstacle[]>([]);
  const nextIdRef = useRef(1);

  const spawnTimerRef = useRef(0);
  const difficultyRef = useRef(1);

  // 입력 상태
  const leftDownRef = useRef(false);
  const rightDownRef = useRef(false);

  const reset = () => {
    setRunning(true);
    setGameOver(false);
    setScore(0);

    carXRef.current = W / 2 - carW / 2;
    velXRef.current = 0;

    obstaclesRef.current = [];
    nextIdRef.current = 1;

    spawnTimerRef.current = 0;
    difficultyRef.current = 1;

    lastTsRef.current = null;
  };

  // 키보드 입력
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftDownRef.current = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightDownRef.current = true;

      if (!running && (e.key === 'Enter' || e.key === ' ')) {
        reset();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftDownRef.current = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightDownRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [running]);

  // 터치/버튼 입력(모바일 대응)
  const pressLeft = (down: boolean) => { leftDownRef.current = down; };
  const pressRight = (down: boolean) => { rightDownRef.current = down; };

  // 메인 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ✅ 내부 해상도는 항상 BASE로 유지 (선명도 안정)
    canvas.width = BASE_W;
    canvas.height = BASE_H;

    const drawRoad = () => {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#2b2f3a';
      ctx.fillRect(60, 0, W - 120, H);

      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(60, 0, 4, H);
      ctx.fillRect(W - 64, 0, 4, H);

      ctx.fillStyle = '#f3d34a';
      const dashH = 26;
      const gap = 18;
      const offset = (performance.now() / 6) % (dashH + gap);
      for (let y = -offset; y < H; y += dashH + gap) {
        ctx.fillRect(W / 2 - 3, y, 6, dashH);
      }
    };

    const drawCar = (x: number) => {
      ctx.fillStyle = '#4dd0ff';
      ctx.fillRect(x, carY, carW, carH);

      ctx.fillStyle = '#093145';
      ctx.fillRect(x + 8, carY + 10, carW - 16, 16);

      ctx.fillStyle = '#f7f7f7';
      ctx.fillRect(x + 6, carY + carH - 10, 8, 6);
      ctx.fillRect(x + carW - 14, carY + carH - 10, 8, 6);

      ctx.fillStyle = '#111';
      ctx.fillRect(x - 6, carY + 10, 6, 14);
      ctx.fillRect(x - 6, carY + carH - 24, 6, 14);
      ctx.fillRect(x + carW, carY + 10, 6, 14);
      ctx.fillRect(x + carW, carY + carH - 24, 6, 14);
    };

    const drawObstacle = (o: Obstacle) => {
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(o.x - o.w / 2, o.y, o.w, o.h);

      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(o.x - o.w / 2 + 4, o.y + 4, o.w - 8, 10);
    };

    const step = (ts: number) => {
      rafRef.current = requestAnimationFrame(step);

      // 정지 상태/게임오버 상태에서도 화면은 계속 그리기
      if (!running || gameOver) {
        drawRoad();
        obstaclesRef.current.forEach(drawObstacle);
        drawCar(carXRef.current);

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, W, 54);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(`SCORE: ${score}`, 16, 34);

        if (!running && !gameOver) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 22px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText('CAR DODGE', 130, 300);
          ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText('Enter / Space : Start', 120, 340);
          ctx.fillText('← → 또는 A / D : Move', 118, 368);
        }

        if (gameOver) {
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 24px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText('GAME OVER', 130, 300);
          ctx.font = '18px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText(`SCORE: ${score}`, 160, 336);
          ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText('Press Enter to Restart', 120, 380);
        }
        return;
      }

      // dt 계산
      const last = lastTsRef.current;
      lastTsRef.current = ts;
      const dt = last ? (ts - last) / 1000 : 0;
      if (dt <= 0) return;

      // 난이도 상승
      difficultyRef.current += dt * 0.08;

      // 입력 처리
      const accel = 2200;
      const maxV = 420;
      const friction = 2600;

      let ax = 0;
      if (leftDownRef.current) ax -= accel;
      if (rightDownRef.current) ax += accel;

      velXRef.current += ax * dt;

      if (ax === 0) {
        const v = velXRef.current;
        const dv = friction * dt;
        if (Math.abs(v) <= dv) velXRef.current = 0;
        else velXRef.current = v - Math.sign(v) * dv;
      }

      velXRef.current = clamp(velXRef.current, -maxV, maxV);
      carXRef.current += velXRef.current * dt;

      // 도로 범위 제한
      const roadLeft = 64;
      const roadRight = W - 64;
      carXRef.current = clamp(carXRef.current, roadLeft, roadRight - carW);

      // 장애물 생성
      spawnTimerRef.current -= dt;
      const spawnEvery = clamp(0.75 / difficultyRef.current, 0.18, 0.75);
      if (spawnTimerRef.current <= 0) {
        spawnTimerRef.current = spawnEvery;

        const roadW = (W - 128);
        const xMin = 64 + 24;
        const xMax = 64 + roadW - 24;

        const x = xMin + Math.random() * (xMax - xMin);
        const vy = 240 + Math.random() * 220 + difficultyRef.current * 35;
        const w = 24 + Math.random() * 18;
        const h = 28 + Math.random() * 26;

        obstaclesRef.current.push({
          id: nextIdRef.current++,
          x,
          y: -h,
          w,
          h,
          vy,
        });
      }

      // 장애물 이동
      const obs = obstaclesRef.current;
      for (const o of obs) o.y += o.vy * dt;

      // 화면 밖 제거 + 점수
      let removed = 0;
      obstaclesRef.current = obs.filter((o) => {
        if (o.y > H + 10) {
          removed++;
          return false;
        }
        return true;
      });
      if (removed > 0) setScore((s) => s + removed);

      // 충돌 체크
      const carX = carXRef.current;
      const carY0 = carY;
      for (const o of obstaclesRef.current) {
        const ox = o.x - o.w / 2;
        if (rectsOverlap(carX, carY0, carW, carH, ox, o.y, o.w, o.h)) {
          setGameOver(true);
          setRunning(false);
          break;
        }
      }

      // 렌더
      drawRoad();
      obstaclesRef.current.forEach(drawObstacle);
      drawCar(carXRef.current);

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, 54);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`SCORE: ${score}`, 16, 34);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, gameOver, score]);

  // 초기 대기
  useEffect(() => {
    setRunning(false);
    setGameOver(false);
    setScore(0);
  }, []);

  return (
    // ✅ 모바일 주소창 문제를 줄이기 위해 dvh 사용
    <div className="min-h-[100dvh] bg-gray-100 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              ← 홈
            </Link>

            <button
              onClick={reset}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {running ? '재시작' : '시작'}
            </button>
          </div>

          <div className="text-xs text-gray-700 dark:text-gray-200 md:text-sm">
            조작: ← → 또는 A / D (모바일은 아래 버튼)
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-3 shadow dark:bg-gray-800">
            <canvas
              ref={canvasRef}
              width={BASE_W}
              height={BASE_H}
              className="block rounded-xl"
              // ✅ 실제 표시 크기만 자동 조절
              style={{ width: viewSize.w, height: viewSize.h, touchAction: 'none' }}
            />
          </div>

          {/* 모바일 컨트롤: 캔버스 폭에 맞게 */}
          <div className="flex w-full gap-3" style={{ maxWidth: viewSize.w }}>
            <button
              onPointerDown={() => pressLeft(true)}
              onPointerUp={() => pressLeft(false)}
              onPointerLeave={() => pressLeft(false)}
              className="flex-1 rounded-xl bg-gray-800 px-4 py-4 text-lg font-bold text-white active:bg-gray-700"
            >
              ◀
            </button>

            <button
              onPointerDown={() => pressRight(true)}
              onPointerUp={() => pressRight(false)}
              onPointerLeave={() => pressRight(false)}
              className="flex-1 rounded-xl bg-gray-800 px-4 py-4 text-lg font-bold text-white active:bg-gray-700"
            >
              ▶
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-300">
            장애물을 피하세요. 아래로 빠져나간 장애물 1개당 점수 +1
          </div>
        </div>
      </div>
    </div>
  );
}
