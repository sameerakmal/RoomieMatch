import type { ChangeEvent, ReactNode } from 'react';
import { AlertCircle, Check, ShieldAlert } from 'lucide-react';

interface ChoiceOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

interface ChoiceGroupProps<T extends string = string> {
  id: string;
  label: string;
  name: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  columns?: 1 | 2 | 3;
}

export function ChoiceGroup<T extends string = string>({
  id,
  label,
  name,
  value,
  options,
  onChange,
  error,
  hint,
  required = true,
  columns = 2,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset className="form-field pref-choice-fieldset" aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="pref-legend">
        <span>{label}</span>
        {required && <span className="pref-required-mark" aria-hidden="true">*</span>}
      </legend>
      <div className={`pref-choice-grid pref-choice-grid-${columns}`} role="radiogroup" aria-labelledby={id}>
        {options.map(option => {
          const isSelected = value === option.value;
          const optionId = `${id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={`pref-choice-card ${isSelected ? 'pref-choice-card-selected' : ''}`}
            >
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="pref-radio-input"
              />
              <div className="pref-choice-indicator">
                <span className={`pref-radio-circle ${isSelected ? 'pref-radio-circle-selected' : ''}`}>
                  {isSelected && <span className="pref-radio-dot" />}
                </span>
              </div>
              <div className="pref-choice-content">
                <span className="pref-choice-title">{option.label}</span>
                {option.hint && <span className="pref-choice-subtext">{option.hint}</span>}
              </div>
            </label>
          );
        })}
      </div>
      {(error || hint) && (
        <p id={error ? `${id}-error` : `${id}-hint`} className={error ? 'field-error' : 'field-hint'}>
          {error && <AlertCircle size={14} />}
          {error || hint}
        </p>
      )}
    </fieldset>
  );
}

interface ImportanceToggleProps {
  label: string;
  value: 'preferred' | 'required';
  onChange: (value: 'preferred' | 'required') => void;
  hint?: string;
}

export function ImportanceToggle({ label, value, onChange, hint }: ImportanceToggleProps) {
  const isRequired = value === 'required';
  return (
    <div className="pref-importance-box">
      <div className="pref-importance-info">
        <span className="pref-importance-label">{label}</span>
        {hint && <span className="pref-importance-hint">{hint}</span>}
      </div>
      <div className="pref-importance-toggle-wrap">
        <button
          type="button"
          onClick={() => onChange('preferred')}
          className={`pref-importance-pill ${!isRequired ? 'pref-importance-pill-active' : ''}`}
          aria-pressed={!isRequired}
        >
          {!isRequired && <Check size={12} />} Preferred
        </button>
        <button
          type="button"
          onClick={() => onChange('required')}
          className={`pref-importance-pill pref-importance-pill-req ${isRequired ? 'pref-importance-pill-req-active' : ''}`}
          aria-pressed={isRequired}
        >
          {isRequired && <ShieldAlert size={12} />} Strict requirement
        </button>
      </div>
    </div>
  );
}

interface TimeSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function TimeSelect({ id, label, value, onChange, error, hint, required = true }: TimeSelectProps) {
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="pref-required-mark" aria-hidden="true">*</span>}
      </label>
      <input
        type="time"
        id={id}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="pref-time-input"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {(error || hint) && (
        <p id={error ? `${id}-error` : `${id}-hint`} className={error ? 'field-error' : 'field-hint'}>
          {error && <AlertCircle size={14} />}
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function PrefSectionCard({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="pref-section-card">
      <div className="pref-section-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {badge && <div>{badge}</div>}
      </div>
      <div className="pref-section-card-body">{children}</div>
    </div>
  );
}

