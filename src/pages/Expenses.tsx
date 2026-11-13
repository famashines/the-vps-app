import { Button, Group, Modal, NativeSelect, Table, Text, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { categoryLabel, EXPENSE_CATEGORIES, expenseTotals, monthRange, type Expense } from "../cashflow.ts";
import { Icon } from "../icons";
import { pkr, showMoney, toPaisa } from "../money.ts";
import { send, showDate, todayInPakistan } from "../school.ts";
import { getJson, plural, rs } from "./cards";
import { Reverse, type Target } from "./StudentFees";

type State = Expense[] | "loading" | "failed";

const problems: Record<string, string> = {
  spentOn: "Enter a day that is not in the future.",
  category: "Choose a category.",
  "amount.amount": "Enter an amount of at least Rs 1, in whole rupees.",
  description: "Write what the money was for, in 1 to 200 characters.",
  paidTo: "Write a name of 1 to 200 characters, or leave it empty.",
};

function RecordExpense({ opened, today, onClose, onSaved }: { opened: boolean; today: string; onClose: () => void; onSaved: (expense: Expense) => void }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setKey(crypto.randomUUID());
    setErrors({});
    setProblem(undefined);
  }, [opened]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const paisa = toPaisa(value("amount"));
    if (!paisa) return setErrors({ "amount.amount": problems["amount.amount"] });
    setSaving(true);
    setProblem(undefined);
    const answer = await send(
      "/api/fees/expenses",
      { spentOn: value("spentOn"), category: value("category"), amount: pkr(paisa), description: value("description"), ...(value("paidTo") && { paidTo: value("paidTo") }) },
      key,
    );
    setSaving(false);
    if (answer.ok) return onSaved(answer.data);
    const fields = Object.keys(answer.fields);
    if (fields.length) return setErrors(Object.fromEntries(fields.map((f) => [f, /^[A-Z]/.test(answer.fields[f]) ? answer.fields[f] : (problems[f] ?? "Check this field.")])));
    setProblem(answer.message);
  }

  const field = (name: string) => ({ error: errors[name], onChange: () => errors[name] && setErrors(({ [name]: _, ...rest }) => rest), classNames: { input: "field-input" } });

  return (
    <Modal opened={opened} onClose={onClose} title="Record expense" centered>
      <form onSubmit={submit} className="edit-form">
        {problem && (
          <Text className="problem" role="alert">
            {problem}
          </Text>
        )}
        <div className="pair">
          <TextInput name="spentOn" label="Day" type="date" defaultValue={today} max={today} required withAsterisk={false} {...field("spentOn")} />
          <NativeSelect name="category" label="Category" data={[{ value: "", label: "Choose", disabled: true }, ...EXPENSE_CATEGORIES.map(([value, label]) => ({ value, label }))]} defaultValue="" required withAsterisk={false} {...field("category")} />
        </div>
        <TextInput name="amount" label="Amount in rupees" inputMode="numeric" autoComplete="off" placeholder="18500" leftSection={<span className="rs">Rs</span>} data-autofocus required withAsterisk={false} {...field("amount.amount")} />
        <TextInput name="description" label="What for" placeholder="Electricity bill for October" maxLength={200} autoComplete="off" required withAsterisk={false} {...field("description")} />
        <TextInput name="paidTo" label="Paid to (optional)" placeholder="A person or a company" maxLength={200} autoComplete="off" {...field("paidTo")} />
        <Group gap="sm">
          <Button type="submit" loading={saving}>
            Record expense
          </Button>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

export function Expenses() {
  const today = todayInPakistan(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [state, setState] = useState<State>("loading");
  const [recording, setRecording] = useState(false);
  const [reversing, setReversing] = useState<Target>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(() => {
    const { from, to } = monthRange(month);
    return getJson(`/api/fees/expenses?from=${from}&to=${to}`).then(setState, () => setState("failed"));
  }, [month]);

  useEffect(() => {
    setState("loading");
    void load();
  }, [load]);

  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const totals = typeof state === "string" ? undefined : expenseTotals(state);

  return (
    <div className="account">
      <header className="page-head">
        <div>
          <Title order={1}>Expenses</Title>
          <Text className="lead">Money the school spends. An entry is not changed or deleted. A wrong entry is reversed with a reason.</Text>
        </div>
        <Button leftSection={<Icon name="add" size={16} />} onClick={() => setRecording(true)}>
          Record expense
        </Button>
      </header>
      {notice && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>{notice}</Text>
        </div>
      )}
      <TextInput
        type="month"
        label="Month"
        value={month}
        max={today.slice(0, 7)}
        onChange={(event) => /^\d{4}-\d{2}$/.test(event.currentTarget.value) && setMonth(event.currentTarget.value)}
        classNames={{ input: "field-input" }}
        className="month-pick"
      />
      {state === "loading" && <Text className="state-text">Loading the expenses.</Text>}
      {state === "failed" && (
        <div className="panel state">
          <Text className="state-title error" role="alert">
            The expenses did not load.
          </Text>
          <Text className="state-text">Check the connection, then reload the page.</Text>
          <Button variant="default" mt="md" onClick={() => location.reload()}>
            Reload page
          </Button>
        </div>
      )}
      {typeof state !== "string" && totals && (
        <div className="years">
          <section className="figures" aria-label={`Totals ${monthLabel}`}>
            <div className="figure">
              <Text className="figure-label">Spent in {monthLabel}</Text>
              <Text className="figure-value">{rs(totals.total)}</Text>
              <Text className="figure-note">{plural(state.filter((e) => !e.reversal).length, "expense", "expenses")}</Text>
            </div>
            {totals.byCategory.slice(0, 3).map((c) => (
              <div className="figure" key={c.category}>
                <Text className="figure-label">{categoryLabel(c.category)}</Text>
                <Text className="figure-value">{rs(c.amount)}</Text>
                <Text className="figure-note">{Math.round((c.amount / totals.total) * 100)}% of the month</Text>
              </div>
            ))}
          </section>
          <section className="panel panel-flush" aria-labelledby="expenses-title">
            <Title order={2} className="panel-title ledger-title" id="expenses-title">
              Expenses of {monthLabel}
            </Title>
            {state.length === 0 ? (
              <Text className="state-text ledger-empty">No expense is recorded for {monthLabel}.</Text>
            ) : (
              <Table.ScrollContainer minWidth={640} type="native">
                <Table className="ruled ledger" withRowBorders={false}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Day</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>What for</Table.Th>
                      <Table.Th className="money">Amount</Table.Th>
                      <Table.Th className="row-action">
                        <VisuallyHidden>Actions</VisuallyHidden>
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {state.map((e) => (
                      <Table.Tr key={e.expenseId} className={e.reversal ? "is-reversed" : undefined}>
                        <Table.Td>{showDate(e.spentOn)}</Table.Td>
                        <Table.Td>{categoryLabel(e.category)}</Table.Td>
                        <Table.Td className="ledger-entry">
                          {e.description}
                          {e.paidTo && <span className="entry-note">Paid to {e.paidTo}</span>}
                          {e.reversal && <span className="entry-note">Reversed: {e.reversal.reason}</span>}
                        </Table.Td>
                        <Table.Td className="money">
                          <span className="amount">{showMoney(e.amount)}</span>
                        </Table.Td>
                        <Table.Td className="row-action">
                          {!e.reversal && (
                            <Button variant="subtle" color="red" size="compact-sm" aria-label={`Reverse ${e.description}`} onClick={() => setReversing({ kind: "expense", id: e.expenseId, label: `${e.description}, ${showMoney(e.amount)}` })}>
                              Reverse
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </section>
        </div>
      )}
      <RecordExpense
        opened={recording}
        today={today}
        onClose={() => setRecording(false)}
        onSaved={(expense) => {
          setRecording(false);
          setNotice(`Recorded ${showMoney(expense.amount)} for ${expense.description}.`);
          if (expense.spentOn.slice(0, 7) === month) void load();
          else setMonth(expense.spentOn.slice(0, 7));
        }}
      />
      <Reverse
        target={reversing}
        onClose={() => setReversing(undefined)}
        onDone={() => {
          setNotice(`Reversed: ${reversing?.label}.`);
          setReversing(undefined);
          void load();
        }}
      />
    </div>
  );
}
