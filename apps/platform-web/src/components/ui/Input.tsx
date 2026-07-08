'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export function Input({ label, icon, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-geo-cloud mb-1.5 tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-geo-mist pointer-events-none">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`
            w-full h-11 rounded-lg border border-geo-steel bg-geo-graphite
            text-geo-cloud placeholder-geo-mist text-sm
            px-3 ${icon ? 'pl-9' : ''}
            outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30
            transition-colors duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            ${className}
          `}
        />
      </div>
    </div>
  );
}
