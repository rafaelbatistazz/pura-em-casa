// Utility function to normalize phone numbers
// Converts any phone format to: 5571999999999 (country code + DDD + number)

export function normalizePhone(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If empty, return as is
    if (!cleaned) return phone;

    // Handle Brazilian numbers
    if (cleaned.startsWith('55')) {
        // Already has country code
        const withoutCountry = cleaned.substring(2);

        // Check if has DDD (2 digits) + number (8 or 9 digits)
        if (withoutCountry.length === 10 || withoutCountry.length === 11) {
            const ddd = withoutCountry.substring(0, 2);
            let number = withoutCountry.substring(2);

            // Add 9 if mobile number with 8 digits
            if (number.length === 8 && /^[6-9]/.test(number)) {
                number = '9' + number;
            }

            return '55' + ddd + number;
        }

        return cleaned;
    }

    // If starts with 0 (common in Brazil), remove it
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // Brazilian number without country code
    if (cleaned.length === 10 || cleaned.length === 11) {
        const ddd = cleaned.substring(0, 2);
        let number = cleaned.substring(2);

        // Add 9 if mobile with 8 digits
        if (number.length === 8 && /^[6-9]/.test(number)) {
            number = '9' + number;
        }

        return '55' + ddd + number;
    }

    // International number - keep as is if has 10+ digits
    if (cleaned.length >= 10) {
        return cleaned;
    }

    // Invalid format - return original
    return phone;
}

// Example usage:
// normalizePhone("71 99289-4634") → "5571992894634"
// normalizePhone("(71) 99289-4634") → "5571992894634"
// normalizePhone("71992894634") → "5571992894634"
// normalizePhone("5571992894634") → "5571992894634"
// normalizePhone("+55 71 99289-4634") → "5571992894634"
// normalizePhone("1234567890") → "1234567890" (international)
