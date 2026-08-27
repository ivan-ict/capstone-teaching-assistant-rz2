import React from 'react';
import { GraduationCap, Sparkles } from 'lucide-react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSparkle?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({ 
  size = 'md', 
  className = '',
  showSparkle = false 
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-8 h-8 rounded-xl',
    lg: 'w-10 h-10 rounded-2xl',
    xl: 'w-14 h-14 rounded-3xl shadow-lg shadow-blue-500/25',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4.5 h-4.5',
    lg: 'w-5 h-5',
    xl: 'w-7 h-7',
  };

  const sparkleSizes = {
    sm: 'w-2 h-2 -top-0.5 -right-0.5',
    md: 'w-2.5 h-2.5 -top-1 -right-1',
    lg: 'w-3 h-3 -top-1 -right-1',
    xl: 'w-4 h-4 -top-1.5 -right-1.5',
  };

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 bg-gradient-to-tr from-blue-600 via-blue-600 to-indigo-600 text-white shadow-xs select-none transition-transform ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      <GraduationCap className={`${iconSizes[size]} text-white stroke-[2.2]`} />
      
      {showSparkle && (
        <span className={`absolute ${sparkleSizes[size]} bg-amber-400 text-amber-950 rounded-full p-0.5 shadow-xs ring-2 ring-white dark:ring-slate-900 flex items-center justify-center`}>
          <Sparkles className="w-full h-full fill-current" />
        </span>
      )}
    </div>
  );
};
