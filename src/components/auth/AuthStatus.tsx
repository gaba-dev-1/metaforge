import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/utils/auth/AuthContext';

interface AuthStatusProps {
  showProfileButton?: boolean;
}

export default function AuthStatus({ showProfileButton = true }: AuthStatusProps) {
  const { auth, logout } = useAuth();
  const { isAuthenticated, isLoading, user, error } = auth;
  
  if (isLoading) {
    return (
      <div className="h-10 w-32 bg-void-core/70 animate-pulse rounded-md"></div>
    );
  }
  
  if (error) {
    return (
      <div className="text-red-400 text-sm">
        Auth Error: {error.substring(0, 50)}
      </div>
    );
  }
  
  if (!isAuthenticated || !user) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-3">
      <div className="text-corona-light text-sm">
        <span className="hidden sm:inline-block">Logged in as </span>
        <span className="font-medium text-gold">{user.gameName}</span>
        <span className="text-corona-light/70">#{user.tagLine}</span>
      </div>
      
      {showProfileButton && (
        <Link href="/profile">
          <motion.button
            className="flex items-center justify-center bg-eclipse-shadow/30 hover:bg-eclipse-shadow/50 p-2 rounded-md text-corona-light"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <User size={16} />
            <span className="sr-only">Profile</span>
          </motion.button>
        </Link>
      )}
      
      <motion.button
        onClick={() => logout()}
        className="flex items-center justify-center bg-red-900/30 hover:bg-red-900/50 p-2 rounded-md text-red-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <LogOut size={16} />
        <span className="sr-only">Sign Out</span>
      </motion.button>
    </div>
  );
}
