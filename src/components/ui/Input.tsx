import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Etiketi görsel olarak gizle (ekran okuyucu için kalır). */
  hideLabel?: boolean;
}

/**
 * Etiketli metin alanı. 16 px yazı: iOS odaklanınca yakınlaştırmasın.
 * Yükseklik 44 px+ (dokunma hedefi).
 */
export const Input: React.FC<InputProps> = ({ label, hint, error, hideLabel = false, className = '', id, ...props }) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'block text-sm font-medium text-ink-soft'}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 w-full rounded-xl border bg-surface px-3.5 text-base text-ink placeholder:text-muted outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand ${
          error ? 'border-danger' : 'border-line'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
};
