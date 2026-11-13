export const toLocal = (phone: string) => (/^\+92\d{10}$/.test(phone) ? `0${phone.slice(3, 6)} ${phone.slice(6)}` : phone);

export function phoneAsTyped(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^(00)?92(?=3)/, "0").slice(0, 11);
  return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
}

export const isMobile = (phone: string) => /^03\d{9}$/.test(phone.replace(/\s/g, ""));

export const toE164 = (phone: string) => (isMobile(phone) ? `+92${phone.replace(/\s/g, "").slice(1)}` : phone.replace(/\s/g, ""));
