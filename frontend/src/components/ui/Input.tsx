import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

interface FieldWrapProps {
  label?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FieldWrap({ label, error, required, children }: FieldWrapProps) {
  return (
    <div className="mb-3">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", required, ...props }: InputProps) {
  return (
    <FieldWrap label={label} error={error} required={required}>
      <input
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${error ? "border-red-400" : "border-gray-300"} ${className}`}
        {...props}
      />
    </FieldWrap>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = "", required, children, ...props }: SelectProps) {
  return (
    <FieldWrap label={label} error={error} required={required}>
      <select
        className={`w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 ${error ? "border-red-400" : "border-gray-300"} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldWrap>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, className = "", ...props }: TextAreaProps) {
  return (
    <FieldWrap label={label} error={error}>
      <textarea
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${error ? "border-red-400" : "border-gray-300"} ${className}`}
        {...props}
      />
    </FieldWrap>
  );
}
