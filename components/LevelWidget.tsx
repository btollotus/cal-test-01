'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type Mode = 'sensor' | 'mouse';

export default function LevelWidget() {
  // 표시용(스무딩)
  const [roll, setRoll] = useState(0);  // 좌/우 (gamma)
  const [pitch, setPitch] = useState(0); // 앞/뒤 (beta)

  // 입력 원본
  const rollRef = useRef(0);
  const pitchRef = useRef(0);

  const [mode, setMode] = useState<Mode>('mouse');
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // ✅ 판정 기준
  const LEVEL_DEG = 1.5;          // ±1.5° 안이면 OK
  const MAX_DEG = 18;             // 이 이상은 화면 가장자리로 클램프
  const isLevel = Math.abs(roll) <= LEVEL_DEG && Math.abs(pitch) <= LEVEL_DEG;
  const prevLevelRef = useRef(false);

  // ✅ Ding
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canDingRef = useRef(true);

  const ensureAudio = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const ding = async () => {
    try {
      if (!canDingRef.current) return;
      canDingRef.current = false;
      setTimeout(() => (canDingRef.current = true), 500);

      const ctx = await ensureAudio();
      const now = ctx.currentTime;

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, now);
      o.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.16);
    } catch {}
  };

  // 센서 지원/권한
  useEffect(() => {
    const supports = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const isIOS =
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;

    if (supports) {
      setMode('sensor');
      if (isIOS && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        setPermissionNeeded(true);
      } else {
        setPermissionGranted(true);
      }
    } else {
      setMode('mouse');
      setPermissionGranted(false);
      setPermissionNeeded(false);
    }
  }, []);

  const requestIOSPermission = async () => {
    try {
      const fn = (DeviceOrientationEvent as any).requestPermission;
      if (typeof fn !== 'function') {
        setPermissionGranted(true);
        setPermissionNeeded(false);
        return;
      }
      const res = await fn();
      const ok = res === 'granted';
      setPermissionGranted(ok);
      setPermissionNeeded(!ok);
    } catch {
      setPermissionGranted(false);
      setPermissionNeeded(true);
    }
  };

  // 입력 처리
  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      const g = typeof e.gamma === 'number' ? e.gamma : 0; // roll
      const b = typeof e.beta === 'number' ? e.beta : 0;   // pitch
      rollRef.current = clamp(g, -MAX_DEG, MAX_DEG);
      pitchRef.current = clamp(b, -MAX_DEG, MAX_DEG);
    };

    const onMouse = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      rollRef.current = clamp(dx * 18, -MAX_DEG, MAX_DEG);
      pitchRef.current = clamp(dy * 18, -MAX_DEG, MAX_DEG);
    };

    if (mode === 'sensor') {
      if (permissionNeeded && !permissionGranted) return;
      window.addEventListener('deviceorientation', onOrient, true);
      return () => window.removeEventListener('deviceorientation', onOrient, true);
    }

    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, [mode, permissionNeeded, permissionGranted]);

  // 스무딩 루프
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setRoll((p) => lerp(p, rollRef.current, 0.12));
      setPitch((p) => lerp(p, pitchRef.current, 0.12));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  // OK 진입시만 ding
  useEffect(() => {
    const prev = prevLevelRef.current;
    if (!prev && isLevel) ding();
    prevLevelRef.current = isLevel;
  }, [isLevel]);

  // 🎯 타겟 좌표(픽셀)
  // 중앙을 (0,0)으로 두고, roll은 x, pitch는 y로 매핑
  const AREA = 88; // 표시 영역(반지름 느낌)
  const x = clamp((roll / MAX_DEG) * AREA, -AREA, AREA);
  const y = clamp((pitch / MAX_DEG) * AREA, -AREA, AREA);

  // ✅ “원 안에 들어왔는가”를 픽셀 기준으로도 직관화
  const okRadius = (LEVEL_DEG / MAX_DEG) * AREA; // 임계 원 반지름
  const dist = Math.sqrt(x * x + y * y);

  // 방향 안내(원 밖일 때)
  const hint = useMemo(() => {
    if (dist <= okRadius) return '';
    const lr = x > 0 ? '←' : '→';     // 점을 중앙으로 보내려면 반대로 이동
    const ud = y > 0 ? '↑' : '↓';
    // 한 축만 크게 벗어나면 그 축만 강조
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (ax > ay * 1.25) return lr;
    if (ay > ax * 1.25) return ud;
    return `${ud}${lr}`; // 대각선
  }, [dist, okRadius, x, y]);

  const rollText = useMemo(() => {
    const v = Math.round(roll * 10) / 10;
    return `${v > 0 ? '+' : ''}${v}°`;
  }, [roll]);

  const pitchText = useMemo(() => {
    const v = Math.round(pitch * 10) / 10;
    return `${v > 0 ? '+' : ''}${v}°`;
  }, [pitch]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black/70 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
      {/* CRT 효과 */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 scanlines" />
        <div className="absolute inset-0 glow" />
      </div>

      {/* 헤더 */}
      <div className="relative mb-3 flex items-center justify-between">
        <div className="font-mono text-xs tracking-[0.22em] text-white/80">
          LEVEL TARGET
          <span className="ml-2 text-[10px] text-white/50">{mode === 'sensor' ? '(SENSOR)' : '(MOUSE)'}</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={[
              'h-3.5 w-3.5 rounded-full ring-1 ring-white/20',
              isLevel ? 'bg-emerald-400 okPulse shadow-[0_0_14px_rgba(52,211,153,0.85)]' : 'bg-white/10',
            ].join(' ')}
          />
          <div className="font-mono text-[11px] text-white/70">{isLevel ? 'OK' : 'ADJUST'}</div>
        </div>
      </div>

      {/* 🎯 타겟 화면 */}
      <div className="relative mx-auto flex items-center justify-center">
        <div className="relative h-[210px] w-full max-w-[420px] rounded-2xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
          {/* 중앙 십자 */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/10" />
          <div className="pointer-events-none absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-white/10" />

          {/* 타겟 링들 */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/15" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[110px] w-[110px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/15" />

          {/* ✅ OK 임계 원 */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1"
            style={{
              width: `${okRadius * 2}px`,
              height: `${okRadius * 2}px`,
              boxShadow: isLevel ? '0 0 18px rgba(52,211,153,0.55)' : '0 0 10px rgba(255,255,255,0.08)',
              borderColor: isLevel ? 'rgba(52,211,153,0.65)' : 'rgba(255,255,255,0.18)',
            }}
          />

          {/* 현재 점(●) */}
          <div
            className={[
              'absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full',
              isLevel
                ? 'bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.75)]'
                : 'bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.25)]',
            ].join(' ')}
            style={{
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
            title="YOU"
          />

          {/* 방향 힌트 */}
          {!isLevel && (
            <div className="absolute right-3 bottom-3 rounded-xl bg-black/40 px-3 py-2 font-mono text-sm text-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]">
              {hint}
            </div>
          )}

          {/* 라벨 */}
          <div className="pointer-events-none absolute left-3 top-2 font-mono text-[10px] text-white/40">↑ 앞</div>
          <div className="pointer-events-none absolute left-3 bottom-2 font-mono text-[10px] text-white/40">↓ 뒤</div>
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/40">
            ← 좌
          </div>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/40">
            우 →
          </div>
        </div>
      </div>

      {/* 수치 */}
      <div className="relative mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono text-white/70">
        <div className="rounded-xl bg-white/5 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
          PITCH: <span className="text-white/90">{pitchText}</span>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2 text-right shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
          ROLL: <span className="text-white/90">{rollText}</span>
        </div>
      </div>

      <div className="relative mt-2 flex items-center justify-between text-[11px] font-mono text-white/55">
        <div>THRESH: ±{LEVEL_DEG}°</div>
        <div>{isLevel ? 'LEVEL LOCK' : 'MOVE DOT INTO RING'}</div>
      </div>

      {/* iOS 권한 */}
      {permissionNeeded && !permissionGranted && (
        <div className="relative mt-3 rounded-xl bg-white/5 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
          <div className="font-mono text-xs text-white/80">iPhone/iPad에서 센서 사용 권한이 필요합니다.</div>
          <button
            onClick={requestIOSPermission}
            className="mt-2 w-full rounded-lg bg-emerald-600/80 px-3 py-2 text-sm font-mono text-black hover:bg-emerald-600 active:bg-emerald-700"
          >
            센서 권한 허용
          </button>
          <div className="mt-2 font-mono text-[11px] text-white/55">* 버튼을 눌러야 수평계가 작동합니다.</div>
        </div>
      )}

      <style jsx>{`
        .scanlines {
          background: repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.06),
            rgba(255, 255, 255, 0.06) 1px,
            rgba(0, 0, 0, 0) 3px,
            rgba(0, 0, 0, 0) 6px
          );
          mix-blend-mode: overlay;
        }
        .glow {
          background: radial-gradient(
              60% 60% at 50% 10%,
              rgba(34, 211, 238, 0.18),
              rgba(0, 0, 0, 0) 60%
            ),
            radial-gradient(60% 60% at 50% 90%, rgba(232, 121, 249, 0.14), rgba(0, 0, 0, 0) 60%);
          filter: blur(2px);
        }
        .okPulse {
          animation: okPulse 1.1s ease-in-out infinite;
        }
        @keyframes okPulse {
          0%,
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.12);
            filter: brightness(1.25);
          }
        }
      `}</style>
    </div>
  );
}
