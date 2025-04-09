import React from 'react';

interface LoadingStateProps {
  fullScreen?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingState({ 
  fullScreen = false, 
  message, 
  size = 'md' 
}: LoadingStateProps) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className="flex flex-col items-center">
          <div className={`loading-spinner ${sizes[size]}`} />
          {message && <p className="mt-3 text-cream/80">{message}</p>}
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex justify-center items-center py-6">
      <div className="flex flex-col items-center">
        <div className={`loading-spinner ${sizes[size]}`} />
        {message && <p className="mt-3 text-cream/80">{message}</p>}
      </div>
    </div>
  );
}
