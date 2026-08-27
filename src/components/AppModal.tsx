"use client";

import { CheckCircle, AlertTriangle, Info, Mail, X } from "lucide-react";

export interface ModalState {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: "info" | "success" | "warning" | "email";
  onConfirm?: () => void;
  confirmText?: string;
  showCancel?: boolean;
}

interface AppModalProps {
  modal: ModalState;
  onClose: () => void;
}

export default function AppModal({ modal, onClose }: AppModalProps) {
  if (!modal.isOpen) return null;

  const getIcon = () => {
    switch (modal.type) {
      case "success":
        return <CheckCircle className="w-8 h-8 text-[var(--color-success)]" />;
      case "warning":
        return <AlertTriangle className="w-8 h-8 text-[var(--color-warning)]" />;
      case "email":
        return <Mail className="w-8 h-8 text-[var(--color-secondary)]" />;
      default:
        return <Info className="w-8 h-8 text-[var(--color-primary)]" />;
    }
  };

  const getBadgeColor = () => {
    switch (modal.type) {
      case "success":
        return "bg-[var(--color-success)]/15 border-[var(--color-success)]/30 text-[var(--color-success)]";
      case "warning":
        return "bg-[var(--color-warning)]/15 border-[var(--color-warning)]/30 text-[var(--color-warning)]";
      case "email":
        return "bg-[var(--color-secondary)]/15 border-[var(--color-secondary)]/30 text-[var(--color-secondary)]";
      default:
        return "bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30 text-[var(--color-secondary)]";
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-[var(--color-bg-card)] to-[#0c1428] border border-[var(--color-primary)]/40 rounded-3xl p-6 shadow-2xl shadow-black/80 space-y-5 animate-in zoom-in-95 duration-200 cursor-default"
      >
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          <div className={`p-3.5 rounded-2xl border ${getBadgeColor()} shadow-lg`}>
            {getIcon()}
          </div>

          <h3 className="text-xl font-[family-name:var(--font-heading)] text-white tracking-wide">
            {modal.title || "Dance Factory CRM"}
          </h3>
        </div>

        {/* Message Content */}
        <div className="text-xs text-[var(--color-text-body)] leading-relaxed text-center whitespace-pre-line bg-black/25 p-4 rounded-2xl border border-white/5 max-h-72 overflow-y-auto font-sans">
          {modal.message}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          {modal.showCancel && (
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-[var(--color-text-secondary)] bg-[var(--color-bg)] border border-[var(--color-border)] hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
          )}

          <button
            onClick={() => {
              if (modal.onConfirm) modal.onConfirm();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-[var(--color-primary)]/30 active:scale-95"
          >
            {modal.confirmText || "Entendido"}
          </button>
        </div>

      </div>
    </div>
  );
}
