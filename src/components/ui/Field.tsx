"use client";
import { forwardRef, useId } from "react";

/**
 * The shared form-field layer: Input, Select, Textarea and Checkbox.
 * Each one renders its own label tied to the control with htmlFor/id
 * (the hand-built fields it replaces had a bare <label> beside the
 * input, which a screen reader cannot associate), an optional hint, and
 * an error that is announced when it appears (role="alert") and linked
 * to the control through aria-describedby and aria-invalid.
 *
 * The control itself sets an explicit themed surface and text color.
 * The old hand-built fields set neither and kept the browser's white
 * box in dark mode, which is why globals.css forces black text on bare
 * inputs. A class on the element wins over that element-selector rule.
 */
interface FieldChrome {
  label: string;
  hint?: string;
  error?: string | null;
  /** Wrapper classes, e.g. to span grid columns. */
  wrapperClassName?: string;
}

const CONTROL =
  "mt-1 block w-full rounded-lg border bg-brand-surface px-3 py-2.5 text-sm text-brand-ink outline-none transition-colors placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60";
const CONTROL_OK = "border-brand-gray focus:border-brand-teal";
const CONTROL_BAD = "border-brand-rose focus:border-brand-rose";

function describedBy(id: string, hint?: string, error?: string | null) {
  const ids = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function Shell({
  id,
  label,
  hint,
  error,
  required,
  wrapperClassName,
  children,
}: FieldChrome & { id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="text-sm font-semibold text-brand-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-brand-rose">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-brand-rose">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = FieldChrome & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, wrapperClassName, id: idProp, required, ...rest },
  ref
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL} ${error ? CONTROL_BAD : CONTROL_OK}`}
        {...rest}
      />
    </Shell>
  );
});

type SelectProps = FieldChrome & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, wrapperClassName, id: idProp, required, children, ...rest },
  ref
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL} ${error ? CONTROL_BAD : CONTROL_OK}`}
        {...rest}
      >
        {children}
      </select>
    </Shell>
  );
});

type TextareaProps = FieldChrome & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, id: idProp, required, ...rest },
  ref
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} wrapperClassName={wrapperClassName}>
      <textarea
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL} ${error ? CONTROL_BAD : CONTROL_OK}`}
        {...rest}
      />
    </Shell>
  );
});

type CheckboxProps = { label: React.ReactNode; hint?: string; wrapperClassName?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className" | "type"
>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, wrapperClassName, id: idProp, ...rest },
  ref
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-brand-ink">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-teal"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="ml-6 mt-0.5 text-xs text-gray-600">
          {hint}
        </p>
      )}
    </div>
  );
});
