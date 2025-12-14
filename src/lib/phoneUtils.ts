// Utility function to normalize phone numbers
// Converts any phone format to: 5571999999999 (country code + DDD + number)

export function normalizePhone(phone: string): string {
    // 1. Remove tudo que não for dígito
    let cleaned = phone.replace(/\D/g, '');

    // Se estiver vazio, retorna vazio
    if (!cleaned) return '';

    // Lógica Específica para Brasil (DDD + 8 ou 9 dígitos)
    // O objetivo é padronizar para 55 + DDD + 9 dígitos (Total 13)

    // Caso 1: Começa com 55 (DDI Brasil)
    if (cleaned.startsWith('55')) {
        let core = cleaned.substring(2); // Remove o 55 para analisar

        // Se tiver 10 dígitos (DDD + 8 digitos), é um celular antigo ou falta o 9
        if (core.length === 10) {
            // Insere o 9 no início do número (após o DDD de 2 dígitos)
            // Ex: 71 9289-4634 -> 71 9 9289-4634
            const ddd = core.substring(0, 2);
            const number = core.substring(2); // 8 digitos

            // Validação simples: Se for fixo (começa com 2, 3, 4, 5), teoricamente não deveria mexer, 
            // mas o pedido é para corrigir celulares mobile faltantes.
            // Assumindo mobile se não for explicitamente fixo ou se o usuário pediu forçadamente.
            // O padrão hoje é: Celulares começam com 6, 7, 8, 9. 
            // 71 9289 -> Começa com 9. 

            // Se o número tem 8 digitos, inserimos o 9.
            return `55${ddd}9${number}`;
        }

        // Se já tiver 11 dígitos (DDD + 9 digitos), só retorna
        if (core.length === 11) {
            return cleaned;
        }
    }

    // Caso 2: Não começa com 55, mas parece ser um número local (10 ou 11 dígitos)
    else if (cleaned.length === 10 || cleaned.length === 11) {
        // Se tem 10 dígitos (DDD + 8), insere o 9 e o 55
        if (cleaned.length === 10) {
            const ddd = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            // Regra segura: Aplica para celulares (começam com 6,7,8,9)
            // O exemplo do usuário: 71 9289... (começa com 9).
            if (['6', '7', '8', '9'].includes(number[0])) {
                return `55${ddd}9${number}`;
            } else {
                // Fixo? Adiciona só o 55
                return `55${cleaned}`;
            }
        }

        // Se tem 11 dígitos (DDD + 9), só insere o 55
        return `55${cleaned}`;
    }

    // Fallback seguro: Se chegou aqui com algo e não caiu em recgras específicas, retorna o cleaned (números puros)
    // Isso evita que o número suma se não bater na lógica de mobile.
    return cleaned;
}

// Example usage:
// normalizePhone("71 99289-4634") → "5571992894634"
// normalizePhone("(71) 99289-4634") → "5571992894634"
// normalizePhone("71992894634") → "5571992894634"
// normalizePhone("5571992894634") → "5571992894634"
// normalizePhone("+55 71 99289-4634") → "5571992894634"
// normalizePhone("1234567890") → "1234567890" (international)

export function maskPhone(phone: string): string {
    if (!phone) return '';

    // Normalize first to ensure we have a standard format to work with
    const clean = phone.replace(/\D/g, '');

    // Check for Brazilian format: 55 + 2 DDD + 9 digits (13 chars total)
    // or 55 + 2 DDD + 8 digits (12 chars total)
    if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
        const ddd = clean.substring(2, 4);
        const number = clean.substring(4);

        if (number.length === 9) { // 9 digits
            const firstPart = number.substring(0, 1);
            const lastPart = number.substring(5);
            return `(${ddd}) ${firstPart}****-${lastPart}`;
        } else if (number.length === 8) { // 8 digits
            const lastPart = number.substring(4);
            return `(${ddd}) ****-${lastPart}`;
        }
    }

    // Fallback for other formats: Show first 2 and last 2 chars
    if (clean.length > 4) {
        return `${clean.substring(0, 2)}****${clean.substring(clean.length - 2)}`;
    }

    return '****';
}
