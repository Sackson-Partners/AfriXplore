'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles = {
  primary: 'bg-brand-primary hover:bg-brand-hover text-white shadow-md',
  secondary: 'border border-geo-steel bg-transparent hover:bg-geo-graphite text-geo-cloud',
  ghost: 'bg-transparent hover:bg-geo-graphite text-geo-cloud',
  danger: 'bg-signal-critical/20 hover:bg-signal-critical/30 text-signal-critical border border-signal-critical/30',
  success: 'bg-signal-low/20 hover:bg-signal-low/30 text-signal-low border border-signal-low/30',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        font-medium rounded-lg
        transition-all duration-150
        active:scale-[0.97]
        disabled:opacity-40 disabled:pointer-events-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
