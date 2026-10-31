import { Button, Group, Modal, Table, Text, Textarea, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router";
import { chargeLabel, ledger, type Account, type AccountSummary, type Payment } from "../fees.ts";
import { Icon } from "../icons";
import { pkr, showMoney, toPaisa } from "../money.ts";
import { gradeLabel, send, showDate, todayInPakistan } from "../school.ts";
import { signInUrl, type User } from "../session";
import type { Student } from "./Students";

type State = { status: "loading" } | { status: "failed" } | { status: "missing" } | { status: "loaded"; student: Student; account?: Account };

async function getJson(path: string) {
  const response = await fetch(path);
  if (response.status === 401) location.assign(signInUrl());
  if (!response.ok) throw new Error(path);
  return response.json();
}

const classOf = (student: Student, account: Account) => {
  const e = student.enrollments.find((x) => x.academicYearId === account.academicYearId);
  return `${gradeLabel(e?.grade ?? account.grade)}, ${account.academicYearName}`;
};

export function balanceText(balance: number) {
  if (balance > 0) return `${showMoney(pkr(balance))} owed`;
  if (balance < 0) return `${showMoney(pkr(balance))} credit`;
  return "Paid up";
}

function Slip({ payment, student, account, user }: { payment: Payment; student: Student; account: Account; user: User }) {
  return (
    <article className="receipt" aria-label={`Receipt ${payment.receiptNumber}`}>
      <header className="receipt-head">
        <div>
          <p className="receipt-school">The Vision Public School</p>
          <p className="receipt-kind">Fee receipt, cash</p>
        </div>
        <p className="receipt-number">{payment.receiptNumber}</p>
      </header>
      <dl className="receipt-lines">
        <dt>Date</dt>
        <dd>{showDate(todayInPakistan(new Date(payment.receivedAt)))}</dd>
        <dt>Student</dt>
        <dd>
          {student.firstName} {student.lastName}, {student.admissionNumber}
        </dd>
        <dt>Father name</dt>
        <dd>{student.fatherName}</dd>
        <dt>Class</dt>
        <dd>{classOf(student, account)}</dd>
      </dl>
      <p className="receipt-amount">
        <span>Amount received</span>
        <strong>{showMoney(payment.amount)}</strong>
      </p>
      {payment.reversal && <p className="receipt-reversed">Reversed: {payment.reversal.reason}</p>}
      <footer className="receipt-foot">
        <p>Received by {payment.receivedBy === user.sub ? user.name : "the school office"}</p>
        <p className="receipt-sign">Signature and stamp</p>
      </footer>
    </article>
  );
}

function Receipt({ payment, student, account, user, onClose }: { payment?: Payment; student: Student; account: Account; user: User; onClose: () => void }) {
  return (
    <Modal opened={!!payment} onClose={onClose} title="Receipt" centered radius="md" size="lg">
      {payment && (
        <>
          <Slip payment={payment} student={student} account={account} user={user} />
          {createPortal(
            <div className="print-receipt">
              <Slip payment={payment} student={student} account={account} user={user} />
            </div>,
            document.body,
          )}
          <Group gap="sm" mt="lg">
            <Button leftSection={<Icon name="print" size={16} />} onClick={() => window.print()}>
              Print receipt
            </Button>
            <Button variant="default" onClick={onClose}>
              Close
            </Button>
          </Group>
        </>
      )}
    </Modal>
  );
}

function TakePayment({ account, opened, onClose, onPaid }: { account: Account; opened: boolean; onClose: () => void; onPaid: (paymentId: string) => void }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setKey(crypto.randomUUID());
    setProblem(undefined);
  }, [opened]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const paisa = toPaisa(String(new FormData(event.currentTarget).get("amount")));
    if (!paisa) return setProblem("Enter an amount of at least Rs 1, in whole rupees.");
    setSaving(true);
    const answer = await send("/api/fees/payments", { accountId: account.accountId, amount: pkr(paisa), method: "cash" }, key);
    setSaving(false);
    if (!answer.ok) return setProblem(Object.keys(answer.fields).length ? "Enter an amount of at least Rs 1, in whole rupees." : answer.message);
    onPaid(answer.data.paymentId);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Take payment" centered radius="md">
      <form onSubmit={submit} className="edit-form">
        <TextInput
          name="amount"
          label="Amount in rupees"
          description={`Cash. Balance: ${balanceText(account.balance.amount)}.`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="4500"
          leftSection={<span className="rs">Rs</span>}
          error={problem}
          data-autofocus
          classNames={{ input: "field-input" }}
          required
          withAsterisk={false}
        />
        <Group gap="sm">
          <Button type="submit" loading={saving}>
            Take payment
          </Button>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

type Target = { kind: "charge" | "payment"; id: string; label: string };

function Reverse({ target, onClose, onDone }: { target?: Target; onClose: () => void; onDone: () => void }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState(target);

  useEffect(() => {
    if (!target) return;
    setShown(target);
    setKey(crypto.randomUUID());
    setProblem(undefined);
  }, [target]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason")).trim();
    if (!shown || !reason) return setProblem("Write why the entry is reversed.");
    setSaving(true);
    const answer = await send(`/api/fees/${shown.kind === "charge" ? "charges" : "payments"}/${shown.id}/reversal`, { reason }, key);
    setSaving(false);
    if (!answer.ok) return setProblem(answer.fields.reason ? "Write a reason of 1 to 500 characters." : answer.message);
    onDone();
  }

  return (
    <Modal opened={!!target} onClose={onClose} title={shown && `Reverse ${shown.kind}`} centered radius="md">
      <form onSubmit={submit} className="edit-form">
        <Text className="panel-text">
          {shown?.label}. The full amount is reversed. The entry stays in the ledger with the reason{shown?.kind === "payment" ? ", and its receipt number is not used again" : ""}.
        </Text>
        <Textarea name="reason" label="Reason" maxLength={500} autosize minRows={2} data-autofocus error={problem} classNames={{ input: "field-input" }} required withAsterisk={false} />
        <Group gap="sm">
          <Button type="submit" color="red" loading={saving}>
            Reverse {shown?.kind}
          </Button>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

export function StudentFees({ user }: { user: User }) {
  const { studentId } = useParams();
  const [state, setState] = useState<State>({ status: "loading" });
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<Payment>();
  const [reversing, setReversing] = useState<Target>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [students, accounts]: [Student[], AccountSummary[]] = await Promise.all([getJson("/api/students"), getJson("/api/fees/accounts")]);
      const student = students.find((s) => s.studentId === studentId);
      if (!student) return setState({ status: "missing" });
      const summary = accounts.find((a) => a.studentId === studentId);
      const account: Account | undefined = summary && (await getJson(`/api/fees/accounts/${summary.accountId}`));
      setState({ status: "loaded", student, account });
      return account;
    } catch {
      setState({ status: "failed" });
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") return <Text className="state-text">Loading the fee account.</Text>;
  if (state.status !== "loaded")
    return (
      <div className="panel state">
        <Text className="state-title error" role="alert">
          {state.status === "missing" ? "This student does not exist." : "The fee account did not load."}
        </Text>
        <Text className="state-text">{state.status === "missing" ? "Find the student in the list." : "Check the connection, then reload the page."}</Text>
        <Button component={Link} to="/students" variant="default" mt="md">
          Back to students
        </Button>
      </div>
    );

  const { student, account } = state;
  const enrollment = student.enrollments[0];
  const lines = account ? ledger(account) : [];

  return (
    <div className="account">
      <header className="page-head">
        <div>
          <Title order={1}>
            {student.firstName} {student.lastName}
          </Title>
          <Text className="lead">
            <span className="adm-mark">{student.admissionNumber}</span>
            {enrollment ? `${gradeLabel(enrollment.grade)}, ${enrollment.academicYearName}` : "Not in a class yet"}
          </Text>
        </div>
        {account && (
          <Button leftSection={<Icon name="add" size={16} />} onClick={() => setPaying(true)}>
            Take payment
          </Button>
        )}
      </header>
      {notice && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>{notice}</Text>
        </div>
      )}
      {!account ? (
        <div className="panel state">
          <Text className="state-title">No fee account yet.</Text>
          <Text className="state-text">The account opens when the student is enrolled in a class. Then the fees of the grade are charged.</Text>
          <Button component={Link} to="/students" variant="default" mt="md">
            Back to students
          </Button>
        </div>
      ) : (
        <>
          <section className="panel balance" aria-label="Balance">
            <p className={`balance-figure${account.balance.amount < 0 ? " is-credit" : ""}`}>{balanceText(account.balance.amount)}</p>
            <p className="balance-parts">
              Charged {showMoney(account.charged)}, paid {showMoney(account.paid)}, for {account.academicYearName}.
            </p>
          </section>
          <section className="panel panel-flush" aria-labelledby="ledger-title">
            <Title order={2} className="panel-title ledger-title" id="ledger-title">
              Ledger
            </Title>
            {lines.length === 0 ? (
              <Text className="state-text ledger-empty">
                No charges yet. Set the fees of {gradeLabel(account.grade)} on the <Link to="/fees">Fees</Link> page.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={640} type="native">
                <Table className="ruled ledger" withRowBorders={false}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Entry</Table.Th>
                      <Table.Th className="money">Charge</Table.Th>
                      <Table.Th className="money">Payment</Table.Th>
                      <Table.Th className="money">Balance</Table.Th>
                      <Table.Th className="row-action">
                        <VisuallyHidden>Actions</VisuallyHidden>
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lines.map((line) => {
                      const entry = line.charge ?? line.payment;
                      const label = line.charge ? chargeLabel(line.charge) : "Cash payment";
                      return (
                        <Table.Tr key={line.charge ? line.charge.chargeId : line.payment.paymentId} className={entry.reversal ? "is-reversed" : undefined}>
                          <Table.Td>{showDate(line.date)}</Table.Td>
                          <Table.Td className="ledger-entry">
                            {label}
                            {line.payment && <span className="entry-note">Receipt {line.payment.receiptNumber}</span>}
                            {entry.reversal && <span className="entry-note">Reversed: {entry.reversal.reason}</span>}
                          </Table.Td>
                          <Table.Td className="money">{line.charge && <span className="amount">{showMoney(line.charge.amount)}</span>}</Table.Td>
                          <Table.Td className="money">{line.payment && <span className="amount">{showMoney(line.payment.amount)}</span>}</Table.Td>
                          <Table.Td className="money">
                            {showMoney(pkr(line.balance))}
                            {line.balance < 0 && " cr"}
                          </Table.Td>
                          <Table.Td className="row-action">
                            <Group gap={4} wrap="nowrap" justify="flex-end">
                              {line.payment && (
                                <Button variant="subtle" size="compact-sm" onClick={() => setReceipt(line.payment)} aria-label={`Show receipt ${line.payment.receiptNumber}`}>
                                  Receipt
                                </Button>
                              )}
                              {!entry.reversal && (
                                <Button
                                  variant="subtle"
                                  color="red"
                                  size="compact-sm"
                                  aria-label={`Reverse ${label}`}
                                  onClick={() => setReversing(line.charge ? { kind: "charge", id: line.charge.chargeId, label } : { kind: "payment", id: line.payment.paymentId, label: `Cash payment, receipt ${line.payment.receiptNumber}` })}
                                >
                                  Reverse
                                </Button>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </section>
          <TakePayment
            account={account}
            opened={paying}
            onClose={() => setPaying(false)}
            onPaid={async (paymentId) => {
              setPaying(false);
              const payment = (await load())?.payments.find((p) => p.paymentId === paymentId);
              if (!payment) return;
              setNotice(`Took ${showMoney(payment.amount)}, receipt ${payment.receiptNumber}.`);
              setReceipt(payment);
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
          <Receipt payment={receipt} student={student} account={account} user={user} onClose={() => setReceipt(undefined)} />
        </>
      )}
    </div>
  );
}
