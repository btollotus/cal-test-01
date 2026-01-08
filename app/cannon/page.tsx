'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Cannonball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Target {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const GROUND_Y = CANVAS_HEIGHT - 50;
const CHARIOT_X = 50;
const CHARIOT_Y = GROUND_Y - 15;
const GRAVITY = 0.5;
const PARTICLE_LIFETIME = 1200; // 1.2초 (ms)

// Web Audio API 헬퍼
class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  // AudioContext 초기화 (내부에서만)
  private init() {
    if (this.initialized && this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.audioContext.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext 초기화 실패:', e);
    }
  }

  // 외부에서 호출하는 “안전한 초기화” 메서드 (✅ public)
  public ensureInit() {
    this.init();
  }

  // AudioContext 재개 (브라우저 자동재생 제한 대응)
  private resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // 발사음: 퉁/펑
  playLaunchSound() {
    this.init();
    this.resume();
    if (!this.audioContext || !this.masterGain) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }

  // 비행음: 슈우웅 (0.3~0.5초)
  playWhooshSound() {
    this.init();
    this.resume();
    if (!this.audioContext || !this.masterGain) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.4);

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.4);
  }

  // 명중음: 팝팝팝 + 폭죽 느낌
  playHitSound() {
    this.init();
    this.resume();
    if (!this.audioContext || !this.masterGain) return;

    const times = [0, 0.05, 0.1, 0.15, 0.2, 0.25];

    times.forEach((delay) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.type = 'square';
      const baseFreq = 300 + Math.random() * 200;
      oscillator.frequency.setValueAtTime(baseFreq, this.audioContext!.currentTime + delay);
      oscillator.frequency.exponentialRampToValueAtTime(
        baseFreq * 0.5,
        this.audioContext!.currentTime + delay + 0.1
      );

      gainNode.gain.setValueAtTime(0.25, this.audioContext!.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + delay + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      oscillator.start(this.audioContext!.currentTime + delay);
      oscillator.stop(this.audioContext!.currentTime + delay + 0.1);
    });
  }
}

export default function CannonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const soundManagerRef = useRef(new SoundManager());
  const particlesRef = useRef<Particle[]>([]);
  const hitTimeRef = useRef<number | null>(null);

  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);
  const [cannonball, setCannonball] = useState<Cannonball | null>(null);
  const [target, setTarget] = useState<Target>(() => ({
    x: CANVAS_WIDTH - 150,
    y: GROUND_Y - 80,
    width: 60,
    height: 60,
  }));
  const [gameState, setGameState] = useState<'idle' | 'flying' | 'hit' | 'miss'>('idle');

  // 초기 목표물 위치 랜덤 생성
  useEffect(() => {
    const randomY = Math.random() * (GROUND_Y - 200) + 100;
    setTarget({
      x: CANVAS_WIDTH - 150,
      y: randomY,
      width: 60,
      height: 60,
    });
  }, []);

  // 로마 전차 그리기
  const drawChariot = (ctx: CanvasRenderingContext2D) => {
    const x = CHARIOT_X;
    const y = CHARIOT_Y;

    // 바퀴 2개
    ctx.fillStyle = '#8B4513';
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;

    // 왼쪽 바퀴
    ctx.beginPath();
    ctx.arc(x - 15, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 12);
    ctx.lineTo(x - 15, y + 12);
    ctx.moveTo(x - 27, y);
    ctx.lineTo(x - 3, y);
    ctx.stroke();

    // 오른쪽 바퀴
    ctx.beginPath();
    ctx.arc(x + 15, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 15, y - 12);
    ctx.lineTo(x + 15, y + 12);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 27, y);
    ctx.stroke();

    // 차체
    ctx.fillStyle = '#D2691E';
    ctx.fillRect(x - 20, y - 25, 40, 20);
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 20, y - 25, 40, 20);

    // 금속 장식
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(x - 18, y - 23, 8, 3);
    ctx.fillRect(x + 10, y - 23, 8, 3);

    // 발리스타 프레임
    ctx.save();
    ctx.translate(x, y - 25);
    ctx.rotate((angle * Math.PI) / 180);

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-3, -15, 6, 30);
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(-3, -15, 6, 30);

    // 줄 느낌
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(8, -10);
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(-8, 10);
    ctx.lineTo(8, 10);
    ctx.stroke();

    ctx.fillStyle = '#654321';
    ctx.fillRect(-2, -20, 4, 8);

    ctx.restore();
  };

  // 폭죽 파티클 생성
  const createParticles = (x: number, y: number) => {
    const colors = ['#FF0000', '#FFAA00', '#FFFF00', '#00FF00', '#0000FF', '#FF00FF', '#FF1493', '#00FFFF'];
    const particles: Particle[] = [];

    for (let i = 0; i < 40; i++) {
      const a = (Math.PI * 2 * i) / 40 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        size: 3 + Math.random() * 4,
        life: PARTICLE_LIFETIME,
      });
    }

    particlesRef.current = particles;
    hitTimeRef.current = Date.now();
  };

  const updateParticles = () => {
    const now = Date.now();
    if (!hitTimeRef.current || particlesRef.current.length === 0) return;

    const elapsed = now - hitTimeRef.current;
    if (elapsed > PARTICLE_LIFETIME) {
      particlesRef.current = [];
      hitTimeRef.current = null;
      return;
    }

    particlesRef.current = particlesRef.current
      .map((p) => {
        const newX = p.x + p.vx;
        const newY = p.y + p.vy;
        const newVy = p.vy + GRAVITY * 0.3;
        const newAlpha = 1 - elapsed / PARTICLE_LIFETIME;

        return {
          ...p,
          x: newX,
          y: newY,
          vy: newVy,
          alpha: Math.max(0, newAlpha),
        };
      })
      .filter((p) => p.alpha > 0);
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  // Canvas 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      if (particlesRef.current.length > 0) updateParticles();

      // 배경
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 바닥
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
      ctx.fillStyle = '#228B22';
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 10);

      drawChariot(ctx);

      // 목표물
      if (gameState !== 'hit') {
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(target.x, target.y, target.width, target.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(target.x, target.y, target.width, target.height);
      }

      // 명중 플래시
      if (gameState === 'hit' && particlesRef.current.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(target.x + target.width / 2, target.y + target.height / 2, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      drawParticles(ctx);

      if (cannonball) {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cannonball.x, cannonball.y, cannonball.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (gameState === 'hit') {
        ctx.fillStyle = '#00FF00';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('HIT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      } else if (gameState === 'miss') {
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MISS!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      }

      if (
        particlesRef.current.length > 0 ||
        gameState === 'flying' ||
        (gameState === 'hit' && particlesRef.current.length > 0)
      ) {
        animationId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [angle, cannonball, target, gameState]);

  // 포탄 애니메이션
  useEffect(() => {
    if (gameState !== 'flying' || !cannonball) return;

    const animate = () => {
      setCannonball((prev) => {
        if (!prev) return null;

        const newX = prev.x + prev.vx;
        const newY = prev.y + prev.vy;
        const newVy = prev.vy + GRAVITY;

        if (newY + prev.radius >= GROUND_Y) {
          setGameState('miss');
          return null;
        }

        const closestX = Math.max(target.x, Math.min(newX, target.x + target.width));
        const closestY = Math.max(target.y, Math.min(newY, target.y + target.height));
        const dx = newX - closestX;
        const dy = newY - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < prev.radius) {
          createParticles(target.x + target.width / 2, target.y + target.height / 2);
          soundManagerRef.current.playHitSound();
          setGameState('hit');
          return null;
        }

        if (newX < 0 || newX > CANVAS_WIDTH || newY < 0) {
          setGameState('miss');
          return null;
        }

        return { ...prev, x: newX, y: newY, vy: newVy };
      });

      if (gameState === 'flying') {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, cannonball, target]);

  const handleShoot = () => {
    if (gameState === 'flying') return;

    soundManagerRef.current.playLaunchSound();
    soundManagerRef.current.playWhooshSound();

    const angleRad = (angle * Math.PI) / 180;
    const vx = Math.cos(angleRad) * power * 0.5;
    const vy = -Math.sin(angleRad) * power * 0.5;

    setCannonball({
      x: CHARIOT_X + Math.cos(angleRad) * 30,
      y: CHARIOT_Y - 25 - Math.sin(angleRad) * 30,
      vx,
      vy,
      radius: 8,
    });
    setGameState('flying');
  };

  const handleReset = () => {
    // ✅ init() 직접 호출 금지 → ensureInit()
    soundManagerRef.current.ensureInit();

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    setCannonball(null);
    setGameState('idle');
    setAngle(45);
    setPower(50);
    particlesRef.current = [];
    hitTimeRef.current = null;

    const randomY = Math.random() * (GROUND_Y - 200) + 100;
    setTarget({
      x: CANVAS_WIDTH - 150,
      y: randomY,
      width: 60,
      height: 60,
    });
  };

  const handleSliderChange = () => {
    // ✅ 슬라이더 조작 시에도 ensureInit()
    soundManagerRef.current.ensureInit();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-block rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600"
          >
            ← 홈으로
          </Link>
        </div>

        <h1 className="mb-6 text-center text-3xl font-bold text-gray-800 dark:text-gray-100">
          🎯 포쏘기 게임
        </h1>

        <div className="mb-6 flex justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="rounded-lg border-2 border-gray-300 dark:border-gray-600"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              각도: {angle}°
            </label>
            <input
              type="range"
              min="10"
              max="80"
              value={angle}
              onChange={(e) => {
                setAngle(Number(e.target.value));
                handleSliderChange();
              }}
              disabled={gameState === 'flying'}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              힘: {power}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={power}
              onChange={(e) => {
                setPower(Number(e.target.value));
                handleSliderChange();
              }}
              disabled={gameState === 'flying'}
              className="w-full"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleShoot}
              disabled={gameState === 'flying'}
              className="flex-1 rounded-lg bg-blue-500 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🚀 발사
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
    </div>
  );
}
