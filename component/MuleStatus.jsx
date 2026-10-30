// @desc LLMule status bar — live numbers from /api/muleNetwork, like the bottom bar of an old P2P client
"use client";
import React, { useState, useEffect } from 'react';

const MuleStatus = ({ jcontext }) => {
  const [net, setNet] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/muleNetwork')
      .then((r) => r.json())
      .then((d) => { if (alive) setNet(d); })
      .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const up = net && net.online && net.online.machines > 0;
  return (
    <div className="mule-status">
      <span className="grow">
        <i className="mule-dot" style={{ background: !net ? '#999' : up ? '#2fbf2f' : '#d32f2f' }} />
        {!net ? 'Connecting to llmule.xyz…' : up ? 'Connected to llmule.xyz' : 'Connected — no machines sharing right now'}
      </span>
      <span>Machines: {net ? net.online.machines : '–'}</span>
      <span>Models: {net ? net.online.models : '–'}</span>
      <span>Users: {net ? net.totals.users : '–'}</span>
      <span>Answers: {net ? net.totals.answered : '–'}</span>
    </div>
  );
};

export default MuleStatus;
