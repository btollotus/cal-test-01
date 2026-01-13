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

  // 스무딩
  const smoothRef = useRef<number | null>(null);

  // LOCK 상태
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);

  // “딩” 중복 방지(LOCK 진입 시 1회)
  const dingedRef = useRef(false);

  // ✅ AudioContext 재사용(정책상 막히면 무음)
  const audioRef = useRef<AudioContext | null>(null);

  // 설정값
  const LOCK_THRESH_DEG = 2; // 북쪽(0°) ±2°면 LOCK

  const pretty = useMemo(() => {
    if (heading === null) return { deg: '—', dir: '—' };
    const a = clampAngle(heading);
    return { deg: `${Math.round(a)}°`, dir: dirLabel(a) };
  }, [heading]);

  /** ✅ 짧은 “딩!” (외부 파일 없이, ctx 재사용) */
  const playDing = async () => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!audioRef.current) audioRef.current = new AudioCtx();

      const ctx = audioRef.current;
      if (ctx.state === 'suspended') {
        // 권한/정책상 resume이 막힐 수도 있음
        await ctx.resume().catch(() => {});
      }

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);

      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

      o.connect(g);
      g.connect(ctx.destination);

      o.start();
      o.stop(ctx.currentTime + 0.13);
    } catch {
      // 무음 (브라우저/권한/정책에 따라 실패 가능)
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    const anyE = e as any;

    // iOS Safari: webkitCompassHeading 제공(0=북, 시계방향)
    const iosHeading = typeof anyE.webkitCompassHeading === 'number' ? anyE.webkitCompassHeading : null;

    // 표준: alpha
    const alpha = typeof e.alpha === 'number' ? e.alpha : null;

    const raw = iosHeading ?? alpha;
    if (raw === null) return;

    // 스무딩
    const prev = smoothRef.current;
    const next = raw;

    if (prev === null) {
      smoothRef.current = next;
      setHeading(next);
      return;
    }

    // 각도 래핑 보간
    let delta = next - prev;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const smoothed = prev + delta * 0.15;
    smoothRef.current = smoothed;
    setHeading(smoothed);

    // LOCK 판정: 0° 근처면 잠금
    const a = clampAngle(smoothed);
    const distToNorth = Math.min(a, 360 - a);

    const nowLocked = distToNorth <= LOCK_THRESH_DEG;

    if (nowLocked !== lockedRef.current) {
      lockedRef.current = nowLocked;
      setLocked(nowLocked);

      // ✅ LOCK 진입 시 딩 1회
      if (nowLocked) {
        if (!dingedRef.current) {
          dingedRef.current = true;
          playDing();
        }
      } else {
        // LOCK 해제되면 다시 딩 가능
        dingedRef.current = false;
      }
    }
  };

  const start = async () => {
    setErr(null);

    try {
      if (typeof window === 'undefined') return;
      if (!('DeviceOrientationEvent' in window)) {
        setSupported(false);
        return;
      }

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

      // ✅ iOS 오디오 정책 때문에 "권한 버튼 누른 시점"에서 ctx 생성이 유리
      // (자동 시작에서 막히면 나중에 LOCK 때도 막히는 경우가 있어 미리 준비)
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        if (!audioRef.current) audioRef.current = new AudioCtx();
      } catch {}
    } catch (e: any) {
      setErr(e?.message ?? '센서 시작 실패');
    }
  };

  useEffect(() => {
    start();
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 표시용 회전 각도(0~360)
  const rot = heading === null ? 0 : clampAngle(heading);

  // ✅ 일반 나침반: 바늘이 가리키는 북쪽은 -heading이 자연스러움
  const needleRotate = -rot;

  return (
    <div className="rounded-2xl bg-zinc-900/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]">
      {/* HUD 헤더 */}
      <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-widest text-white/80">
        <div>COMPASS HUD</div>

        <div className="flex items-center gap-2">
          <span
            className={[
              'inline-block h-2.5 w-2.5 rounded-full',
              locked
                ? 'bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,1)]'
                : 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]',
            ].join(' ')}
          />
          <span className="text-white/70">{heading === null ? 'WAIT' : locked ? 'LOCK' : 'OK'}</span>
        </div>
      </div>

      {/* 내용 */}
      <div className="mt-3 grid grid-cols-[1fr_92px] items-center gap-3">
        {/* 다이얼 */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/40 shadow-inner">
          {/* 스캔라인 */}
          <div className="pointer-events-none absolute inset-0 opacity-25 [background:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_2px,transparent_2px,transparent_6px)]" />

          {/* 링 */}
          <div className="absolute inset-4 rounded-full border border-white/10" />
          <div className="absolute inset-10 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/10" />

          {/* N/E/S/W */}
          <div
            className="absolute left-1/2 top-2 -translate-x-1/2 font-mono text-xs font-bold"
            style={{
              color: '#ff3b3b',
              textShadow: locked ? '0 0 16px rgba(52,211,153,0.9)' : '0 0 14px rgba(255,60,60,0.75)',
            }}
          >
            N
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-white/70">E</div>
          <div className="absolute left-1/2 bottom-2 -translate-x-1/2 font-mono text-xs text-white/70">S</div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-white/70">W</div>

          {/* ✅ 이미지처럼: 길쭉한 다이아 바늘 + 가운데 금속 캡 */}
          <div
            className="absolute left-1/2 top-1/2 transition-transform duration-100"
            style={{ transform: `translate(-50%, -50%) rotate(${needleRotate}deg)` }}
          >
            {/* 바늘 레이어 */}
            <div className="relative h-[72%] w-[70%]">
              {/* 다이아 바늘(외곽선) */}
              <div
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: 'translate(-50%, -50%)',
                  width: 0,
                  height: 0,
                }}
              />

              {/* 북쪽(위) 다이아 반쪽 - 밝게/붉은기 */}
              <div
                className="absolute left-1/2 top-[6%] -translate-x-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderBottom: '120px solid rgba(255,255,255,0.92)',
                  filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.25))',
                }}
              />
              {/* 북쪽 안쪽 빨간 라인(포인트) */}
              <div
                className="absolute left-1/2 top-[14%] -translate-x-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderBottom: '86px solid rgba(255,60,60,0.65)',
                  filter: 'drop-shadow(0 0 10px rgba(255,60,60,0.35))',
                }}
              />

              {/* 남쪽(아래) 다이아 반쪽 - 약간 어둡게 */}
              <div
                className="absolute left-1/2 bottom-[6%] -translate-x-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '120px solid rgba(255,255,255,0.55)',
                  filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.18))',
                }}
              />

              {/* 외곽선 느낌(얇은 라인) */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: '28px',
                  height: '220px',
                  border: '2px solid rgba(255,255,255,0.55)',
                  borderRadius: '999px',
                  transform: 'translate(-50%, -50%) rotate(0deg)',
                  opacity: 0.35,
                  filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.12))',
                }}
              />

              {/* 중앙 금속 캡 */}
              <div
                className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(180,180,180,0.75) 35%, rgba(90,90,90,0.9) 70%, rgba(0,0,0,0.92) 100%)',
                  boxShadow: '0 0 16px rgba(0,0,0,0.45), inset 0 0 10px rgba(255,255,255,0.12)',
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: 'rgba(255,255,255,0.85)' }}
              />
            </div>
          </div>

          {/* 중심 점 */}
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />

          {/* LOCK 링(LOCK 시 강조) */}
          {locked && (
            <div className="pointer-events-none absolute inset-6 rounded-full ring-2 ring-emerald-400/40 shadow-[0_0_22px_rgba(52,211,153,0.25)]" />
          )}
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

          <div className="mt-3 font-mono text-[11px] text-white/55">LOCK: ±{LOCK_THRESH_DEG}°</div>
        </div>
      </div>

      <div className="mt-3 font-mono text-[11px] text-white/55">
        * iPhone은 “센서 권한 켜기” 버튼을 눌러야 동작합니다.
      </div>
    </div>
  );
}
