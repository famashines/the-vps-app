export type Money = { amount: number; currency: "PKR" };

const format = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 });

export const showMoney = (money: Money) => `Rs ${format.format(Math.abs(money.amount) / 100)}`;

export function toPaisa(text: string) {
  const digits = text.replace(/^\s*rs\.?\s*/i, "").replace(/[,\s]/g, "");
  return /^\d{1,9}$/.test(digits) ? Number(digits) * 100 : undefined;
}

export const pkr = (paisa: number): Money => ({ amount: paisa, currency: "PKR" });
