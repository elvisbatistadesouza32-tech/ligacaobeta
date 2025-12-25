
import React from 'react';

export const Logo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-sm">
    <circle cx="50" cy="50" r="45" fill="#f8fafc" />
    <path d="M20 50C20 33.4315 33.4315 20 50 20C66.5685 20 80 33.4315 80 50" stroke="#1e1b4b" stroke-width="8" stroke-linecap="round" />
    <rect x="15" y="45" width="10" height="20" rx="4" fill="#1e1b4b" />
    <rect x="75" y="45" width="10" height="20" rx="4" fill="#1e1b4b" />
    <path d="M48 40L38 45V65L48 60V40Z" fill="#0369a1" />
    <path d="M52 40L62 45V65L52 60V40Z" fill="#dc2626" />
    <path d="M20 60C20 60 25 85 50 85" stroke="#1e1b4b" stroke-width="4" stroke-linecap="round" />
    <circle cx="50" cy="85" r="4" fill="#1e1b4b" />
  </svg>
);
