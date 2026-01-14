'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

function zodiacKorean(birthYear: number) {
  // 기준: 2008년 = 쥐띠
  const animals = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  const idx = ((birthYear - 2008) % 12 + 12) % 12;
  return animals[idx];
}

function calcAges(birth: string) {
  // birth: YYYY-MM-DD
  const [y, m, d] = birth.split('-').map((v) => parseInt(v, 10));
  const now = new Date();
  const thisYear = now.getFullYear();

  // 세는나이
  const koreanAge = thisYear - y + 1;

  // 만 나이
  const birthdayThisYear = new Date(thisYear, (m ?? 1) - 1, d ?? 1);
  let manAge = thisYear - y;
  if (now < birthdayThisYear) manAge -= 1;

  return { koreanAge, manAge };
}

// 오늘 운세를 “매일 바뀌되, 새로고침해도 동일”하게 만드는 시드(생년월일 + 오늘날짜)
function seededHash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickBySeed<T>(arr: T[], seed: number) {
  return arr[seed % arr.length];
}

function todayKeyKST() {
  // 한국 기준 “오늘”
  const now = new Date();
  // KST 보정 (간단)
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = k.getUTCFullYear();
  const m = String(k.getUTCMonth() + 1).padStart(2, '0');
  const d = String(k.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildFortune(birth: string) {
  const key = `${birth}|${todayKeyKST()}`;
  const seed = seededHash(key);

  const overall = [
    '전체적으로 흐름이 안정적입니다. 급하게 결론 내리기보다 “한 번 더 확인”이 이득입니다.',
    '작은 변수가 생길 수 있습니다. 일정에 10% 여유를 두면 스트레스가 확 줄어듭니다.',
    '오늘은 집중력이 좋아지는 날입니다. 미뤄둔 정리/결제/문서 처리에 특히 유리합니다.',
    '말 한마디가 크게 작용하는 날입니다. “짧고 분명하게”가 최고의 전략입니다.',
    '기대치 조절이 핵심입니다. 과한 기대만 낮추면 결과는 오히려 좋아집니다.',
  ];

  const money = [
    '지출은 “필요/욕심”만 구분해도 방어가 됩니다. 오늘은 충동구매만 피하세요.',
    '가격 비교/견적/단가 확인에 운이 좋습니다. 협상은 오늘이 유리합니다.',
    '작은 누수가 보일 수 있어요. 구독/정기결제만 점검해도 이득.',
    '현금흐름을 우선으로 보면 안정적입니다. 큰 결정은 하루만 더 숙성해도 좋습니다.',
  ];

  const work = [
    '업무는 “하나씩 끝내기”가 속도를 냅니다. 멀티태스킹은 오히려 손해.',
    '보고/공유가 성과를 만듭니다. 오늘은 기록을 남길수록 편해집니다.',
    '우선순위가 흔들릴 수 있어요. 오전에 Top3만 정해두면 하루가 정리됩니다.',
    '협업운이 괜찮습니다. 부탁/요청은 짧게, 기대 결과를 명확히 하면 성공률↑',
  ];

  const love = [
    '상대(또는 동료)에게 “확인 질문”을 한 번 더 하면 오해가 줄어듭니다.',
    '오늘은 표현이 큰 힘이 됩니다. 고마운 말 한마디가 관계를 부드럽게 해요.',
    '컨디션이 관건입니다. 피곤하면 말이 거칠어질 수 있어 쉬어가며 대화하세요.',
    '관계는 “속도”보다 “리듬”이 중요합니다. 무리한 밀어붙임은 피하기.',
  ];

  const tip = [
    '행운 포인트: 책상/작업대 정리 5분',
    '행운 포인트: 물 한 컵 먼저 마시기',
    '행운 포인트: 오늘 할 일 3개만 적기',
    '행운 포인트: “지금 바로” 1분 행동',
    '행운 포인트: 폰 알림 1개 끄기',
  ];

  const luck = (seed % 100) + 1;

  return {
    date: todayKeyKST(),
    luck,
    overall: pickBySeed(overall, seed),
    money: pickBySeed(money, seed + 11),
    work: pickBySeed(work, seed + 23),
    love: pickBySeed(love, seed + 37),
    tip: pickBySeed(tip, seed + 51),
  };
}

// “관상”은 지금 단계에서 안전하게: 인상 키워드 + 조언(단정 금지)
function faceReadingSafe(seed: number) {
  const impressions = [
    { title: '안정형 인상', desc: '전통 해석에서는 “꾸준함/신뢰” 이미지로 읽는 경우가 많습니다.' },
    { title: '집중형 인상', desc: '전통 해석에서는 “몰입/완성도”에 강점이 있다고 해석되곤 합니다.' },
    { title: '대화형 인상', desc: '전통 해석에서는 “소통/조율”이 강점으로 읽히는 경우가 많습니다.' },
    { title: '추진형 인상', desc: '전통 해석에서는 “결단/실행”에 강점이 있다고 해석되곤 합니다.' },
    { title: '섬세형 인상', desc: '전통 해석에서는 “디테일/배려” 이미지로 읽는 경우가 많습니다.' },
  ];
  const cautions = [
    '단정적인 결론보다 “근거 확인”을 한 번 더 하면 운이 따라옵니다.',
    '오늘은 속도보다 정확도가 유리합니다.',
    '말은 짧게, 근거는 길게—이 조합이 제일 좋습니다.',
    '컨디션이 떨어지면 판단이 흔들릴 수 있어 휴식이 성과입니다.',
    '상대의 의도를 추측하기보다 질문이 해결책입니다.',
  ];

  const imp = impressions[seed % impressions.length];
  const c = cautions[(seed + 7) % cautions.length];
  return { imp, caution: c };
}

export default function FortunePage() {
  const [birth, setBirth] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!birth) return null;
    const y = parseInt(birth.split('-')[0] || '', 10);
    if (!y || y < 1900) return null;

    const ages = calcAges(birth);
    const z = zodiacKorean(y);

    const f = buildFortune(birth);
    const seed = seededHash(`${birth}|${f.date}`);
    const face = faceReadingSafe(seed);

    return { ages, z, f, face };
  }, [birth]);

  return (
    <div className="min-h-screen bg-black text-white p-4 flex justify-center">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm font-mono opacity-80 hover:opacity-100">
            ← HOME
          </Link>
          <div className="text-sm font-mono opacity-80">관상 · 띠 · 나이 · 오늘운세</div>
        </div>

        <div className="rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]">
          <div className="font-mono text-xs uppercase tracking-widest text-white/70">INPUT</div>

          <div className="mt-3">
            <label className="block text-xs font-mono text-white/70 mb-2">생년월일</label>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className="w-full rounded-xl bg-black/40 px-3 py-3 font-mono text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
            />
            <div className="mt-2 text-[11px] text-white/55 font-mono">
              * 오늘 운세는 “오늘 날짜 + 생년월일” 기준으로 생성되어, 새로고침해도 동일합니다.
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-mono text-white/70 mb-2">얼굴 사진(선택)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                setPhoto(url);
              }}
              className="w-full text-[12px] font-mono text-white/70"
            />

            {photo && (
              <div className="mt-3 rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="preview" className="w-full h-auto block" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]">
          <div className="font-mono text-xs uppercase tracking-widest text-white/70">RESULT</div>

          {!result ? (
            <div className="mt-3 font-mono text-sm text-white/60">생년월일을 입력하면 결과가 나옵니다.</div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-black/35 p-3 ring-1 ring-white/10">
                  <div className="text-[11px] font-mono text-white/60">띠</div>
                  <div className="mt-1 font-mono text-lg">{result.z}띠</div>
                </div>
                <div className="rounded-xl bg-black/35 p-3 ring-1 ring-white/10">
                  <div className="text-[11px] font-mono text-white/60">만 나이</div>
                  <div className="mt-1 font-mono text-lg">{result.ages.manAge}세</div>
                </div>
                <div className="rounded-xl bg-black/35 p-3 ring-1 ring-white/10">
                  <div className="text-[11px] font-mono text-white/60">세는나이</div>
                  <div className="mt-1 font-mono text-lg">{result.ages.koreanAge}세</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-black/35 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm">오늘 운세 ({result.f.date})</div>
                  <div className="font-mono text-sm text-emerald-300">LUCK {result.f.luck}/100</div>
                </div>

                <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-white/85">
                  <div>
                    <div className="font-mono text-[11px] text-white/55">전체</div>
                    <div>{result.f.overall}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] text-white/55">금전</div>
                    <div>{result.f.money}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] text-white/55">일/업무</div>
                    <div>{result.f.work}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] text-white/55">관계</div>
                    <div>{result.f.love}</div>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="font-mono text-[11px] text-white/55">오늘의 팁</div>
                    <div className="text-emerald-200">{result.f.tip}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-black/35 p-3 ring-1 ring-white/10">
                <div className="font-mono text-sm">관상(전통 해석 기반, 단정 금지)</div>
                <div className="mt-2">
                  <div className="font-mono text-[12px] text-emerald-200">{result.face.imp.title}</div>
                  <div className="mt-1 text-[13px] text-white/85 leading-relaxed">{result.face.imp.desc}</div>
                  <div className="mt-2 text-[13px] text-white/75 leading-relaxed">
                    <span className="font-mono text-[11px] text-white/55">오늘의 조언 </span>
                    {result.face.caution}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-[11px] font-mono text-white/55 leading-relaxed">
                * 본 기능은 전통 해석과 엔터테인먼트 목적의 참고용입니다. 개인의 성격/능력/미래를 단정하거나 예측하지 않습니다.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
