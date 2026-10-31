export const toLocal = (phone: string) => (/^\+92\d{10}$/.test(phone) ? `0${phone.slice(3, 6)} ${phone.slice(6)}` : phone);

export function toE164(phone: string) {
  const digits = phone.replace(/[\s\-().]/g, "");
  if (/^03\d{9}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^92\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0092\d{10}$/.test(digits)) return `+${digits.slice(2)}`;
  return digits;
}
