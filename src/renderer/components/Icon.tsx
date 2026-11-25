import type { ReactElement, SVGProps } from 'react';

export type IconName =
  | 'refresh'
  | 'star'
  | 'starFilled'
  | 'play'
  | 'record'
  | 'film'
  | 'image'
  | 'trash'
  | 'x'
  | 'warning'
  | 'globe'
  | 'clipboard'
  | 'chart'
  | 'trophy'
  | 'check'
  | 'ghost'
  | 'skip'
  | 'vote'
  | 'gamepad'
  | 'arrowRight'
  | 'settings'
  | 'search'
  | 'sidebar'
  | 'sparkles'
  | 'map'
  | 'pause'
  | 'stop'
  | 'keyboard'
  | 'info'
  | 'rocket'
  | 'sun'
  | 'moon'
  | 'minimize'
  | 'maximize'
  | 'folder'
  | 'clock'
  | 'split';

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

function Icon({ name, size = 18, strokeWidth = 2, className = '' }: IconProps): ReactElement | null {
  const common: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `app-icon ${className}`.trim(),
    'aria-hidden': true,
  };

  const icons: Record<IconName, ReactElement> = {
    refresh: (
      <svg {...common}><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" /></svg>
    ),
    star: (
      <svg {...common}><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88L12 3Z" /></svg>
    ),
    starFilled: (
      <svg {...common} fill="currentColor"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88L12 3Z" /></svg>
    ),
    play: (
      <svg {...common} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5-11-6.5Z" /></svg>
    ),
    record: (
      <svg {...common}><rect x="4" y="5" width="16" height="14" rx="3" /><circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none" /></svg>
    ),
    film: (
      <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M8 5v14M16 5v14M4 9h4M12 9h4M4 15h4M12 15h4" /></svg>
    ),
    image: (
      <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" /><path d="m5.5 17 4.2-4 2.7 2.5 2.2-2 3.9 3.5" /></svg>
    ),
    trash: (
      <svg {...common}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></svg>
    ),
    x: (
      <svg {...common}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
    ),
    warning: (
      <svg {...common}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5" /><path d="M12 17h.01" /></svg>
    ),
    globe: (
      <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a13 13 0 0 1 0 18" /><path d="M12 3a13 13 0 0 0 0 18" /></svg>
    ),
    clipboard: (
      <svg {...common}><path d="M9 4h6" /><path d="M10 2h4v4h-4z" /><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /></svg>
    ),
    chart: (
      <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-8" /></svg>
    ),
    trophy: (
      <svg {...common}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></svg>
    ),
    check: (
      <svg {...common}><path d="m5 12 4 4L19 6" /></svg>
    ),
    ghost: (
      <svg {...common}><path d="M5 21V10a7 7 0 0 1 14 0v11l-3-2-2 2-2-2-2 2-2-2-3 2Z" /><path d="M9 10h.01" /><path d="M15 10h.01" /></svg>
    ),
    skip: (
      <svg {...common}><path d="M5 5v14l8-7-8-7Z" /><path d="M13 5v14l8-7-8-7Z" /></svg>
    ),
    vote: (
      <svg {...common}><path d="M4 10h16" /><path d="M6 10l3-6h6l3 6" /><path d="M5 10v10h14V10" /><path d="m9 15 2 2 4-4" /></svg>
    ),
    gamepad: (
      <svg {...common}><path d="M6 14h4" /><path d="M8 12v4" /><path d="M15 13h.01" /><path d="M18 15h.01" /><path d="M7 9h10a5 5 0 0 1 4.7 6.7l-.7 2A2 2 0 0 1 17.3 18l-2-2H8.7l-2 2A2 2 0 0 1 3 17.7l-.7-2A5 5 0 0 1 7 9Z" /></svg>
    ),
    arrowRight: (
      <svg {...common}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
    ),
    settings: (
      <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
    ),
    search: (
      <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    ),
    sidebar: (
      <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></svg>
    ),
    sparkles: (
      <svg {...common}><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></svg>
    ),
    map: (
      <svg {...common}><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14" /><path d="M15 6v14" /></svg>
    ),
    pause: (
      <svg {...common} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
    ),
    stop: (
      <svg {...common} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2.2" /></svg>
    ),
    keyboard: (
      <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M17 10h.01M8 14h8" /></svg>
    ),
    info: (
      <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
    ),
    rocket: (
      <svg {...common}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>
    ),
    sun: (
      <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
    ),
    moon: (
      <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
    ),
    minimize: (
      <svg {...common}><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
    ),
    maximize: (
      <svg {...common}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
    ),
    folder: (
      <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
    ),
    clock: (
      <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    ),
    split: (
      <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M12 4v16" /></svg>
    ),
  };

  return icons[name] || null;
}

export default Icon;
