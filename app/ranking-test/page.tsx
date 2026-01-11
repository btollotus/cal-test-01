'use client';

import { useState } from 'react';

export default function RankingTestPage() {
  const [log, setLog] = useState<string>('ready');

  const post = async () => {
    setLog('posting...');
    const res = await fetch('/api/ranking?game=galaga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'AAA', score: 1234 }),
    });
    const json = await res.json();
    setLog(JSON.stringify(json, null, 2));
  };

  const get = async () => {
    setLog('loading...');
    const res = await fetch('/api/ranking?game=galaga');
    const json = await res.json();
    setLog(JSON.stringify(json, null, 2));
  };

  return (
    <div style={{ padding: 20, color: '#fff', background: '#000', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1>Ranking API Test</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={post} style={{ padding: '10px 12px' }}>POST (AAA, 1234)</button>
        <button onClick={get} style={{ padding: '10px 12px' }}>GET</button>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#111', padding: 12, borderRadius: 8 }}>{log}</pre>
    </div>
  );
}
