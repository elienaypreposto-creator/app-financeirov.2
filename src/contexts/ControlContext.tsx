"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

type ViewMode = 'pf' | 'pj';

interface ControlContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  controleTipo: string | null;
  setControleTipo: (tipo: string) => void;
  isLoading: boolean;
}

const ControlContext = createContext<ControlContextType | undefined>(undefined);

export function ControlProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('pj');
  const [controleTipo, setControleTipo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('controle_tipo').eq('id', user.id).single();
        if (data) {
          setControleTipo(data.controle_tipo);
          // Default view mode based on profile
          if (data.controle_tipo === 'pf') setViewMode('pf');
          else setViewMode('pj');
        }
      }
      setIsLoading(false);
    }
    fetchProfile();
  }, []);

  return (
    <ControlContext.Provider value={{ viewMode, setViewMode, controleTipo, setControleTipo, isLoading }}>
      {children}
    </ControlContext.Provider>
  );
}

export function useControl() {
  const context = useContext(ControlContext);
  if (context === undefined) {
    throw new Error('useControl must be used within a ControlProvider');
  }
  return context;
}
