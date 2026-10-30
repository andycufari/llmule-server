// @desc LLMule window chrome: title bar + big-button toolbar (P2P clients, circa 2003) + the shared styles
"use client";
import React, { useState, useEffect } from 'react';
import { Globe, MessageSquare, KeyRound, Share2, BookOpen, Home, Plug, LogOut } from 'lucide-react';

export const MULE_CSS = `
body { background: #3a6ea5 !important; }
.mule-desktop { min-height: 100vh; padding: 16px 12px 24px; background: #3a6ea5;
  font-family: Tahoma, Verdana, "Segoe UI", sans-serif; font-size: 13px; color: #000; }
.mule-win { max-width: 1060px; margin: 0 auto; background: #d4d0c8;
  border: 2px solid; border-color: #fff #404040 #404040 #fff; box-shadow: 1px 1px 0 #000, 6px 6px 0 rgba(0,0,0,.25); }
.mule-title { display: flex; align-items: center; justify-content: space-between; padding: 3px 4px 3px 6px;
  background: linear-gradient(90deg, #0a246a, #3a6ea5 60%, #a6caf0); color: #fff; font-weight: bold; font-size: 12px; }
.mule-title .t { display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mule-title .caps { display: flex; gap: 2px; }
.mule-title .caps span { width: 16px; height: 14px; background: #d4d0c8; color: #000; font-size: 10px; line-height: 12px;
  text-align: center; border: 1px solid; border-color: #fff #404040 #404040 #fff; font-family: Tahoma, sans-serif; }
.mule-toolbar { display: flex; gap: 2px; padding: 4px; border-bottom: 1px solid #808080; box-shadow: 0 1px 0 #fff;
  overflow-x: auto; }
.mule-tool { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 64px; padding: 5px 6px 4px;
  border: 1px solid transparent; color: #000 !important; text-decoration: none !important; font-size: 11px; cursor: pointer; background: none; }
.mule-tool:hover { border-color: #fff #808080 #808080 #fff; }
.mule-tool.on { border-color: #808080 #fff #fff #808080; background: #e6e3dc; }
.mule-tool svg { width: 26px; height: 26px; }
.mule-tool.right { margin-left: auto; }
.mule-tool .who { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mule-body { padding: 10px; }
.mule-body ul { list-style: disc; } .mule-body li { margin: 3px 0; }
.mule-status { display: flex; gap: 2px; padding: 2px; border-top: 1px solid #fff; font-size: 11px; flex-wrap: wrap; }
.mule-status > span { padding: 2px 8px; border: 1px solid; border-color: #808080 #fff #fff #808080; white-space: nowrap; }
.mule-status .grow { flex: 1; }
.mule-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
.mule-box { border: 1px solid #808080; box-shadow: inset 1px 1px 0 #fff, 1px 1px 0 #fff; padding: 14px 12px 10px;
  margin: 14px 0 6px; position: relative; }
.mule-box > .legend { position: absolute; top: -9px; left: 8px; padding: 0 4px; background: #d4d0c8; font-weight: bold; }
.mule-white { background: #fff; border: 2px solid; border-color: #808080 #fff #fff #808080; padding: 12px; }
.mule-list { width: 100%; border-collapse: collapse; background: #fff; font-size: 12px; }
.mule-list th { text-align: left; font-weight: normal; padding: 2px 6px; background: #d4d0c8;
  border: 1px solid; border-color: #fff #808080 #808080 #fff; white-space: nowrap; }
.mule-list td { padding: 3px 6px; border-bottom: 1px dotted #e0e0e0; vertical-align: top; }
.mule-list tr:hover td { background: #316ac5; color: #fff; }
.mule-listwrap { border: 2px solid; border-color: #808080 #fff #fff #808080; overflow-x: auto; }
.mule-btn { display: inline-flex; align-items: center; gap: 6px; padding: 4px 14px; background: #d4d0c8; color: #000 !important;
  border: 2px solid; border-color: #fff #404040 #404040 #fff; font: inherit; cursor: pointer; text-decoration: none !important; }
.mule-btn:active { border-color: #404040 #fff #fff #404040; }
.mule-btn.primary { font-weight: bold; outline: 1px solid #000; outline-offset: -4px; }
.mule-btn:disabled { color: #808080 !important; cursor: default; }
.mule-input { font: inherit; padding: 3px 5px; background: #fff; border: 2px solid; border-color: #808080 #fff #fff #808080; color: #000; }
.mule-code { display: block; background: #000; color: #c0c0c0; font-family: "Lucida Console", "Courier New", monospace;
  font-size: 12px; padding: 10px 12px; white-space: pre; overflow-x: auto; border: 2px solid; border-color: #808080 #fff #fff #808080; }
.mule-code .c { color: #6a9955; }
.mule-code .y { color: #ffd75f; }
.mule-h1 { font-family: Verdana, Tahoma, sans-serif; font-size: 26px; font-weight: bold; color: #0a246a; margin: 0 0 6px; letter-spacing: -0.5px; }
.mule-h2 { font-family: Verdana, Tahoma, sans-serif; font-size: 16px; font-weight: bold; color: #0a246a; margin: 18px 0 6px; }
.mule-p { margin: 6px 0; line-height: 1.5; }
.mule-muted { color: #505050; }
.mule-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mule-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mule-grid2 > *, .mule-grid3 > * { min-width: 0; }
@media (max-width: 760px) { .mule-grid2, .mule-grid3 { grid-template-columns: 1fr; } .mule-h1 { font-size: 21px; } }
.mule-tag { display: inline-block; padding: 0 5px; background: #ffffe1; border: 1px solid #000; font-size: 11px; }
.mule-blink { animation: muleblink 1.2s steps(2, start) infinite; }
@keyframes muleblink { to { visibility: hidden; } }
.mule-a { color: #0000ee !important; text-decoration: underline !important; }
`;

const TOOLS = [
  { href: '/', label: 'Home', Icon: Home, color: '#2e7d32' },
  { href: '/#network', label: 'Network', Icon: Globe, color: '#1565c0' },
  { href: '/chat', label: 'Chat', Icon: MessageSquare, color: '#6a1b9a' },
  { href: '/dashboard', label: 'My Key', Icon: KeyRound, color: '#b8860b' },
  { href: '/docs#share', label: 'Share GPU', Icon: Share2, color: '#c62828' },
  { href: '/docs', label: 'Docs', Icon: BookOpen, color: '#37474f' },
];

const MuleChrome = ({ jcontext }) => {
  const [path, setPath] = useState('');
  const [user, setUser] = useState((jcontext && jcontext.user) || null);
  useEffect(() => {
    setPath(window.location.pathname);
    setUser(app.auth.user || null);
  }, []);

  const disconnect = async () => {
    await app.auth.signOut();
    window.location.reload();
  };

  return (
    <>
      <style>{MULE_CSS}</style>
      <div className="mule-title">
        <span className="t">
          <img src="https://cm64-ss-public.s3.amazonaws.com/67608172a31516c083602958/llmule-head-64.png" width="18" height="18" alt="" aria-hidden="true" style={{ display: 'block' }} />
          LLMule v2 — the underground P2P network of LLMs
        </span>
        <span className="caps" aria-hidden="true"><span>_</span><span>□</span><span>×</span></span>
      </div>
      <nav className="mule-toolbar">
        {TOOLS.map(({ href, label, Icon, color }) => (
          <a key={label} href={href} className={'mule-tool' + (href === path ? ' on' : '')}>
            <Icon color={color} strokeWidth={1.75} />
            {label}
          </a>
        ))}
        {user ? (
          <button className="mule-tool right" onClick={disconnect} title={'Connected as ' + (user.email || '')}>
            <LogOut color="#c62828" strokeWidth={1.75} />
            <span className="who">Disconnect</span>
          </button>
        ) : (
          <button className="mule-tool right" onClick={() => app.events.emit('mule:connect')}>
            <Plug color="#2e7d32" strokeWidth={1.75} />
            Connect
          </button>
        )}
      </nav>
    </>
  );
};

export default MuleChrome;
