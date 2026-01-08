'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

interface ArrowHit {
  x: number;
  y: number;
  score: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const TARGET_CENTER_X = CANVAS_WIDTH / 2;
const TARGET_CENTER_Y = CANVAS_HEIGHT / 2;
const TARGET_RADIUS = 120;

const WIND_FACTOR = 0.15; // 기본 바람 영향 계수(좌우)
const MAX_AIM_OFFSET = TARGET_RADIUS + 50;

// 당기기 UX
const MAX_PULL_PX = 160; // 이 이상 당기면 power 100
const BOW_X = 110; // 화면 좌측에 활 위치(정면 시점 UI 느낌)
const BOW_Y = CANVAS_HEIGHT - 150;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Web Audio API (외부 파일 없이 합성)
class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  public ensureInit() {
    if (this.initialized && this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.28;
      this.masterGain.connect(this.audioContext.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext 초기화 실패:', e);
    }
  }

  public resumeIfNeeded() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  private now() {
    return this.audioContext?.currentTime ?? 0;
  }

  // 아주 짧은 장력 "끽" (당길 때 2~3번만)
  public playTensionTick(intensity: number) {
    this.ensureInit();
    this.resumeIfNeeded();
    if (!this.audioContext || !this.masterGain) return;

    const t = this.now();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'triangle';
    const base = 260 + intensity * 220; // 당길수록 높아짐
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.75, t + 0.07);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  // 발사음: "팅"
  public playShootSound(power01: number) {
    this.ensureInit();
    this.resumeIfNeeded();
    if (!this.audioContext || !this.masterGain) return;

    const t = this.now();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    const base = 320 + power01 * 260;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.12);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  // 비행: 짧은 whoosh (한 번만)
  public playWhoosh(power01: number) {
    this.ensureInit();
    this.resumeIfNeeded();
    if (!this.audioContext || !this.masterGain) return;

    const t = this.now();
    const noise = this.audioContext.createBufferSource();
    const buffer = this.audioContext.createBuffer(1, 22050, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (0.9 - i / data.length);

    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700 + power01 * 800, t);
    filter.Q.setValueAtTime(1.2, t);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.14 + power01 * 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.36);
  }

  // 명중음: 톡 (점수에 따라 톤)
  public playHitSound(score: number) {
    this.ensureInit();
    this.resumeIfNeeded();
    if (!this.audioContext || !this.masterGain) return;

    const t = this.now();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    const base = 280 + score * 22;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.15);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  // 미스: 퍽(둔탁)
  public playMissSound() {
    this.ensureInit();
    this.resumeIfNeeded();
    if (!this.audioContext || !this.masterGain) return;

    const t = this.now();
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Perfect: 팝팝팝(폭죽)
  public playPerfectSound() {
    this.ensureInit();
    this.resumeIfNeeded();
    if (!this.audioContext || !this.masterGain) return;

    const t0 = this.now();
    [0, 0.05, 0.1].forEach((d) => {
      const t = t0 + d;
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'square';
      const freq = 420 + Math.random() * 140;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.1);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 0.11);
    });
  }
}

export default function ArcheryGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef(new SoundManager());

  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());

  const [aimX, setAimX] = useState(TARGET_CENTER_X);
  const [aimY, setAimY] = useState(TARGET_CENTER_Y);

  const [windSpeed, setWindSpeed] = useState(0);
  const [windDirection, setWindDirection] = useState<'left' | 'right'>('right');

  const [arrowHits, setArrowHits] = useState<ArrowHit[]>([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const [isShooting, setIsShooting] = useState(false);

  // 당기기 상태
  const [isPulling, setIsPulling] = useState(false);
  const [pullPower, setPullPower] = useState(0); // 0~100
  const pullStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTickRef = useRef(0); // 장력 사운드 제한

  // refs (RAF에서 최신값 읽기)
  const aimRef = useRef({ x: aimX, y: aimY });
  const windRef = useRef({ speed: windSpeed, dir: windDirection });
  const pullingRef = useRef({ pulling: isPulling, power: pullPower });

  useEffect(() => {
    aimRef.current = { x: aimX, y: aimY };
  }, [aimX, aimY]);

  useEffect(() => {
    windRef.current = { speed: windSpeed, dir: windDirection };
  }, [windSpeed, windDirection]);

  useEffect(() => {
    pullingRef.current = { pulling: isPulling, power: pullPower };
  }, [isPulling, pullPower]);

  const windLabel = useMemo(() => {
    const arrow = windDirection === 'right' ? '➡️' : '⬅️';
    return `${arrow} ${windSpeed.toFixed(1)} m/s`;
  }, [windDirection, windSpeed]);

  const generateWind = () => {
    const speed = Math.random() * 10;
    const direction = Math.random() > 0.5 ? 'right' : 'left';
    setWindSpeed(speed);
    setWindDirection(direction);
  };

  useEffect(() => {
    generateWind();
  }, []);

  // 키보드 입력(미세 이동 + 스페이스 빠른 발사)
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === ' ') {
        e.preventDefault();
        if (!isShooting && !isPulling) {
          // 빠른 발사: 기본 power 55
          quickShoot(55);
        }
      }
      // 입력이 들어오면 오디오 준비
      soundRef.current.ensureInit();
      soundRef.current.resumeIfNeeded();
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [isShooting, isPulling]);

  useEffect(() => {
    if (isShooting || isPulling) return;

    const moveSpeed = 2;
    const id = window.setInterval(() => {
      const keys = keysRef.current;
      let nx = aimRef.current.x;
      let ny = aimRef.current.y;

      if (keys.has('arrowleft') || keys.has('a')) nx -= moveSpeed;
      if (keys.has('arrowright') || keys.has('d')) nx += moveSpeed;
      if (keys.has('arrowup') || keys.has('w')) ny -= moveSpeed;
      if (keys.has('arrowdown') || keys.has('s')) ny += moveSpeed;

      nx = clamp(nx, TARGET_CENTER_X - MAX_AIM_OFFSET, TARGET_CENTER_X + MAX_AIM_OFFSET);
      ny = clamp(ny, TARGET_CENTER_Y - MAX_AIM_OFFSET, TARGET_CENTER_Y + MAX_AIM_OFFSET);

      if (nx !== aimRef.current.x || ny !== aimRef.current.y) {
        setAimX(nx);
        setAimY(ny);
      }
    }, 16);

    return () => window.clearInterval(id);
  }, [isShooting, isPulling]);

  // 마우스 조준(당기지 않을 때)
  const updateAimFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const nx = clamp(x, TARGET_CENTER_X - MAX_AIM_OFFSET, TARGET_CENTER_X + MAX_AIM_OFFSET);
    const ny = clamp(y, TARGET_CENTER_Y - MAX_AIM_OFFSET, TARGET_CENTER_Y + MAX_AIM_OFFSET);

    setAimX(nx);
    setAimY(ny);
  };

  // Perfect 파티클
  const createPerfectParticles = (x: number, y: number) => {
    const colors = ['#FF0000', '#FFAA00', '#FFFF00', '#00FF00', '#0000FF', '#FF00FF'];
    const particles: Particle[] = [];
    for (let i = 0; i < 22; i++) {
      const ang = (Math.PI * 2 * i) / 22;
      const sp = 1 + Math.random() * 2.5;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        size: 2 + Math.random() * 3,
      });
    }
    particlesRef.current = particles;
  };

  const updateParticles = () => {
    particlesRef.current = particlesRef.current
      .map((p) => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.08,
        alpha: Math.max(0, p.alpha - 0.018),
      }))
      .filter((p) => p.alpha > 0);
  };

  // 점수(중심 거리)
  const calculateScore = (x: number, y: number) => {
    const d = Math.hypot(x - TARGET_CENTER_X, y - TARGET_CENTER_Y);
    if (d > TARGET_RADIUS) return 0;
    const ringSize = TARGET_RADIUS / 10;
    const ring = Math.floor(d / ringSize);
    return Math.max(1, 10 - ring);
  };

  // 그리기 helpers
  const drawTarget = (ctx: CanvasRenderingContext2D) => {
    const colors = ['#FF0000', '#FFAA00', '#FFFF00', '#00FF00', '#0000FF', '#FF00FF', '#FF1493', '#00FFFF', '#FF00FF', '#FFFF00'];
    for (let i = 10; i >= 1; i--) {
      const r = (TARGET_RADIUS / 10) * i;
      ctx.fillStyle = colors[i - 1];
      ctx.beginPath();
      ctx.arc(TARGET_CENTER_X, TARGET_CENTER_Y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(TARGET_CENTER_X, TARGET_CENTER_Y, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawCrosshair = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 15, y);
    ctx.lineTo(x + 15, y);
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x, y + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
  };

  const drawWindGauge = (ctx: CanvasRenderingContext2D) => {
    const { speed, dir } = windRef.current;
    const x = 50, y = 50, w = 200, h = 30;

    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const arrowX = dir === 'right' ? x + w - 20 : x + 20;
    ctx.fillStyle = '#FFAA00';
    ctx.beginPath();
    if (dir === 'right') {
      ctx.moveTo(arrowX, y + h / 2);
      ctx.lineTo(arrowX - 15, y + h / 2 - 8);
      ctx.lineTo(arrowX - 15, y + h / 2 + 8);
    } else {
      ctx.moveTo(arrowX, y + h / 2);
      ctx.lineTo(arrowX + 15, y + h / 2 - 8);
      ctx.lineTo(arrowX + 15, y + h / 2 + 8);
    }
    ctx.closePath();
    ctx.fill();

    const barW = (speed / 10) * (w - 40);
    const barX = dir === 'right' ? x + w - 20 - barW : x + 20;
    ctx.fillStyle = speed > 5 ? '#FF0000' : speed > 2 ? '#FFAA00' : '#00FF00';
    ctx.fillRect(barX, y + 5, barW, h - 10);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`바람: ${speed.toFixed(1)} m/s`, x, y - 5);
  };

  const drawArrowHits = (ctx: CanvasRenderingContext2D) => {
    arrowHits.forEach((hit, idx) => {
      const alpha = idx === arrowHits.length - 1 ? 1 : 0.6;
      ctx.save();
      ctx.globalAlpha = alpha;

      const ang = Math.atan2(hit.y - TARGET_CENTER_Y, hit.x - TARGET_CENTER_X);

      ctx.save();
      ctx.translate(hit.x, hit.y);
      ctx.rotate(ang);

      // 작은 화살
      ctx.fillStyle = '#654321';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-12, -2);
      ctx.lineTo(-12, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#C0C0C0';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(6, -1.5);
      ctx.lineTo(6, 1.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      if (idx === arrowHits.length - 1) {
        ctx.fillStyle = hit.score === 10 ? '#FFD700' : '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(hit.score), hit.x, hit.y - 15);
      }

      ctx.restore();
    });
  };

  // 활/시위/화살 UI (당길 때 변화)
  const drawBowUI = (ctx: CanvasRenderingContext2D) => {
    const { pulling, power } = pullingRef.current;
    const p01 = power / 100;

    // 활 본체(곡선)
    ctx.save();
    ctx.translate(BOW_X, BOW_Y);

    // 활 몸통
    ctx.strokeStyle = '#8B5A2B';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.quadraticCurveTo(-35, 0, 0, 70);
    ctx.stroke();

    // 금속 장식
    ctx.strokeStyle = '#C0C0C0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, -68);
    ctx.lineTo(14, -55);
    ctx.moveTo(4, 68);
    ctx.lineTo(14, 55);
    ctx.stroke();

    // 시위(당기면 뒤로)
    const pullX = pulling ? 40 + p01 * 55 : 40;
    ctx.strokeStyle = '#EEE';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -68);
    ctx.lineTo(pullX, 0);
    ctx.lineTo(0, 68);
    ctx.stroke();

    // 화살(당기면 뒤로 이동)
    if (pulling) {
      // 화살축
      ctx.strokeStyle = '#d7c7a6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pullX - 10, 0);
      ctx.lineTo(pullX + 85, 0);
      ctx.stroke();

      // 화살촉
      ctx.fillStyle = '#C0C0C0';
      ctx.beginPath();
      ctx.moveTo(pullX + 85, 0);
      ctx.lineTo(pullX + 98, -5);
      ctx.lineTo(pullX + 98, 5);
      ctx.closePath();
      ctx.fill();

      // 깃
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.moveTo(pullX - 10, 0);
      ctx.lineTo(pullX - 22, -6);
      ctx.lineTo(pullX - 18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pullX - 10, 0);
      ctx.lineTo(pullX - 22, 6);
      ctx.lineTo(pullX - 18, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // Power 게이지
    const gx = 30;
    const gy = CANVAS_HEIGHT - 40;
    const gw = 240;
    const gh = 14;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.fillStyle = power > 75 ? '#ff4d4d' : power > 40 ? '#ffaa00' : '#00ff88';
    ctx.fillRect(gx, gy, (power / 100) * gw, gh);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`POWER: ${Math.round(power)}`, gx, gy - 6);
  };

  // RAF 루프: 항상 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;

    const loop = () => {
      // 파티클 업데이트
      if (particlesRef.current.length > 0) updateParticles();

      // 배경(실내 사격장 느낌)
      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#34495E';
      ctx.fillRect(0, CANVAS_HEIGHT - 100, CANVAS_WIDTH, 100);

      // 과녁/기록
      drawTarget(ctx);
      drawArrowHits(ctx);

      // 파티클
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 조준점(당기는 동안엔 약간 흔들림)
      const { pulling, power } = pullingRef.current;
      const p01 = power / 100;

      let ax = aimRef.current.x;
      let ay = aimRef.current.y;

      // 당기는 동안 손떨림(살짝)
      if (pulling) {
        const jitter = 0.6 + p01 * 1.6;
        ax += (Math.random() - 0.5) * jitter;
        ay += (Math.random() - 0.5) * jitter;
      }

      // 조준점: 발사 중에는 숨김
      if (!isShooting) drawCrosshair(ctx, ax, ay);

      // 바람 게이지
      drawWindGauge(ctx);

      // 활 UI
      drawBowUI(ctx);

      // 메시지
      if (message) {
        ctx.fillStyle =
          message === 'Perfect!' ? '#FFD700' : message === 'Miss' ? '#FF4D4D' : '#00FF88';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(message, CANVAS_WIDTH / 2, 150);
        ctx.fillText(message, CANVAS_WIDTH / 2, 150);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [arrowHits, message, isShooting]); // 상태 일부만 의존

  // 실제 발사(파워 기반)
  const fireWithPower = (power: number) => {
    if (isShooting) return;

    setIsShooting(true);

    const power01 = clamp(power, 0, 100) / 100;
    soundRef.current.playShootSound(power01);
    soundRef.current.playWhoosh(power01);

    // 파워가 높을수록 도달시간 감소 → 바람 영향 감소
    const t = 1.2 - 0.6 * power01; // 1.2s ~ 0.6s

    const { speed, dir } = windRef.current;
    const windDrift = (dir === 'right' ? 1 : -1) * speed * WIND_FACTOR * t;

    // 파워가 높을수록 떨림이 살짝 커짐(현실감)
    const jitter = 0.8 + power01 * 1.2;
    const randomX = (Math.random() - 0.5) * jitter;
    const randomY = (Math.random() - 0.5) * jitter;

    // 명중 좌표(조준 + 바람 + 미세떨림)
    const impactX = aimRef.current.x + windDrift + randomX;
    const impactY = aimRef.current.y + randomY;

    const points = calculateScore(impactX, impactY);

    setLastScore(points);
    setScore((prev) => prev + points);
    setAttempts((prev) => prev + 1);

    setArrowHits((prev) => [...prev, { x: impactX, y: impactY, score: points }].slice(-5));

    if (points === 10) {
      soundRef.current.playPerfectSound();
      createPerfectParticles(impactX, impactY);
      setMessage('Perfect!');
    } else if (points > 0) {
      soundRef.current.playHitSound(points);
      setMessage('Nice!');
    } else {
      soundRef.current.playMissSound();
      setMessage('Miss');
    }

    window.setTimeout(() => {
      setMessage(null);
      setIsShooting(false);
      generateWind();
    }, 1500);
  };

  // 스페이스 빠른 발사
  const quickShoot = (power: number) => {
    soundRef.current.ensureInit();
    soundRef.current.resumeIfNeeded();
    fireWithPower(power);
  };

  // ====== 포인터(마우스/터치) : 당기기 UX ======
  const onPointerDown = (clientX: number, clientY: number) => {
    if (isShooting) return;

    soundRef.current.ensureInit();
    soundRef.current.resumeIfNeeded();

    // 먼저 조준을 현재 포인터로 옮기고, 그 자리에서 당기기 시작
    updateAimFromPointer(clientX, clientY);

    setIsPulling(true);
    setPullPower(0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pullStartRef.current = { x: clientX - rect.left, y: clientY - rect.top };

    lastTickRef.current = 0;
    // 시작 장력 소리(약하게)
    soundRef.current.playTensionTick(0.15);
  };

  const onPointerMove = (clientX: number, clientY: number) => {
    if (isShooting) return;

    if (!isPulling) {
      // 일반 조준 이동
      updateAimFromPointer(clientX, clientY);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 당기는 동안에도 조준은 마우스로 미세 이동 가능(하지만 크게 튀지 않게 제한)
    const nx = clamp(x, TARGET_CENTER_X - MAX_AIM_OFFSET, TARGET_CENTER_X + MAX_AIM_OFFSET);
    const ny = clamp(y, TARGET_CENTER_Y - MAX_AIM_OFFSET, TARGET_CENTER_Y + MAX_AIM_OFFSET);
    setAimX(nx);
    setAimY(ny);

    const start = pullStartRef.current;
    if (!start) return;

    // "뒤로 당기는" 느낌: 시작점에서 아래/왼쪽 방향으로 당겨도 power 증가하도록 거리만 사용
    const dx = x - start.x;
    const dy = y - start.y;

    // 사용자가 화면에서 끌어당기는 건 대체로 "시작점 반대(뒤로)"로 당기므로,
    // 그냥 거리 기반 power로 처리(방향은 단순화)
    const dist = Math.hypot(dx, dy);
    const power = clamp((dist / MAX_PULL_PX) * 100, 0, 100);

    setPullPower(power);

    // 당기는 동안 장력 사운드: power가 일정 구간 넘어갈 때만 "틱"(루프 금지)
    const tickStep = 18; // 0~100에서 대략 5~6번
    const tick = Math.floor(power / tickStep);
    if (tick !== lastTickRef.current) {
      lastTickRef.current = tick;
      soundRef.current.playTensionTick(power / 100);
    }
  };

  const onPointerUp = () => {
    if (!isPulling) return;

    setIsPulling(false);

    const power = pullPower;
    setPullPower(0);
    pullStartRef.current = null;

    // 릴리즈 발사
    fireWithPower(power);
  };

  // 마우스 이벤트
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    onPointerDown(e.clientX, e.clientY);
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    onPointerMove(e.clientX, e.clientY);
  };
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    onPointerUp();
  };
  const handleMouseLeave = () => {
    // 캔버스 밖으로 나가면 당기기 해제(실수 방지)
    if (isPulling) onPointerUp();
  };

  // 터치 이벤트
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!e.touches[0]) return;
    e.preventDefault();
    onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!e.touches[0]) return;
    e.preventDefault();
    onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    onPointerUp();
  };

  const handleReset = () => {
    soundRef.current.ensureInit();
    soundRef.current.resumeIfNeeded();

    setArrowHits([]);
    setScore(0);
    setAttempts(0);
    setLastScore(0);
    setMessage(null);
    setIsShooting(false);

    setIsPulling(false);
    setPullPower(0);
    pullStartRef.current = null;

    setAimX(TARGET_CENTER_X);
    setAimY(TARGET_CENTER_Y);

    particlesRef.current = [];
    generateWind();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-block rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600"
          >
            ← 홈으로
          </Link>

          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            바람: <span className="ml-1 text-orange-600 dark:text-orange-300">{windLabel}</span>
          </div>
        </div>

        <h1 className="mb-3 text-center text-3xl font-bold text-gray-800 dark:text-gray-100">
          🏹 활쏘기 게임 (정면 시점)
        </h1>

        {/* 점수판 */}
        <div className="mb-4 flex flex-wrap justify-center gap-6 text-lg font-semibold text-gray-700 dark:text-gray-300">
          <div>
            현재 점수: <span className="text-blue-600 dark:text-blue-400">{score}</span>
          </div>
          <div>
            시도 횟수: <span className="text-purple-600 dark:text-purple-400">{attempts}</span>
          </div>
          <div>
            마지막 점수: <span className="text-green-600 dark:text-green-400">{lastScore}</span>
          </div>
        </div>

        {/* Canvas */}
        <div className="mb-4 flex justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`rounded-lg border-2 border-gray-300 dark:border-gray-600 ${
              isPulling ? 'cursor-grabbing' : 'cursor-crosshair'
            }`}
          />
        </div>

        {/* 안내 */}
        <div className="mb-4 text-center text-sm text-gray-600 dark:text-gray-400 leading-6">
          <div>
            <span className="font-semibold">조준</span>: 마우스 이동 또는 WASD/화살표 키
          </div>
          <div>
            <span className="font-semibold">발사</span>: 캔버스에서 <span className="font-semibold">클릭(터치) → 끌어당겼다가 → 놓기</span>
            <span className="ml-2 text-xs opacity-80">(스페이스바 = 빠른 발사)</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-4">
          <button
            onClick={() => quickShoot(55)}
            disabled={isShooting || isPulling}
            className="flex-1 rounded-lg bg-blue-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🏹 빠른 발사 (Space)
          </button>
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg bg-gray-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-600 active:bg-gray-700"
          >
            🔄 리셋
          </button>
        </div>
      </div>
    </div>
  );
}
