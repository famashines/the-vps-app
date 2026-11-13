import type { Money } from "./money.ts";
import { todayInPakistan } from "./school.ts";

export type Reversal = { reversedAt: string; reason: string };
export type Charge = { chargeId: string; kind: "admission" | "annual" | "monthly"; month?: string; amount: Money; dueOn: string; reversal?: Reversal };
export type Payment = { paymentId: string; receiptNumber: string; amount: Money; method: "cash"; receivedAt: string; receivedBy: string; reversal?: Reversal };
export type AccountSummary = {
  accountId: string;
  studentId: string;
  academicYearId: string;
  academicYearName: string;
  classId: string;
  grade: string;
  openedOn: string;
  charged: Money;
  paid: Money;
  balance: Money;
  overdue?: Money;
};
export type Account = AccountSummary & { charges: Charge[]; payments: Payment[] };
export type Schedule = { academicYearId: string; grade: string; monthlyFee: Money; admissionFee?: Money; annualFee?: Money };

const monthName = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

export const chargeLabel = (c: Charge) => (c.kind === "monthly" ? `Monthly fee, ${monthName(c.month!)}` : c.kind === "admission" ? "Admission fee" : "Annual fee");

export type Line = { date: string; balance: number } & ({ charge: Charge; payment?: undefined } | { payment: Payment; charge?: undefined });

export function ledger(account: Pick<Account, "charges" | "payments">): Line[] {
  const lines: Line[] = [
    ...account.charges.map((charge): Line => ({ date: charge.dueOn, charge, balance: 0 })),
    ...account.payments.map((payment): Line => ({ date: todayInPakistan(new Date(payment.receivedAt)), payment, balance: 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.charge ? 0 : 1) - (b.charge ? 0 : 1));
  let balance = 0;
  for (const line of lines) {
    const entry = line.charge ?? line.payment!;
    if (!entry.reversal) balance += line.charge ? entry.amount.amount : -entry.amount.amount;
    line.balance = balance;
  }
  return lines;
}
