import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'light' | 'text';
const classes = (variant: Variant, className = '') => `button button-${variant} ${className}`;
export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={classes(variant, className)} {...props} />;
}
export function ButtonLink({ variant = 'primary', className, children, ...props }: LinkProps & { variant?: Variant; children: ReactNode }) {
  return <Link className={classes(variant, className)} {...props}>{children}</Link>;
}
