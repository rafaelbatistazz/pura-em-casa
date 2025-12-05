import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retorna ISO string com COMPENSAÇÃO de +3h.
// O banco está deslocando -3h ao salvar. Compensamos somando +3h antes.
// Sincronizado com a lógica que funcionou no N8N.
export const getSaoPauloTimestamp = (): string => {
  const now = new Date();
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
