import { useId, useState, type InputHTMLAttributes } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };
export function FormInput({ label, error, hint, type = 'text', id, ...props }: Props) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return <div className="form-field"><label htmlFor={fieldId}>{label}</label><div className="input-wrap"><input {...props} id={fieldId} type={isPassword && visible ? 'text' : type} aria-invalid={!!error} aria-describedby={error || hint ? `${fieldId}-description` : undefined} className={isPassword ? 'password-input' : ''} />{isPassword && <button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}</div>{(error || hint) && <p id={`${fieldId}-description`} className={error ? 'field-error' : 'field-hint'}>{error && <AlertCircle size={14} />}{error || hint}</p>}</div>;
}
