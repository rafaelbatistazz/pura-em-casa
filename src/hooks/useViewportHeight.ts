import { useEffect } from 'react';

export function useViewportHeight() {
  useEffect(() => {
    const setViewportHeight = () => {
      // Calcula altura REAL da janela visível
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    // Executa imediatamente
    setViewportHeight();

    // Recalcula em resize, orientação, e quando teclado abre/fecha
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    
    // Para iOS Safari - detecta quando endereço bar aparece/desaparece
    window.visualViewport?.addEventListener('resize', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      window.visualViewport?.removeEventListener('resize', setViewportHeight);
    };
  }, []);
}
