import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retorna ISO string padrão (UTC). 
// Como o banco é TIMESTAMPTZ, ele aceita UTC (Z) e converte corretamente.
// Ex: 2024-12-05T20:00:00.000Z (que é 17:00 em SP)
export const getSaoPauloTimestamp = (): string => {
  return new Date().toISOString();
};

// Formata data para exibição no fuso de São Paulo
export const formatDisplayTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...options
  });
};
