import React, { ReactNode } from 'react';
import Link from 'next/link';
import { FeatureCardProps } from '@/types';

interface FeatureBannerProps {
  title: string;
  children?: ReactNode;
}

export function FeatureBanner({ title, children }: FeatureBannerProps) {
  return (
    <div className="feature-banner">
      <div className="flex justify-center items-center">
        <div className="flex items-center">
          <span className="text-lg text-cream/90 ml-4 mt-1">{title}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export function FeatureCard({ title, icon, description, linkTo }: FeatureCardProps) {
  return (
    <Link href={linkTo}>
      <div className="feature-card group">
        <div className="relative p-3 flex flex-col h-full items-center text-center">
          <div className="flex justify-center">
            <div className="feature-hex-container">
              <svg 
                className="feature-hex-svg" 
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon 
                  points="50,0 100,25 100,75 50,100 0,75 0,25"
                  fill="hsla(27, 69.90%, 14.30%, 0.94)"
                  stroke="rgba(182, 141, 64, 0.7)" 
                  strokeWidth="3" 
                  className="transition-all group-hover:stroke-gold"
                />
              </svg>
              
              <div className="feature-hex-content">
                {icon}
                <div className="feature-hex-glow">{icon}</div>
              </div>
            </div>
          </div>
          <h3 className="text-lg text-gold mb-1">{title}</h3>
          <div className="text-xs text-cream/70 mt-auto group-hover:text-cream/90">{description}</div>
        </div>
      </div>
    </Link>
  );
}

interface FeatureCardsContainerProps {
  children: ReactNode;
}

export function FeatureCardsContainer({ children }: FeatureCardsContainerProps) {
  return (
    <div className="feature-cards-container">
      {children}
    </div>
  );
}
