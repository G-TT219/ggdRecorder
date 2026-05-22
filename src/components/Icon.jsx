function Icon({ name, size = 18, strokeWidth = 2, className = '' }) {
  const common = {
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

  const icons = {
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
  };

  return icons[name] || null;
}

export default Icon;
