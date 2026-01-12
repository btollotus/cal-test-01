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
  // 화면에 보여줄 기울기(스무딩된 값)
  const [tilt, setTilt] = useState(0); // degrees, left(-) / right(+)
  const tiltRef = useRef(0);

  const [mode, setMode] = useState<Mode>('mouse');
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // “수평” 판정
  const LEVEL_DEG = 1.5; // 이 값 이하이면 수평으로 판정
  const isLevel = Math.abs(tilt) <= LEVEL_DEG;

  // “수평 진입” 순간에만 ding 1번 울리기
  const prevLevelRef = useRef(false);

  // WebAudio (ding)
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
      if (!canDingRef.current) return; // 과도한 연속 재생 방지
      canDingRef.current = false;
      setTimeout(() => (canDingRef.current = true), 450);

      const ctx = await ensureAudio();

      // “딩!”: 2음으로 살짝 게임느낌
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
    } catch {
      // 오디오 실패는 무시 (권한/브라우저 제한 등)
    }
  };

  // 센서 이벤트 등록
  useEffect(() => {
    const supports = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

    // iOS는 사용자 제스처로 requestPermission이 필요할 수 있음
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

  // requestPermission 버튼
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

  // 센서/마우스 입력 -> tiltRef 갱신
  useEffect(() => {
    // 센서 모드
    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: left/right (-90~90)
      const g = typeof e.gamma === 'number' ? e.gamma : 0;
      // 너무 튀는 값 제한
      tiltRef.current = clamp(g, -25, 25);
    };

    // 마우스 모드(데스크탑용)
    const onMouse = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const dx = (e.clientX - cx) / cx; // -1~1 근사
      tiltRef.current = clamp(dx * 18, -25, 25);
    };

    if (mode === 'sensor') {
      if (permissionNeeded && !permissionGranted) return;
      window.addEventListener('deviceorientation', onOrient, true);
      return () => window.removeEventListener('deviceorientation', onOrient, true);
    }

    window.addEventListener('mousemove', onMouse);
    return () => window.removeEventListener('mousemove', onMouse);
  }, [mode, permissionNeeded, permissionGranted]);

  // 스무딩 렌더 루프 + “수평 진입” 체크
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);

      const current = tiltRef.current;
      setTilt((prev) => {
        const next = lerp(prev, current, 0.12);
        return next;
      });
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  // 수평 진입 시 ding + 초록 불(OK 램프)
  useEffect(() => {
    const prev = prevLevelRef.current;
    if (!prev && isLevel) {
      // 수평이 "되었다" 순간
      ding();
    }
    prevLevelRef.current = isLevel;
  }, [isLevel]);

  // HUD 표현값
  const maxDeg = 18; // 게이지가 꽉 차는 기준 각도
  const norm = clamp(tilt / maxDeg, -1, 1); // -1~1
  const needleX = norm * 42; // px 이동량

  const hudText = useMemo(() => {
    const v = Math.round(tilt * 10) / 10;
    const sign = v > 0 ? '+' : '';
    return `${sign}${v}°`;
  }, [tilt]);

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
          <span className="ml-2 text-[10px] text-white/50">
            {mode === 'sensor' ? '(SENSOR)' : '(MOUSE)'}
          </span>
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

      {/* Gauge */}
      <div className="relative">
        {/* Track */}
        <div className="h-10 rounded-xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
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

          {/* Fill (directional) */}
          <div className="relative h-full overflow-hidden rounded-xl">
            <div
              className="absolute top-0 h-full w-1/2"
              style={{
                left: '50%',
                transform: `translateX(${Math.min(0, needleX)}px)`,
              }}
            >
              <div className="h-full w-full bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.35)]" />
            </div>
            <div
              className="absolute top-0 h-full w-1/2"
              style={{
                right: '50%',
                transform: `translateX(${Math.max(0, needleX)}px)`,
              }}
            >
              <div className="h-full w-full bg-fuchsia-400/20 shadow-[0_0_20px_rgba(232,121,249,0.30)]" />
            </div>
          </div>
        </div>

        {/* Needle */}
        <div
          className={[
            'absolute left-1/2 top-1/2 -translate-y-1/2',
            isLevel ? 'needlePulse' : '',
          ].join(' ')}
          style={{ transform: `translate(calc(-50% + ${needleX}px), -50%)` }}
        >
          <div className="h-12 w-2 rounded-full bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.45)]" />
          <div className="mx-auto mt-1 h-2 w-2 rounded-full bg-white/70 shadow-[0_0_16px_rgba(255,255,255,0.35)]" />
        </div>
      </div>

      {/* Footer readout */}
      <div className="relative mt-3 flex items-center justify-between">
        <div className="font-mono text-[11px] text-white/60">
          THRESH: ±{LEVEL_DEG}°
        </div>
        <div className="font-mono text-sm text-white/85">{hudText}</div>
      </div>

      {/* iOS permission prompt */}
      {permissionNeeded && !permissionGranted && (
        <div className="relative mt-3 rounded-xl bg-white/5 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]">
          <div className="font-mono text-xs text-white/80">
            iPhone/iPad에서 센서 사용 권한이 필요합니다.
          </div>
          <button
            onClick={requestIOSPermission}
            className="mt-2 w-full rounded-lg bg-emerald-600/80 px-3 py-2 text-sm font-mono text-black hover:bg-emerald-600 active:bg-emerald-700"
          >
            센센서 권한 허용
          </button>
          <div className="mt-2 font-mono text-[11px] text-white/55">
            * 버튼을 눌러야 기울기(수평계)가 작동합니다.
          </div>
        </div>
      )}

      {/* Styled effects */}
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
