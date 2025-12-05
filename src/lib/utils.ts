import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Gera timestamp ISO com offset explícito de São Paulo (UTC-3)
// Independente do fuso horário da máquina do usuário
// Retorna ISO string com offset -03:00 fixo (ex: 2024-12-05T15:00:00-03:00)
// Garante o horário de SP independente do browser
export const getSaoPauloTimestamp = (): string => {
  const now = new Date();

  // 'sv-SE' é útil pois retorna sempre YYYY-MM-DD HH:mm:ss
  const spTime = now.toLocaleString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // sv-SE retorna "2024-12-05 15:45:00" ou similar. 
  // O replace garante formato ISO T
  const isoLike = spTime.replace(' ', 'T');

  // Adiciona o offset de SP (-03:00)
  return `${isoLike}-03:00`;
};

// Formata data para exibição no fuso de São Paulo
export const formatDisplayTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...options
  });
};
