"use client";

import { useEffect, useMemo, useState } from "react";

function getSid() {
  const key = "sid";
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(key, sid);
  }
  return sid;
}

export default function OnlineStats() {
  const sid = useMemo(() => (typeof window !== "undefined" ? getSid() : ""), []);
  const [visitsToday, setVisitsToday] = useState(0);
  const [activeNow, setActiveNow] = useState(0);

  useEffect(() => {
    if (!sid) return;

    const track = async () => {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
      });
    };

    const loadStats = async () => {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setVisitsToday(data.visitsToday ?? 0);
      setActiveNow(data.activeNow ?? 0);
    };

    // 처음: 카운트 + 표시
    track().then(loadStats);

    // 30초마다 내 접속 갱신(현재 접속 유지)
    const heartbeat = setInterval(track, 30_000);

    // 10초마다 숫자 갱신
    const poll = setInterval(loadStats, 10_000);

    return () => {
      clearInterval(heartbeat);
      clearInterval(poll);
    };
  }, [sid]);

  return (
    <div className="mt-2 flex gap-3 text-sm text-gray-600 dark:text-gray-300">
      <span>오늘 접속: <b>{visitsToday}</b></span>
      <span>현재 접속: <b>{activeNow}</b></span>
    </div>
  );
}
