import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retorna ISO string com COMPENSAÇÃO de +3h.
// O sistema/banco está subtraindo 3h ao salvar (tratando UTC como Local ou vice-versa).
// Então enviamos Time + 3h para que, ao subtrair, ele caia no horário real.
export const getSaoPauloTimestamp = (): string => {
  const now = new Date();
  // Adiciona 3 horas (3 * 60min * 60s * 1000ms)
  const compensatedTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  return compensatedTime.toISOString();
};

// Formata data para exibição no fuso de São Paulo
export const formatDisplayTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...options
  });
};
