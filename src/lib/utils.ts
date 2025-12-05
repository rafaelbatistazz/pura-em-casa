import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retorna string exata no formato ISO com offset DE SÃO PAULO.
// Ex: "2024-12-05T19:30:00.000-03:00"
// Isso elimina ambiguidade do 'Z' e garante que o banco (TIMESTAMPTZ) entenda o offset.
export const getSaoPauloTimestamp = (): string => {
  const now = new Date();

  // Obtém os componentes visuais da hora de SP
  const spString = now.toLocaleString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    hour12: false
  });
  // spString é "2024-12-05 19:30:00"

  const isoLike = spString.replace(' ', 'T');
  return `${isoLike}.000-03:00`;
};

// Formata data para exibição no fuso de São Paulo
export const formatDisplayTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...options
  });
};
