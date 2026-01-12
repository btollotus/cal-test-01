'use client';

import { useEffect, useMemo, useState } from 'react';

type Mode = 'mouse' | 'slider' | 'sensor';

export default function LevelWidget() {
  const [mode, setMode] = useState<Mode>('mouse');

  // 좌우(roll), 앞뒤(pitch) 각도 (대략 -45~+45)
  const [roll, setRoll] = useState(0);
  const [pitch, setPitch] = useState(0);

  // 센서 권한 상태
  const [sensorReady, setSensorReady] = useState(false);
  const [sensorErr, setSensorErr] = useState<string | null>(null);

  const inRange = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const status = useMemo(() => {
    const ok = Math.abs(roll) < 1 && Math.abs(pitch) < 1;
    return ok ? '수평 ✅' : '기울어짐';
  }, [roll, pitch]);

  const bubbleLeft = useMemo(() => {
    // roll -15~+15를 레일 안에서 이동
    const r = inRange(roll, -15, 15);
    return 50 + (r / 15) * 40; // % (10~90)
  }, [roll]);

  const bubbleTop = useMemo(() => {
    // pitch -15~+15를 레일 안에서 이동
    const p = inRange(pitch, -15, 15);
    return 50 + (p / 15) * 40; // % (10~90)
  }, [pitch]);

  async function enableSensor() {
    setSensorErr(null);
    try {
      // iOS는 권한 요청이 필요할 수 있음
      const anyDO = DeviceOrientationEvent as any;
      if (typeof anyDO?.requestPermission === 'function') {
        const res = await anyDO.requestPermission();
        if (res !== 'granted') {
          setSensorErr('센서 권한이 거부되었습니다.');
          setSensorReady(false);
          return;
        }
      }
      setSensorReady(true);
      setMode('sensor');
    } catch (e: any) {
      setSensorErr(e?.message ?? '센서 권한 요청 실패');
      setSensorReady(false);
    }
  }

  useEffect(() => {
    // 센서 모드일 때만 이벤트 연결
    if (mode !== 'sensor') return;

    const onOri = (e: DeviceOrientationEvent) => {
      // gamma: 좌우(-90~90), beta: 앞뒤(-180~180)
      const g = typeof e.gamma === 'number' ? e.gamma : 0;
      const b = typeof e.beta === 'number' ? e.beta : 0;

      // 너무 민감하면 줄여서 사용 (0.7 배율)
      setRoll(inRange(g * 0.7, -45, 45));
      setPitch(inRange(b * 0.7, -45, 45));
    };

    window.addEventListener('deviceorientation', onOri, true);
    return () => window.removeEventListener('deviceorientation', onOri, true);
  }, [mode]);

  useEffect(() => {
    // PC에서 마우스로 테스트
    if (mode !== 'mouse') return;

    const onMove = (ev: MouseEvent) => {
      const x = (ev.clientX / window.innerWidth - 0.5) * 30; // -15~+15 근사
      const y = (ev.clientY / window.innerHeight - 0.5) * 30;
      setRoll(inRange(x, -15, 15));
      setPitch(inRange(y, -15, 15));
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [mode]);

  const bubbleColor =
    Math.abs(roll) < 1 && Math.abs(pitch) < 1 ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">수평계</div>
          <div className="text-sm text-neutral-600">
            Roll(좌우): <span className="font-mono">{roll.toFixed(1)}°</span> · Pitch(앞뒤):{' '}
            <span className="font-mono">{pitch.toFixed(1)}°</span> · {status}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMode('mouse')}
            className={`rounded-xl px-3 py-2 text-sm ${
              mode === 'mouse' ? 'bg-black text-white' : 'bg-neutral-100'
            }`}
          >
            마우스
          </button>
          <button
            onClick={() => setMode('slider')}
            className={`rounded-xl px-3 py-2 text-sm ${
              mode === 'slider' ? 'bg-black text-white' : 'bg-neutral-100'
            }`}
          >
            슬라이더
          </button>
          <button
            onClick={enableSensor}
            className={`rounded-xl px-3 py-2 text-sm ${
              mode === 'sensor' ? 'bg-black text-white' : 'bg-neutral-100'
            }`}
          >
            센서
          </button>
        </div>
      </div>

      {/* 수평계 화면 */}
      <div className="mt-4">
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
          {/* 기준선 */}
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-neutral-300" />
          <div className="absolute top-0 left-1/2 w-px h-full -translate-x-1/2 bg-neutral-300" />

          {/* 버블 */}
          <div
            className={`absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full ${bubbleColor} shadow`}
            style={{ left: `${bubbleLeft}%`, top: `${bubbleTop}%` }}
            title="버블"
          />
        </div>

        {/* 슬라이더 모드 */}
        {mode === 'slider' && (
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-neutral-700">
              Roll(좌우) {roll.toFixed(1)}°
              <input
                type="range"
                min={-15}
                max={15}
                step={0.1}
                value={roll}
                onChange={(e) => setRoll(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm text-neutral-700">
              Pitch(앞뒤) {pitch.toFixed(1)}°
              <input
                type="range"
                min={-15}
                max={15}
                step={0.1}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </div>
        )}

        {/* 센서 안내 */}
        {mode === 'sensor' && (
          <div className="mt-4 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-700">
            {sensorErr ? (
              <div>⚠️ {sensorErr}</div>
            ) : sensorReady ? (
              <div>📱 휴대폰을 기울이면 버블이 움직입니다. (HTTPS 환경에서 잘 동작)</div>
            ) : (
              <div>📱 센서 사용을 누르고 권한을 허용해주세요.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
