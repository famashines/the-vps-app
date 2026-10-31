import { Button, Group, Modal, NativeSelect, Table, Text, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { AccountSummary, Schedule } from "../fees.ts";
import { Icon } from "../icons";
import { pkr, showMoney, toPaisa } from "../money.ts";
import { GRADES, currentYear, gradeLabel, send, type Year } from "../school.ts";
import { signInUrl } from "../session";
import { balanceText } from "./StudentFees";
import type { Student } from "./Students";

type Data = { years: Year[]; schedules: Schedule[]; accounts: AccountSummary[]; students: Student[] };
type State = { status: "loading" } | { status: "failed" } | ({ status: "loaded" } & Data);

async function getJson(path: string) {
  const response = await fetch(path);
  if (response.status === 401) location.assign(signInUrl());
  if (!response.ok) throw new Error(path);
  return response.json();
}

const rupees = (money?: { amount: number }) => (money ? String(money.amount / 100) : "");

function SetFees({ year, grade, schedule, onClose, onSaved }: { year: Year; grade?: string; schedule?: Schedule; onClose: () => void; onSaved: (text: string) => void }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState(grade);

  useEffect(() => {
    if (!grade) return;
    setShown(grade);
    setKey(crypto.randomUUID());
    setErrors({});
    setProblem(undefined);
  }, [grade]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name)).trim();
    const next: Record<string, string> = {};
    const fees: Record<string, ReturnType<typeof pkr>> = {};
    for (const name of ["monthlyFee", "admissionFee", "annualFee"]) {
      if (!read(name) && name !== "monthlyFee") continue;
      const paisa = toPaisa(read(name));
      if (paisa === undefined) next[name] = "Enter whole rupees, for example 4500.";
      else fees[name] = pkr(paisa);
    }
    setErrors(next);
    if (Object.keys(next).length || !shown) return;
    setSaving(true);
    const answer = await send("/api/fees/schedules", { academicYearId: year.academicYearId, grade: shown, ...fees }, key);
    setSaving(false);
    if (!answer.ok) return setProblem(answer.message);
    const charged = answer.data.charged as number;
    onSaved(`Saved the fees of ${gradeLabel(shown)}.${charged ? ` ${charged} ${charged === 1 ? "charge was" : "charges were"} made for students who were waiting for these fees.` : ""}`);
  }

  const field = (name: string, label: string, description?: string) => (
    <TextInput
      name={name}
      label={label}
      description={description}
      defaultValue={rupees(schedule?.[name as "monthlyFee"])}
      inputMode="numeric"
      autoComplete="off"
      leftSection={<span className="rs">Rs</span>}
      error={errors[name]}
      classNames={{ input: "field-input" }}
      required={name === "monthlyFee"}
      withAsterisk={false}
      data-autofocus={name === "monthlyFee" || undefined}
    />
  );

  return (
    <Modal opened={!!grade} onClose={onClose} title={shown && `Fees of ${gradeLabel(shown)}, ${year.name}`} centered radius="md">
      <form onSubmit={submit} className="edit-form">
        {field("monthlyFee", "Monthly fee", "Charged on the 1st of each month, due by the 10th.")}
        <div className="pair">
          {field("admissionFee", "Admission fee", "Once. Leave empty for none.")}
          {field("annualFee", "Annual fee", "Once. Leave empty for none.")}
        </div>
        <Text className="panel-text">New fees apply to the next charges. Charges that exist do not change.</Text>
        {problem && (
          <div className="problem" role="alert">
            <Text>{problem}</Text>
          </div>
        )}
        <Group gap="sm">
          <Button type="submit" loading={saving}>
            Save fees
          </Button>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

export function Fees() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [yearId, setYearId] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(() => {
    Promise.all(["/api/academic-years", "/api/fees/schedules", "/api/fees/accounts", "/api/students"].map(getJson))
      .then(([years, schedules, accounts, students]) => setState({ status: "loaded", years, schedules, accounts, students }))
      .catch(() => setState({ status: "failed" }));
  }, []);

  useEffect(load, [load]);

  const head = (
    <header className="page-head">
      <div>
        <Title order={1}>Fees</Title>
        <Text className="lead">The fees of each grade, and what each student owes. Take payments on the student's account.</Text>
      </div>
      {state.status === "loaded" && state.years.length > 1 && (
        <NativeSelect
          aria-label="School year"
          value={yearId ?? currentYear(state.years).academicYearId}
          onChange={(event) => setYearId(event.currentTarget.value)}
          data={state.years.map((y) => ({ value: y.academicYearId, label: y.name }))}
          classNames={{ input: "field-input" }}
        />
      )}
    </header>
  );

  if (state.status === "loading")
    return (
      <>
        {head}
        <Text className="state-text">Loading the fees.</Text>
      </>
    );
  if (state.status === "failed")
    return (
      <>
        {head}
        <div className="panel state">
          <Text className="state-title error" role="alert">
            The fees did not load.
          </Text>
          <Text className="state-text">Check the connection, then reload the page.</Text>
          <Button variant="default" mt="md" onClick={() => location.reload()}>
            Reload page
          </Button>
        </div>
      </>
    );

  const year = state.years.find((y) => y.academicYearId === yearId) ?? currentYear(state.years);
  if (!year)
    return (
      <>
        {head}
        <div className="panel state">
          <Text className="state-title">No school year yet.</Text>
          <Text className="state-text">Open a school year and its classes. Then set the fees of each grade.</Text>
          <Button component={Link} to="/classes" mt="md">
            Go to classes
          </Button>
        </div>
      </>
    );

  const schedules = state.schedules.filter((s) => s.academicYearId === year.academicYearId);
  const grades = GRADES.filter(([g]) => year.classes.some((c) => c.grade === g) || schedules.some((s) => s.grade === g));
  const scheduleOf = (grade?: string) => schedules.find((s) => s.grade === grade);
  const students = new Map(state.students.map((s) => [s.studentId, s]));
  const accounts = state.accounts.filter((a) => a.academicYearId === year.academicYearId).sort((a, b) => (students.get(a.studentId)?.admissionNumber ?? "").localeCompare(students.get(b.studentId)?.admissionNumber ?? ""));

  return (
    <>
      {head}
      {notice && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>{notice}</Text>
        </div>
      )}
      <div className="years">
        <section className="panel panel-flush" aria-labelledby="schedule-title">
          <div className="panel-pad">
            <Title order={2} className="panel-title" id="schedule-title">
              Fee schedule {year.name}
            </Title>
            <Text className="panel-text">Fees in rupees for each grade that has a class in {year.name}.</Text>
          </div>
          {grades.length === 0 ? (
            <Text className="state-text ledger-empty">
              No classes yet. Open them on the <Link to="/classes">Classes</Link> page.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={560} type="native">
              <Table className="ruled" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Grade</Table.Th>
                    <Table.Th className="money">Monthly</Table.Th>
                    <Table.Th className="money">Admission</Table.Th>
                    <Table.Th className="money">Annual</Table.Th>
                    <Table.Th className="row-action">
                      <VisuallyHidden>Change</VisuallyHidden>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grades.map(([grade, label]) => {
                    const s = scheduleOf(grade);
                    return (
                      <Table.Tr key={grade}>
                        <Table.Td className="name">{label}</Table.Td>
                        {s ? (
                          <>
                            <Table.Td className="money">{showMoney(s.monthlyFee)}</Table.Td>
                            <Table.Td className="money">{s.admissionFee ? showMoney(s.admissionFee) : "None"}</Table.Td>
                            <Table.Td className="money">{s.annualFee ? showMoney(s.annualFee) : "None"}</Table.Td>
                          </>
                        ) : (
                          <Table.Td colSpan={3} className="not-set">
                            Not set. Students of {label} are not charged yet.
                          </Table.Td>
                        )}
                        <Table.Td className="row-action">
                          <Button variant="subtle" size="compact-sm" onClick={() => setEditing(grade)} aria-label={`${s ? "Change" : "Set"} the fees of ${label}`}>
                            {s ? "Change" : "Set fees"}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </section>
        <section className="panel panel-flush" aria-labelledby="accounts-title">
          <div className="panel-pad">
            <Title order={2} className="panel-title" id="accounts-title">
              Accounts {year.name}
            </Title>
            <Text className="panel-text">Each enrolled student has one account for the school year.</Text>
          </div>
          {accounts.length === 0 ? (
            <Text className="state-text ledger-empty">No accounts yet. An account opens when a student is enrolled in a class.</Text>
          ) : (
            <Table.ScrollContainer minWidth={720} type="native">
              <Table className="ruled" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Admission no.</Table.Th>
                    <Table.Th>Student</Table.Th>
                    <Table.Th>Class</Table.Th>
                    <Table.Th className="money">Charged</Table.Th>
                    <Table.Th className="money">Paid</Table.Th>
                    <Table.Th className="money">Balance</Table.Th>
                    <Table.Th className="row-action">
                      <VisuallyHidden>Account</VisuallyHidden>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {accounts.map((a) => {
                    const s = students.get(a.studentId);
                    return (
                      <Table.Tr key={a.accountId}>
                        <Table.Td className="adm">{s?.admissionNumber}</Table.Td>
                        <Table.Td className="name">{s ? `${s.firstName} ${s.lastName}` : "Unknown student"}</Table.Td>
                        <Table.Td>{gradeLabel(a.grade)}</Table.Td>
                        <Table.Td className="money">{showMoney(a.charged)}</Table.Td>
                        <Table.Td className="money">{showMoney(a.paid)}</Table.Td>
                        <Table.Td className={`money owed${a.balance.amount < 0 ? " is-credit" : a.balance.amount === 0 ? " is-clear" : ""}`}>{balanceText(a.balance.amount)}</Table.Td>
                        <Table.Td className="row-action">
                          <Button component={Link} to={`/students/${a.studentId}/fees`} variant="subtle" size="compact-sm" aria-label={`Open the account of ${s?.firstName ?? "the student"}`}>
                            Account
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </section>
      </div>
      <SetFees
        year={year}
        grade={editing}
        schedule={scheduleOf(editing)}
        onClose={() => setEditing(undefined)}
        onSaved={(text) => {
          setEditing(undefined);
          setNotice(text);
          load();
        }}
      />
    </>
  );
}
