'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

type Unit = 'mm' | 'cm';

export default function RulerPage() {
  // ✅ 기준: 신용카드 가로 85.60mm
  const CARD_WIDTH_MM = 85.6;

  // pxPerMm: 1mm가 화면에서 몇 px인지
  const [pxPerMm, setPxPerMm] = useState<number | null>(null);

  // calibration slider(카드 오버레이 폭 px)
  const [calPx, setCalPx] = useState(320);

  // 측정 상태
  const [unit, setUnit] = useState<Unit>('cm');
  const [measuring, setMeasuring] = useState(false);
  const [p1, setP1] = useState<{ x: number; y: number } | null>(null);
  const [p2, setP2] = useState<{ x: number; y: number } | null>(null);

  // 드래그 중
  const draggingRef = useRef<'p1' | 'p2' | null>(null);

  // 최초 로드 시 localStorage에서 보정값 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pxPerMm');
      if (saved) setPxPerMm(parseFloat(saved));
    } catch {}
  }, []);

  // calPx 변경 -> pxPerMm 계산(카드 가로 85.6mm를 calPx(px)에 맞춤)
  const computedPxPerMm = useMemo(() => {
    const v = calPx / CARD_WIDTH_MM;
    return v;
  }, [calPx]);

  const saveCalibration = () => {
    setPxPerMm(computedPxPerMm);
    try {
      localStorage.setItem('pxPerMm', String(computedPxPerMm));
    } catch {}
  };

  const resetCalibration = () => {
    setPxPerMm(null);
    try {
      localStorage.removeItem('pxPerMm');
    } catch {}
  };

  const activePxPerMm = pxPerMm ?? computedPxPerMm;

  // 픽셀 거리 -> mm
  const distMm = useMemo(() => {
    if (!p1 || !p2) return 0;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dPx = Math.sqrt(dx * dx + dy * dy);
    return dPx / activePxPerMm;
  }, [p1, p2, activePxPerMm]);

  const distText = useMemo(() => {
    if (!p1 || !p2) return unit === 'cm' ? '0.0 cm' : '0 mm';
    if (unit === 'mm') return `${Math.round(distMm)} mm`;
    return `${(distMm / 10).toFixed(1)} cm`;
  }, [p1, p2, unit, distMm]);

  // 화면 눈금(가로/세로) 기준 px
  const tickEveryMm = 5; // 5mm 간격
  const tickPx = activePxPerMm * tickEveryMm;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!measuring) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 처음이면 p1을 만들고, 다음은 p2
    if (!p1 || (p1 && p2)) {
      setP1({ x, y });
      setP2(null);
      draggingRef.current = 'p1';
      return;
    }

    // p1만 있으면 p2 생성
    setP2({ x, y });
    draggingRef.current = 'p2';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!measuring) return;
    const which = draggingRef.current;
    if (!which) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);

    if (which === 'p1') setP1({ x, y });
    if (which === 'p2') setP2({ x, y });
  };

  const onPointerUp = () => {
    draggingRef.current = null;
  };

  // 핸들 드래그 시작
  const startDrag = (which: 'p1' | 'p2') => (e: React.PointerEvent) => {
    e.stopPropagation();
    draggingRef.current = which;
  };

  // 측정 초기화
  const clearMeasure = () => {
    setP1(null);
    setP2(null);
    draggingRef.current = null;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-mono opacity-80 hover:opacity-100">
            ← HOME
          </Link>
          <div className="text-xs font-mono opacity-70">📏 Virtual Ruler (Calibration)</div>
        </div>

        {/* 컨트롤 */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_360px]">
          {/* 작업 영역 */}
          <div
            className="relative h-[68vh] min-h-[420px] rounded-2xl bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] overflow-hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* 스캔라인 */}
            <div className="pointer-events-none absolute inset-0 opacity-60 scanlines" />

            {/* 눈금 (가로) */}
            <div className="pointer-events-none absolute left-0 top-0 h-10 w-full bg-black/20 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
              <div className="relative h-full w-full">
                {Array.from({ length: 200 }).map((_, i) => {
                  const x = i * tickPx;
                  return (
                    <div
                      key={i}
                      className="absolute top-0"
                      style={{ left: `${x}px` }}
                    >
                      <div
                        className={[
                          'w-[1px] bg-white/25',
                          i % 2 === 0 ? 'h-8' : 'h-5',
                          i % 10 === 0 ? 'bg-emerald-300/60 h-9' : '',
                        ].join(' ')}
                      />
                      {i % 10 === 0 && (
                        <div className="mt-0.5 -translate-x-2 font-mono text-[10px] text-white/55">
                          {(i * tickEveryMm) / 10}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 눈금 (세로) */}
            <div className="pointer-events-none absolute left-0 top-10 bottom-0 w-10 bg-black/20 shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)]">
              <div className="relative h-full w-full">
                {Array.from({ length: 200 }).map((_, i) => {
                  const y = i * tickPx;
                  return (
                    <div
                      key={i}
                      className="absolute left-0"
                      style={{ top: `${y}px` }}
                    >
                      <div
                        className={[
                          'h-[1px] bg-white/25',
                          i % 2 === 0 ? 'w-8' : 'w-5',
                          i % 10 === 0 ? 'bg-emerald-300/60 w-9' : '',
                        ].join(' ')}
                      />
                      {i % 10 === 0 && (
                        <div className="ml-1 -translate-y-2 font-mono text-[10px] text-white/55">
                          {(i * tickEveryMm) / 10}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 카드 보정 오버레이 */}
            {!pxPerMm && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  className="rounded-xl border border-emerald-300/70 bg-emerald-300/10 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                  style={{ width: `${calPx}px`, height: `${calPx * 0.63}px` }}
                />
                <div className="mt-2 text-center font-mono text-[12px] text-white/70">
                  신용카드(가로 85.6mm)에 맞게 폭을 조절하세요
                </div>
              </div>
            )}

            {/* 측정 선/점 */}
            {p1 && (
              <div
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                style={{ left: `${p1.x}px`, top: `${p1.y}px` }}
                onPointerDown={startDrag('p1')}
              />
            )}
            {p2 && (
              <div
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.55)]"
                style={{ left: `${p2.x}px`, top: `${p2.y}px` }}
                onPointerDown={startDrag('p2')}
              />
            )}
            {p1 && p2 && (
              <>
                <svg className="pointer-events-none absolute inset-0">
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="rgba(52,211,153,0.75)"
                    strokeWidth="2"
                  />
                </svg>
                <div
                  className="absolute rounded-xl bg-black/50 px-3 py-2 font-mono text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.10)]"
                  style={{ left: `${(p1.x + p2.x) / 2}px`, top: `${(p1.y + p2.y) / 2}px`, transform: 'translate(-50%, -140%)' }}
                >
                  {distText}
                </div>
              </>
            )}
          </div>

          {/* 사이드 패널 */}
          <div className="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
            <div className="font-mono text-sm">설정</div>

            {/* 모드 */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMeasuring(false)}
                className={[
                  'rounded-xl px-3 py-2 font-mono text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.10)]',
                  !measuring ? 'bg-emerald-600/80 text-black' : 'bg-white/10 text-white/80',
                ].join(' ')}
              >
                보정
              </button>
              <button
                onClick={() => setMeasuring(true)}
                className={[
                  'rounded-xl px-3 py-2 font-mono text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.10)]',
                  measuring ? 'bg-emerald-600/80 text-black' : 'bg-white/10 text-white/80',
                ].join(' ')}
              >
                측정
              </button>
            </div>

            {/* 보정 */}
            {!pxPerMm && (
              <div className="mt-4">
                <div className="text-xs font-mono text-white/70">
                  카드 폭 조절: <span className="text-white/90">{Math.round(calPx)} px</span>
                </div>
                <input
                  className="mt-2 w-full"
                  type="range"
                  min={180}
                  max={520}
                  value={calPx}
                  onChange={(e) => setCalPx(parseInt(e.target.value, 10))}
                />
                <div className="mt-2 text-[11px] font-mono text-white/60">
                  카드(가로 85.6mm) 폭과 화면 오버레이 폭이 같게 맞춘 뒤 저장하세요.
                </div>

                <button
                  onClick={saveCalibration}
                  className="mt-3 w-full rounded-xl bg-emerald-600/80 px-3 py-2 font-mono text-sm text-black hover:bg-emerald-600 active:bg-emerald-700"
                >
                  보정 저장
                </button>
              </div>
            )}

            {/* 보정 완료 */}
            {pxPerMm && (
              <div className="mt-4 rounded-xl bg-black/30 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                <div className="font-mono text-xs text-white/80">보정 완료</div>
                <div className="mt-1 font-mono text-[11px] text-white/65">
                  1mm = {activePxPerMm.toFixed(3)} px
                </div>
                <button
                  onClick={resetCalibration}
                  className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 font-mono text-xs text-white/80 hover:bg-white/15"
                >
                  보정 초기화
                </button>
              </div>
            )}

            {/* 단위 */}
            <div className="mt-4">
              <div className="text-xs font-mono text-white/70">단위</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setUnit('cm')}
                  className={[
                    'rounded-xl px-3 py-2 font-mono text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.10)]',
                    unit === 'cm' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70',
                  ].join(' ')}
                >
                  cm
                </button>
                <button
                  onClick={() => setUnit('mm')}
                  className={[
                    'rounded-xl px-3 py-2 font-mono text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.10)]',
                    unit === 'mm' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70',
                  ].join(' ')}
                >
                  mm
                </button>
              </div>
            </div>

            {/* 측정 컨트롤 */}
            <div className="mt-4">
              <div className="text-xs font-mono text-white/70">측정</div>
              <div className="mt-2 text-[11px] font-mono text-white/60">
                측정 모드에서 화면을 탭 → 시작점/끝점 지정<br />
                점을 드래그해서 미세 조정 가능
              </div>

              <button
                onClick={clearMeasure}
                className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 font-mono text-xs text-white/80 hover:bg-white/15"
              >
                측정 초기화
              </button>
            </div>

            <div className="mt-4 text-[11px] font-mono text-white/55">
              * 정확도는 “보정(카드 맞추기)”에 달려있습니다.<br />
              * 보호필름/브라우저 줌이 켜져있으면 오차가 생길 수 있어요.
            </div>
          </div>
        </div>
      </div>

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
      `}</style>
    </div>
  );
}
