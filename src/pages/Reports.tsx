import { Badge, Button, NativeSelect, Table, Text, Title, VisuallyHidden } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { AccountSummary } from "../fees.ts";
import { pkr, showMoney } from "../money.ts";
import { toLocal } from "../phone.ts";
import { feeReport, share, type Totals } from "../report.ts";
import { currentYear, gradeLabel, showDate, type Year } from "../school.ts";
import { signInUrl } from "../session";
import { balanceText } from "./StudentFees";
import type { Student } from "./Students";

type State = { status: "loading" } | { status: "failed" } | { status: "loaded"; years: Year[]; accounts: AccountSummary[]; students: Student[] };

async function getJson(path: string) {
  const response = await fetch(path);
  if (response.status === 401) location.assign(signInUrl());
  if (!response.ok) throw new Error(path);
  return response.json();
}

const rs = (paisa: number) => showMoney(pkr(paisa));
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="figure">
      <Text className="figure-label">{label}</Text>
      <Text className="figure-value">{value}</Text>
      <Text className="figure-note">{note}</Text>
    </div>
  );
}

function Row({ label, t }: { label: string; t: Totals }) {
  return (
    <>
      <Table.Td className="name">{label}</Table.Td>
      <Table.Td className="money">{t.accounts}</Table.Td>
      <Table.Td className="money">{rs(t.charged)}</Table.Td>
      <Table.Td className="money">{rs(t.collected)}</Table.Td>
      <Table.Td className="money">{rs(t.remaining)}</Table.Td>
      <Table.Td className="money">{rs(t.overdue)}</Table.Td>
    </>
  );
}

export function Reports() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [yearId, setYearId] = useState<string>();

  useEffect(() => {
    Promise.all(["/api/academic-years", "/api/fees/accounts", "/api/students"].map(getJson))
      .then(([years, accounts, students]) => setState({ status: "loaded", years, accounts, students }))
      .catch(() => setState({ status: "failed" }));
  }, []);

  const head = (
    <header className="page-head">
      <div>
        <Title order={1}>Reports</Title>
        <Text className="lead">The fees of the school year: what was charged, what was collected, what is left, and who is late.</Text>
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
        <Text className="state-text">Loading the reports.</Text>
      </>
    );
  if (state.status === "failed")
    return (
      <>
        {head}
        <div className="panel state">
          <Text className="state-title error" role="alert">
            The reports did not load.
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
          <Text className="state-text">Open a school year and its classes. The reports start when students are enrolled.</Text>
          <Button component={Link} to="/classes" mt="md">
            Go to classes
          </Button>
        </div>
      </>
    );

  const { total, byGrade, defaulters } = feeReport(state.accounts.filter((a) => a.academicYearId === year.academicYearId));
  const students = new Map(state.students.map((s) => [s.studentId, s]));
  const collected = share(total.collected, total.charged);

  return (
    <>
      {head}
      <div className="years">
        <section className="figures" aria-label={`Totals ${year.name}`}>
          <Figure label="Charged" value={rs(total.charged)} note={count(total.accounts, "account", "accounts")} />
          <Figure label="Collected" value={rs(total.collected)} note={collected === undefined ? "Nothing charged yet" : `${collected}% of charged`} />
          <Figure label="Remaining" value={rs(total.remaining)} note={total.credit > 0 ? `Credit ${rs(total.credit)} not counted` : "Still to collect"} />
          <Figure label="Overdue" value={rs(total.overdue)} note={defaulters.length ? count(defaulters.length, "defaulter", "defaulters") : "No defaulter"} />
        </section>

        <section className="panel panel-flush" aria-labelledby="by-class-title">
          <div className="panel-pad">
            <Title order={2} className="panel-title" id="by-class-title">
              By class {year.name}
            </Title>
            <Text className="panel-text">Remaining is what students still owe. Overdue is the part that was due before today.</Text>
          </div>
          {byGrade.length === 0 ? (
            <Text className="state-text ledger-empty">No accounts yet. An account opens when a student is enrolled in a class.</Text>
          ) : (
            <Table.ScrollContainer minWidth={640} type="native">
              <Table className="ruled" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Class</Table.Th>
                    <Table.Th className="money">Students</Table.Th>
                    <Table.Th className="money">Charged</Table.Th>
                    <Table.Th className="money">Collected</Table.Th>
                    <Table.Th className="money">Remaining</Table.Th>
                    <Table.Th className="money">Overdue</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {byGrade.map((g) => (
                    <Table.Tr key={g.grade}>
                      <Row label={gradeLabel(g.grade)} t={g} />
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr className="total-row">
                    <Row label="Total" t={total} />
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </Table.ScrollContainer>
          )}
        </section>

        <section className="panel panel-flush" aria-labelledby="defaulters-title">
          <div className="panel-pad">
            <Title order={2} className="panel-title" id="defaulters-title">
              Defaulters {year.name}
            </Title>
            <Text className="panel-text">Students with fees that were due before today and are not paid. A monthly fee is due on the 10th.</Text>
          </div>
          {defaulters.length === 0 ? (
            <Text className="state-text ledger-empty">No defaulter. Every fee that is due is paid.</Text>
          ) : (
            <Table.ScrollContainer minWidth={820} type="native">
              <Table className="ruled" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Admission no.</Table.Th>
                    <Table.Th>Student</Table.Th>
                    <Table.Th>Class</Table.Th>
                    <Table.Th>Contact no.</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th className="money">Overdue</Table.Th>
                    <Table.Th className="money">Balance</Table.Th>
                    <Table.Th className="row-action">
                      <VisuallyHidden>Account</VisuallyHidden>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {defaulters.map((a) => {
                    const s = students.get(a.studentId);
                    return (
                      <Table.Tr key={a.accountId}>
                        <Table.Td className="adm">{s?.admissionNumber}</Table.Td>
                        <Table.Td className="name">
                          {s ? (
                            <Link to={`/students/${s.studentId}`} className="row-link">
                              {s.firstName} {s.lastName}
                            </Link>
                          ) : (
                            "Unknown student"
                          )}
                        </Table.Td>
                        <Table.Td>{gradeLabel(a.grade)}</Table.Td>
                        <Table.Td className="num">
                          {s && (
                            <a href={`tel:${s.guardian.phone}`} className="row-link">
                              {toLocal(s.guardian.phone)}
                            </a>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {s?.leftOn ? (
                            <Badge color="gray" variant="light" tt="none" title={`Left on ${showDate(s.leftOn)}`}>
                              Left
                            </Badge>
                          ) : (
                            <Badge color="green" variant="light" tt="none">
                              Active
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td className="money owed">{rs(a.overdue!.amount)}</Table.Td>
                        <Table.Td className="money">{balanceText(a.balance.amount)}</Table.Td>
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
    </>
  );
}
