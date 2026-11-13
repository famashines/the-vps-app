export const capitalizeWords = (input: string) => input.replace(/(^|[\s-])(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
