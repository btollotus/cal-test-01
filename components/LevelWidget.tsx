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
  // ✅ 스무딩된 값(화면 표시용)
  const [roll, setRoll] = useState(0);  // 좌/우 (gamma)
  const [pitch, setPitch] = useState(0); // 앞/뒤 (beta)

  // ✅ 입력 원본(ref)
  const rollRef = useRef(0);
  const pitchRef = useRef(0);

  const [mode, setMode] = useState<Mode>('mouse');
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // ✅ “수평” 판정: 두 축 모두 통과해야 OK
  const LEVEL_DEG = 1.5;
  const isLevel = Math.abs(roll) <= LEVEL_DEG && Math.abs(pitch) <= LEVEL_DEG;
  const prevLevelRef = useRef(false);

  // ✅ Ding (WebAudio)
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
      setTimeout(() => (canDingRef.current = true), 450);

      const ctx = await ensureAudio();
      const now = ctx.currentTime;

      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(880, now);
      o1.frequency.exponentialRampToValueAtTime(1320, now + 0.07);
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      o1.connect(g1);
      g1.connect(ctx.destination);
      o1.start(now);
      o1.stop(now + 0.14);

      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(660, now + 0.04);
      o2.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      g2.gain.setValueAtTime(0.0001, now + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.14, now + 0.055);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.start(now + 0.04);
      o2.stop(now + 0.20);
    } catch {}
  };

  // ✅ 센서 지원/권한 체크
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

  // ✅ 입력 처리: sensor(γ/β) + mouse(x/y)
  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: 좌/우, beta: 앞/뒤
      const g = typeof e.gamma === 'number' ? e.gamma : 0;
      const b = typeof e.beta === 'number' ? e.beta : 0;

      // 과도 값 제한 (표시/게임 느낌)
      rollRef.current = clamp(g, -25, 25);
      pitchRef.current = clamp(b, -25, 25);
    };

    const onMouse = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx; // -1~1
      const dy = (e.clientY - cy) / cy; // -1~1

      rollRef.current = clamp(dx * 18, -25, 25);
      // 마우스는 위로 갈수록 -로(“앞/뒤” 느낌은 취향), 여기선 아래로 갈수록 +로 둠
      pitchRef.current = clamp(dy * 18, -25, 25);
    };

    if (mode === 'sensor') {
      if (permissionNeeded && !permissionGranted) return;
      window.addEventListener('deviceorientation', onOrient, true);
      return () => window.removeEventListener('deviceorientation', onOrient, true);
    }

    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, [mode, permissionNeeded, permissionGranted]);

  // ✅ 스무딩 루프
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setRoll((prev) => lerp(prev, rollRef.current, 0.12));
      setPitch((prev) => lerp(prev, pitchRef.current, 0.12));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ✅ 수평 “진입” 순간에만 딩
  useEffect(() => {
    const prev = prevLevelRef.current;
    if (!prev && isLevel) ding();
    prevLevelRef.current = isLevel;
  }, [isLevel]);

  // HUD 계산
  const maxDeg = 18; // 게이지 풀스케일
  const rollNorm = clamp(roll / maxDeg, -1, 1);
  const pitchNorm = clamp(pitch / maxDeg, -1, 1);

  const needleX = rollNorm * 42; // 좌/우 바늘 이동
  const bubbleX = rollNorm * 52; // 버블 이동(가로)
  const bubbleY = pitchNorm * 18; // 버블 이동(세로)

  const rollText = useMemo(() => {
    const v = Math.round(roll * 10) / 10;
    return `${v > 0 ? '+' : ''}${v}°`;
  }, [roll]);

  const pitchText = useMemo(() => {
    const v = Math.round(pitch * 10) / 10;
    return `${v > 0 ? '+' : ''}${v}°`;
  }, [pitch]);

  const padBtn =
    'select-none touch-none rounded-xl px-3 py-2 font-mono text-[12px] shadow-[0_0_0_1px_rgba(255,255,255,0.10)] active:scale-[0.98] transition';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black/70 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
      {/* Scanlines + Glow */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 scanlines" />
        <div className="absolute inset-0 glow" />
      </div>

      {/* Header */}
      <div className="relative mb-3 flex items-center justify-between">
        <div className="font-mono text-xs tracking-[0.22em] text-white/80">
          LEVEL HUD
          <span className="ml-2 text-[10px] text-white/50">{mode === 'sensor' ? '(SENSOR)' : '(MOUSE)'}</span>
        </div>

        {/* OK Lamp */}
        <div className="flex items-center gap-2">
          <div
            className={[
              'h-3.5 w-3.5 rounded-full ring-1 ring-white/20',
              isLevel ? 'bg-emerald-400 okPulse shadow-[0_0_14px_rgba(52,211,153,0.85)]' : 'bg-white/10',
            ].join(' ')}
            title={isLevel ? 'LEVEL OK' : 'TILT'}
          />
          <div className="font-mono text-[11px] text-white/70">{isLevel ? 'OK' : 'TILT'}</div>
        </div>
      </div>

      {/* ✅ 2축 HUD */}
      <div className="relative grid grid-cols-[64px_1fr] gap-3">
        {/* LEFT: Pitch meter (앞/뒤) */}
        <div className="relative">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-mono text-[10px] text-white/65">PITCH</div>
            <div className="font-mono text-[10px] text-white/70">{pitchText}</div>
          </div>

          <div className="relative h-10 rounded-xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
            {/* center line */}
            <div className="pointer-events-none absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-emerald-400/50 shadow-[0_0_16px_rgba(52,211,153,0.55)]" />
            {/* up/down hints */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
              <span className="font-mono text-[10px] text-white/40">↑</span>
              <span className="font-mono text-[10px] text-white/40">↓</span>
            </div>
          </div>

          {/* Pitch bubble (vertical guide) */}
          <div className="relative mt-2 h-10 rounded-xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/15" />
            <div
              className={[
                'absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
                isLevel ? 'bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.65)]' : 'bg-cyan-300/70 shadow-[0_0_14px_rgba(34,211,238,0.35)]',
              ].join(' ')}
              style={{ transform: `translate(-50%, calc(-50% + ${bubbleY}px))` }}
              title="PITCH"
            />
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="font-mono text-[9px] text-white/45">앞</span>
              <span className="font-mono text-[9px] text-white/45">뒤</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Roll bar (좌/우) + bubble */}
        <div className="relative">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-mono text-[10px] text-white/65">ROLL</div>
            <div className="font-mono text-[10px] text-white/70">{rollText}</div>
          </div>

          {/* Roll Track */}
          <div className="relative h-10 rounded-xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
            {/* Neon center marker */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-10 w-[2px] -translate-x-1/2 bg-emerald-400/70 shadow-[0_0_18px_rgba(52,211,153,0.7)]" />

            {/* Tick marks */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 opacity-60">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    'w-[2px] rounded-full bg-white/25',
                    i === 4 ? 'h-6 bg-emerald-300/70 shadow-[0_0_14px_rgba(52,211,153,0.55)]' : 'h-3',
                  ].join(' ')}
                />
              ))}
            </div>

            {/* Direction fill */}
            <div className="relative h-full overflow-hidden rounded-xl">
              <div
                className="absolute top-0 h-full w-1/2"
                style={{ left: '50%', transform: `translateX(${Math.min(0, needleX)}px)` }}
              >
                <div className="h-full w-full bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.35)]" />
              </div>
              <div
                className="absolute top-0 h-full w-1/2"
                style={{ right: '50%', transform: `translateX(${Math.max(0, needleX)}px)` }}
              >
                <div className="h-full w-full bg-fuchsia-400/20 shadow-[0_0_20px_rgba(232,121,249,0.30)]" />
              </div>
            </div>

            {/* Needle */}
            <div
              className={['absolute left-1/2 top-1/2 -translate-y-1/2', isLevel ? 'needlePulse' : ''].join(' ')}
              style={{ transform: `translate(calc(-50% + ${needleX}px), -50%)` }}
            >
              <div className="h-12 w-2 rounded-full bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.45)]" />
              <div className="mx-auto mt-1 h-2 w-2 rounded-full bg-white/70 shadow-[0_0_16px_rgba(255,255,255,0.35)]" />
            </div>
          </div>

          {/* 2D Bubble (roll + pitch 같이 보여주기) */}
          <div className="relative mt-3 h-10 rounded-xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/15" />
            <div className="pointer-events-none absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/10" />

            <div
              className={[
                'absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
                isLevel ? 'bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.65)]' : 'bg-white/70 shadow-[0_0_14px_rgba(255,255,255,0.25)]',
              ].join(' ')}
              style={{
                transform: `translate(calc(-50% + ${bubbleX}px), calc(-50% + ${bubbleY}px))`,
              }}
              title="2D BUBBLE"
            />

            <div className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-white/40">←</div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-white/40">→</div>
            <div className="absolute left-1/2 top-1 -translate-x-1/2 font-mono text-[9px] text-white/40">↑</div>
            <div className="absolute left-1/2 bottom-1 -translate-x-1/2 font-mono text-[9px] text-white/40">↓</div>
          </div>

          <div className="relative mt-2 flex items-center justify-between">
            <div className="font-mono text-[11px] text-white/60">THRESH: ±{LEVEL_DEG}° (ROLL+PITCH)</div>
            <div className="font-mono text-[11px] text-white/65">
              {isLevel ? 'LEVEL LOCK' : 'ADJUST'}
            </div>
          </div>
        </div>
      </div>

      {/* iOS permission prompt */}
      {permissionNeeded && !permissionGranted && (
        <div className="relative mt-3 rounded-xl bg-white/5 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
          <div className="font-mono text-xs text-white/80">iPhone/iPad에서 센서 사용 권한이 필요합니다.</div>
          <button
            onClick={requestIOSPermission}
            className="mt-2 w-full rounded-lg bg-emerald-600/80 px-3 py-2 text-sm font-mono text-black hover:bg-emerald-600 active:bg-emerald-700"
          >
            센서 권한 허용
          </button>
          <div className="mt-2 font-mono text-[11px] text-white/55">* 버튼을 눌러야 기울기(수평계)가 작동합니다.</div>
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
        .needlePulse {
          animation: needlePulse 0.9s ease-in-out infinite;
        }
        @keyframes needlePulse {
          0%,
          100% {
            filter: drop-shadow(0 0 0 rgba(52, 211, 153, 0));
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(52, 211, 153, 0.55));
          }
        }
      `}</style>
    </div>
  );
}
