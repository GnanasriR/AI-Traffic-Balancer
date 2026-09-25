import React from 'react';

const SvgIcon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 17 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

export const IcoGrid: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    }
  />
);

export const IcoSignal: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <rect x="8" y="2" width="8" height="16" rx="3" />
        <circle cx="12" cy="6" r="1.2" />
        <circle cx="12" cy="10" r="1.2" />
        <circle cx="12" cy="14" r="1.2" />
        <path d="M12 18v4" />
      </>
    }
  />
);

export const IcoNet: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <circle cx="5" cy="6" r="2.4" />
        <circle cx="19" cy="6" r="2.4" />
        <circle cx="12" cy="18" r="2.4" />
        <path d="M7 7l3.5 9M17 7l-3.5 9M7.4 6h9.2" />
      </>
    }
  />
);

export const IcoWave: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={<path d="M2 14c2 0 2-5 4-5s2 7 4 7 2-10 4-10 2 8 4 8 2-3 4-3" />}
  />
);

export const IcoSliders: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="7" cy="18" r="2" />
      </>
    }
  />
);

export const IcoChart: React.FC<{ size?: number }> = (p) => (
  <SvgIcon {...p} d={<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />} />
);

export const IcoAlert: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4M12 17.5v.5" />
      </>
    }
  />
);

export const IcoCog: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </>
    }
  />
);

export const IcoOut: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={<path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M9 16l-4-4 4-4M5 12h11" />}
  />
);

export const IcoCheck: React.FC<{ size?: number }> = (p) => (
  <SvgIcon {...p} d={<path d="M4 12.5l5.5 5.5L20 6" />} />
);

export const IcoCone: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <path d="M12 3l6 17H6z" />
        <path d="M8.5 13h7M3 20h18" />
      </>
    }
  />
);

export const IcoBus: React.FC<{ size?: number }> = (p) => (
  <SvgIcon
    {...p}
    d={
      <>
        <rect x="4" y="4" width="16" height="12" rx="2" />
        <path d="M4 10h16M7 20v-2M17 20v-2" />
        <circle cx="8" cy="14" r="1" />
        <circle cx="16" cy="14" r="1" />
      </>
    }
  />
);
