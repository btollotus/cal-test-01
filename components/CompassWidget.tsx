'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function clampAngle(deg: number) {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

function dirLabel(deg: number) {
  const a = clampAngle(deg);
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(a / 45) % 8;
  return dirs[idx];
}

export default function CompassWidget() {
  const [supported, setSupported] = useState(true);
  const [needPermission, setNeedPermission] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const smoothRef = useRef<number | null>(null);

  const pretty = useMemo(() => {
    if (heading === null) return { deg: '—', dir: '—' };
    const a = clampAngle(heading);
    return { deg: `${Math.round(a)}°`, dir: dirLabel(a) };
  }, [heading]);

  const handleOrientation = (e: DeviceOrientationEvent) => {
    // iOS Safari: webkitCompassHeading 제공(0=북, 시계방향)
    const anyE = e as any;
    const iosHeading = typeof anyE.webkitCompassHeading === 'number' ? anyE.webkitCompassHeading : null;

    // 표준: alpha(0~360) - 북쪽 기준일 수 있으나 기기/브라우저에 따라 달라질 수 있음
    const alpha = typeof e.alpha === 'number' ? e.alpha : null;

    const raw = iosHeading ?? alpha;
    if (raw === null) return;

    // 간단한 스무딩(튀는 값 완화)
    const prev = smoothRef.current;
    const next = raw;

    if (prev === null) {
      smoothRef.current = next;
      setHeading(next);
      return;
    }

    // 각도 래핑 고려한 보간
    let delta = next - prev;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const smoothed = prev + delta * 0.15; // 0.1~0.2 정도가 부드러움
    smoothRef.current = smoothed;
    setHeading(smoothed);
  };

  const start = async () => {
    setErr(null);

    try {
      if (typeof window === 'undefined') return;
      if (!('DeviceOrientationEvent' in window)) {
        setSupported(false);
        return;
      }

      // iOS 13+: 권한 요청 필요
      const anyDOE = DeviceOrientationEvent as any;
      if (typeof anyDOE?.requestPermission === 'function') {
        setNeedPermission(true);
        const res = await anyDOE.requestPermission();
        if (res !== 'granted') {
          setErr('권한이 필요합니다.');
          return;
        }
      }

      setNeedPermission(false);
      window.addEventListener('deviceorientation', handleOrientation, true);
    } catch (e: any) {
      setErr(e?.message ?? '센서 시작 실패');
    }
  };

  useEffect(() => {
    // 안드로이드/데스크톱 일부는 권한 없이도 바로 됨 → 자동 시작 시도
    start();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rot = heading === null ? 0 : clampAngle(heading);

  return (
    <div className="rounded-2xl bg-zinc-900/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]">
      {/* HUD 헤더 */}
      <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-widest text-white/80">
        <div>COMPASS HUD</div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
          <span className="text-white/70">{heading === null ? 'WAIT' : 'OK'}</span>
        </div>
      </div>

      {/* 내용 */}
      <div className="mt-3 grid grid-cols-[1fr_92px] items-center gap-3">
        {/* 다이얼 */}
        <div className="relative aspect-square w-full rounded-2xl bg-black/40 overflow-hidden shadow-inner">
          {/* 스캔라인 */}
          <div className="pointer-events-none absolute inset-0 opacity-25 [background:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_2px,transparent_2px,transparent_6px)]" />

          {/* 링 */}
          <div className="absolute inset-4 rounded-full border border-white/10" />
          <div className="absolute inset-10 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/10" />

          {/* N/E/S/W */}
          <div className="absolute left-1/2 top-2 -translate-x-1/2 font-mono text-xs text-white/70">N</div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-white/70">E</div>
          <div className="absolute left-1/2 bottom-2 -translate-x-1/2 font-mono text-xs text-white/70">S</div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-white/70">W</div>

{/* 바늘(북쪽) - 중앙 회전 고정 */}
<div
  className="absolute left-1/2 top-1/2 transition-transform duration-100"
  style={{ transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
>
  <div className="h-[42%] w-1 origin-bottom -translate-y-[85%] rounded-full bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.7)]" />
</div>

          {/* 중심 점 */}
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
        </div>

        {/* 숫자/상태 */}
        <div className="rounded-2xl bg-white/5 p-3 text-center">
          <div className="font-mono text-3xl text-white">{pretty.deg}</div>
          <div className="mt-1 font-mono text-sm tracking-widest text-white/70">{pretty.dir}</div>

          {needPermission && (
            <button
              onClick={start}
              className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 font-mono text-xs hover:bg-emerald-700 active:bg-emerald-800"
            >
              센서 권한 켜기
            </button>
          )}

          {!supported && <div className="mt-3 font-mono text-[11px] text-white/60">이 기기/브라우저는 지원 안됨</div>}
          {err && <div className="mt-3 font-mono text-[11px] text-rose-200">{err}</div>}
        </div>
      </div>

      <div className="mt-3 font-mono text-[11px] text-white/55">
        * iPhone은 “센서 권한 켜기” 버튼을 눌러야 동작합니다.
      </div>
    </div>
  );
}
