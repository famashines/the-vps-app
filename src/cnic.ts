export function toCnic(input: string) {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{13}$/.test(digits) ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` : input.trim();
}

export function cnicAsTyped(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  return [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12)].filter(Boolean).join("-");
}
