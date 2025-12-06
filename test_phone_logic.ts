
import { normalizePhone } from './src/lib/phoneUtils';

const testCases = [
    '7192894634',
    '71992894634',
    '557192894634',
    '5571992894634',
    '(71) 9289-4634'
];

console.log('--- Testing Phone Normalization ---');
testCases.forEach(phone => {
    const normalized = normalizePhone(phone);
    console.log(`Input: "${phone}" -> Output: "${normalized}"`);
});
