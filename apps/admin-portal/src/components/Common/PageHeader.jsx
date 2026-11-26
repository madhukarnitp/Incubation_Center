'use client';

import React from 'react';
import Button from '@/components/ui/Button';

export default function PageHeader({
  icon: Icon = null,
  title,
  description,
  actionText,
  actionIcon: ActionIcon = null,
  onAction,
  actions,
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3.5 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-[#1E40AF] shrink-0" />}
          <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight leading-snug sm:leading-tight">
            {title}
          </h1>
        </div>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>

      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end shrink-0">
        {actions}
        {actionText && onAction && (
          ActionIcon ? (
            <button
              type="button"
              onClick={onAction}
              aria-label={actionText}
              className="group relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#1E40AF] text-white hover:bg-[#1E3A8A] shadow-xs transition-colors cursor-pointer"
            >
              <ActionIcon className="w-4 h-4" />
              <span className="pointer-events-none absolute -bottom-8 right-0 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 z-20">
                {actionText}
              </span>
            </button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onAction}
              className="w-full sm:w-auto"
            >
              {actionText}
            </Button>
          )
        )}
        {children}
      </div>
    </div>
  );
}
