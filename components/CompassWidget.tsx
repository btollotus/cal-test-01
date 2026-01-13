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

/** 짧은 “딩!” 효과음 (외부 파일 없이) */
function playDing() {
  try {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AudioCtx();

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

    o.onended = () => {
      try {
        ctx.close();
      } catch {}
    };
  } catch {
    // 무음 (브라우저/권한/정책에 따라 실패할 수 있음)
  }
}

/**
 * ✅ 방향 추출 (정확도 개선 포인트)
 * - iOS: webkitCompassHeading (0=N, 시계방향) 우선
 * - 그 외: alpha는 보통 "시계방향"인데 그대로 쓰면 뒤집히는 경우가 많아 360 - alpha를 기본으로
 * - 화면 회전(orientation angle) 보정까지 적용
 */
function getHeadingFromEvent(e: DeviceOrientationEvent): number | null {
  const anyE = e as any;

  // iOS Safari (권장)
  if (typeof anyE.webkitCompassHeading === 'number') {
    return clampAngle(anyE.webkitCompassHeading);
  }

  // Standard alpha fallback
  if (typeof e.alpha !== 'number') return null;

  // 많은 Android/Chrome에서 이게 더 맞는 편
  let heading = 360 - e.alpha;

  // 화면 회전 보정 (기기/브라우저마다 있을 수도/없을 수도)
  const screenAngle =
    (window.screen?.orientation && typeof window.screen.orientation.angle === 'number'
      ? window.screen.orientation.angle
      : typeof (window as any).orientation === 'number'
        ? (window as any).orientation
        : 0) ?? 0;

  heading = heading + screenAngle;

  return clampAngle(heading);
}

export default function CompassWidget() {
  const [supported, setSupported] = useState(true);
  const [needPermission, setNeedPermission] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 스무딩
  const smoothRef = useRef<number | null>(null);

  // ✅ 사용자 보정(캘리브레이션) 오프셋
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);

  // LOCK 상태
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const dingedRef = useRef(false);

  // 설정값 (원하면 여기만 조절)
  const LOCK_THRESH_DEG = 2; // “북쪽(0°)” ±2°면 LOCK

  const pretty = useMemo(() => {
    if (heading === null) return { deg: '—', dir: '—' };
    const a = clampAngle(heading);
    return { deg: `${Math.round(a)}°`, dir: dirLabel(a) };
  }, [heading]);

  const handleOrientation = (e: DeviceOrientationEvent) => {
    const raw = getHeadingFromEvent(e);
    if (raw === null) return;

    // ✅ 캘리브레이션 오프셋 적용 (사용자가 CAL 누르면 보정됨)
    const rawAdj = clampAngle(raw + offsetRef.current);

    // 스무딩
    const prev = smoothRef.current;
    if (prev === null) {
      smoothRef.current = rawAdj;
      setHeading(rawAdj);
      return;
    }

    let delta = rawAdj - prev;
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

      if (nowLocked) {
        if (!dingedRef.current) {
          dingedRef.current = true;
          playDing();
        }
      } else {
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

      // iOS 오디오 정책 대비(사용자 제스처 시점)
      try {
        playDing();
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

  // 현재 헤딩
  const rot = heading === null ? 0 : clampAngle(heading);

  // ✅ “바늘이 북쪽을 가리키는” 표현: 기기가 바라보는 방향이 rot(시계방향)일 때,
  // 북쪽은 화면에서 반대로(-rot) 만큼 돌아가 있어야 자연스럽습니다.
  const needleRotate = -rot;

  const doCalibrate = () => {
    // 현재 heading을 0°(북쪽)로 만들기 위해 offset을 -current로 설정
    const cur = heading === null ? 0 : clampAngle(heading);
    const newOffset = clampAngle(offsetRef.current - cur);
    offsetRef.current = newOffset;
    setOffset(newOffset);

    // 스무딩도 초기화해서 “즉시” 깔끔히 맞게
    smoothRef.current = null;
  };

  return (
    <div className="rounded-2xl bg-zinc-900/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]">
      {/* HUD 헤더 */}
      <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-widest text-white/80">
        <div>COMPASS HUD</div>

        <div className="flex items-center gap-3">
          {/* CAL 버튼 */}
          <button
            onClick={doCalibrate}
            className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/15 active:bg-white/20"
            title="현재 방향을 북쪽(0°) 기준으로 보정"
          >
            CAL
          </button>

          {/* 상태 LED */}
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
      </div>

      {/* 내용 */}
      <div className="mt-3 grid grid-cols-[1fr_92px] items-center gap-3">
        {/* 다이얼 */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/40 shadow-inner">
          {/* 스캔라인 */}
          <div className="pointer-events-none absolute inset-0 opacity-25 [background:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_2px,transparent_2px,transparent_6px)]" />

          {/* 링/십자 */}
          <div className="absolute inset-4 rounded-full border border-white/10" />
          <div className="absolute inset-10 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/10" />

          {/* N/E/S/W */}
          <div
            className={[
              'absolute left-1/2 top-2 -translate-x-1/2 font-mono text-xs font-bold',
              locked
                ? 'text-emerald-200 drop-shadow-[0_0_12px_rgba(52,211,153,1)]'
                : 'text-rose-300 drop-shadow-[0_0_10px_rgba(251,113,133,0.9)]',
            ].join(' ')}
          >
            N
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-white/70">E</div>
          <div className="absolute left-1/2 bottom-2 -translate-x-1/2 font-mono text-xs text-white/70">S</div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-white/70">W</div>

          {/* ✅ 1px “실선 바늘” (삼각형 제거) */}
          <div
            className="absolute left-1/2 top-1/2 transition-transform duration-100"
            style={{ transform: `translate(-50%, -50%) rotate(${needleRotate}deg)` }}
          >
            <div className="relative h-[78%] w-[2px]">
              {/* 북쪽(빨강 라인) */}
              <div className="absolute left-1/2 top-0 h-1/2 w-[1px] -translate-x-1/2 bg-rose-300 shadow-[0_0_12px_rgba(251,113,133,0.8)]" />
              {/* 남쪽(회색 라인) */}
              <div className="absolute left-1/2 bottom-0 h-1/2 w-[1px] -translate-x-1/2 bg-white/30 shadow-[0_0_10px_rgba(255,255,255,0.12)]" />

              {/* 북쪽 끝 “짧은 캡(1px)” */}
              <div className="absolute left-1/2 top-0 h-[10px] w-[10px] -translate-x-1/2 -translate-y-[6px] rounded-full border border-rose-300/70 shadow-[0_0_10px_rgba(251,113,133,0.45)]" />
            </div>
          </div>

          {/* 중심 핀 */}
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 ring-1 ring-white/15 shadow-inner" />
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />

          {/* LOCK 링 */}
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
          <div className="mt-1 font-mono text-[11px] text-white/40">CAL: offset {Math.round(offset)}°</div>
        </div>
      </div>

      <div className="mt-3 font-mono text-[11px] text-white/55">
        * iPhone은 “센서 권한 켜기” 버튼을 눌러야 동작합니다. (또는 터치 제스처 후 센서가 안정화될 수 있어요)
      </div>
    </div>
  );
}
