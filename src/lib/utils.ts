import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retorna ISO string com offset de São Paulo (-03:00) explicitamente
export const getSaoPauloTimestamp = (): string => {
  const now = new Date();
  const offset = -3 * 60; // -180 minutes (UTC-3)
  const saoPauloDate = new Date(now.getTime() + offset * 60 * 1000);
  return saoPauloDate.toISOString().replace('Z', '-03:00');
};

// Formata data para exibição no fuso de São Paulo
export const formatDisplayTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...options
  });
};
