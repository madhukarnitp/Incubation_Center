'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from '@/components/icons';
import Button from './Button';

const MODAL_THEMES = {
  danger: {
    cardBorder: 'border-rose-200',
    headerText: 'text-rose-700',
    iconWrap: 'bg-rose-50 text-rose-600 border-rose-100',
    buttonVariant: 'danger',
    Icon: AlertCircle,
  },
  primary: {
    cardBorder: 'border-blue-200',
    headerText: 'text-[#1E40AF]',
    iconWrap: 'bg-blue-50 text-[#1E40AF] border-blue-100',
    buttonVariant: 'primary',
    Icon: Info,
  },
  success: {
    cardBorder: 'border-emerald-200',
    headerText: 'text-emerald-700',
    iconWrap: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    buttonVariant: 'emerald',
    Icon: CheckCircle2,
  },
  emerald: {
    cardBorder: 'border-emerald-200',
    headerText: 'text-emerald-700',
    iconWrap: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    buttonVariant: 'emerald',
    Icon: CheckCircle2,
  },
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Delete',
  variant,
  confirmVariant = 'danger',
  isLoading = false,
}) {
  if (!isOpen) return null;

  const resolvedVariant = variant || confirmVariant || 'danger';
  const theme = MODAL_THEMES[resolvedVariant] || MODAL_THEMES.danger;
  const IconComponent = theme.Icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm rounded-xl bg-white border ${theme.cardBorder} p-5 shadow-xl space-y-4 animate-in zoom-in-95 font-sans`}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className={`flex items-center gap-2.5 font-bold text-sm ${theme.headerText}`}>
            <span
              className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${theme.iconWrap}`}
            >
              <IconComponent className="w-4 h-4" />
            </span>
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={theme.buttonVariant}
            size="sm"
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
