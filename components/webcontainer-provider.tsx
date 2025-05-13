'use client';

import { useEffect, useState } from 'react';
import { getWebContainer } from '@/lib/webcontainer/provider';

export default function WebContainerProvider({ children }: { children?: React.ReactNode }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;
    
    setStatus('loading');
    
    // Initialize WebContainer
    getWebContainer()
      .then(() => {
        console.log('WebContainer initialized successfully');
        setStatus('ready');
      })
      .catch((error) => {
        console.error('Failed to initialize WebContainer:', error);
        setStatus('error');
      });
  }, []);

  // Return the children (or null if none provided)
  return children || null;
}