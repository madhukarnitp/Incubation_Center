'use client';

import React from 'react';

const TONE_CLASSES = {
  default:
    'border-[#E2E8F0] bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-[#1E40AF]',
  primary:
    'border-[#1E40AF] bg-[#1E40AF] text-white hover:bg-[#1E3A8A] shadow-xs',
  danger: 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
  warning: 'border-amber-200 bg-white text-amber-600 hover:bg-amber-50',
  success: 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50',
};

const SIZE_CLASSES = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
};

export default function TableActionButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  size = 'sm',
  tooltipSide = 'top',
  disabled = false,
  iconClassName = '',
  className = '',
}) {
  const tooltipPos = tooltipSide === 'bottom' ? '-bottom-8' : '-top-8';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`group/action relative inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_CLASSES[size] || SIZE_CLASSES.sm} ${TONE_CLASSES[tone] || TONE_CLASSES.default} ${className}`}
    >
      {Icon && <Icon className={`w-4 h-4 ${iconClassName}`} />}
      <span
        className={`pointer-events-none absolute ${tooltipPos} left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover/action:opacity-100 group-focus-visible/action:opacity-100 z-30`}
      >
        {label}
      </span>
    </button>
  );
}
