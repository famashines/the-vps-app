import { Button, Table, Text, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import type { AccountSummary } from "../fees.ts";
import { findsStudent } from "../find.ts";
import { Icon } from "../icons";
import { gradeLabel } from "../school.ts";
import { EnrollDialog, type Enrollment } from "./EnrollDialog";
import { balanceText } from "./StudentFees";
import { signInUrl } from "../session";

export type Student = {
  studentId: string;
  version: number;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  fatherName: string | null;
  dateOfBirth: string;
  gender: string;
  guardian: { name: string; relation: string; phone: string; cnic: string | null };
  bFormNumber: string | null;
  address: string | null;
  familyStatus: string | null;
  familyStatusNote: string | null;
  siblings: { count: number; studentIds: string[] } | null;
  leftOn: string | null;
  leftReason: string | null;
  enrollments: Enrollment[];
};
type State = { status: "loading" } | { status: "failed" } | { status: "loaded"; students: Student[] };

const columns = ["Admission no.", "Name", "Father name", "Class", "Fees", "Date of birth", "Guardian", "Phone"];
const showDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function Empty({ status }: { status: "loading" | "failed" | "empty" }) {
  if (status === "loading") return <Text className="state-text">Loading students.</Text>;
  if (status === "failed")
    return (
      <>
        <Text className="state-title error" role="alert">
          The student list did not load.
        </Text>
        <Text className="state-text">Check the connection, then reload the page.</Text>
        <Button variant="default" mt="md" onClick={() => location.reload()}>
          Reload page
        </Button>
      </>
    );
  return (
    <>
      <Text className="state-title">No students registered yet.</Text>
      <Text className="state-text">Register the first student. The admission number is given on save.</Text>
      <Button component={Link} to="/students/new" mt="md" leftSection={<Icon name="add" size={16} />}>
        Register student
      </Button>
    </>
  );
}

export function Students() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [enrolling, setEnrolling] = useState<{ studentId: string; name: string }>();
  const [enrolled, setEnrolled] = useState<string>();
  const [balances, setBalances] = useState<Map<string, number>>();
  type Note = { studentId: string; admissionNumber: string; name: string; enrolledIn?: string; enrollProblem?: string };
  const { registered, updated } = (useLocation().state ?? {}) as { registered?: Note; updated?: Note };
  const marked = registered?.studentId ?? updated?.studentId;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = params.get("q") ?? "";

  useEffect(() => {
    fetch("/api/students")
      .then(async (response) => {
        if (response.status === 401) return location.assign(signInUrl());
        setState(response.ok ? { status: "loaded", students: await response.json() } : { status: "failed" });
      })
      .catch(() => setState({ status: "failed" }));
    fetch("/api/fees/accounts")
      .then(async (response) => response.ok && setBalances(new Map(((await response.json()) as AccountSummary[]).reverse().map((a) => [a.studentId, a.balance.amount]))))
      .catch(() => {});
  }, []);

  const empty = state.status === "loaded" ? (state.students.length === 0 ? "empty" : undefined) : state.status;
  const count = state.status === "loaded" && state.students.length > 0 ? state.students.length : undefined;
  const shown = state.status === "loaded" ? state.students.filter((s) => findsStudent(s, filter)) : [];

  useEffect(() => {
    if (state.status === "loaded" && marked) document.querySelector("tr.new")?.scrollIntoView({ block: "center" });
  }, [state.status, marked]);

  return (
    <>
      <header className="page-head">
        <div>
          <Title order={1}>Students</Title>
          <Text className="lead">{count ? (filter.trim() ? `${shown.length} of ${count} match the filter` : `${count} registered`) : "Every student registered at the school office."}</Text>
        </div>
        <Button component={Link} to="/students/new" leftSection={<Icon name="add" size={16} />}>
          Register student
        </Button>
      </header>
      {enrolled && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>{enrolled}</Text>
        </div>
      )}
      {registered && !enrolled && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>
            Registered {registered.name} as <strong>{registered.admissionNumber}</strong>
            {registered.enrolledIn ? ` in ${registered.enrolledIn}.` : "."}
            {registered.enrollProblem && ` The enrollment did not work: ${registered.enrollProblem} Use Enroll in the list.`}
          </Text>
        </div>
      )}
      {updated && !enrolled && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>
            Saved the changes to {updated.name}, <strong>{updated.admissionNumber}</strong>.{updated.enrolledIn && ` The class is now ${updated.enrolledIn}.`}
            {updated.enrollProblem && ` The class did not change: ${updated.enrollProblem}`}
          </Text>
        </div>
      )}
      <div className="panel panel-flush">
        {count && (
          <div className="list-tools">
            <TextInput
              type="search"
              value={filter}
              onChange={(event) => setParams(event.currentTarget.value ? { q: event.currentTarget.value } : {}, { replace: true })}
              placeholder="Name, father name, admission no. or phone"
              aria-label="Filter students"
              leftSection={<Icon name="search" size={16} />}
              classNames={{ input: "field-input filter-input" }}
            />
          </div>
        )}
        {empty ? (
          <div className="state">
            <Empty status={empty} />
          </div>
        ) : (
          state.status === "loaded" && (
            <Table.ScrollContainer minWidth={760} type="native">
              <Table className="ruled" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    {columns.map((column) => (
                      <Table.Th key={column}>{column}</Table.Th>
                    ))}
                    <Table.Th className="row-action">
                      <VisuallyHidden>Edit</VisuallyHidden>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {shown.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={columns.length + 1} className="no-match">
                        No student matches "{filter.trim()}".
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {shown.map((s) => (
                    <Table.Tr
                      key={s.studentId}
                      className={s.studentId === marked ? "new open-row" : "open-row"}
                      onClick={(event) => (event.target as HTMLElement).closest("a, button") || navigate(`/students/${s.studentId}`)}
                    >
                      <Table.Td className="adm">{s.admissionNumber}</Table.Td>
                      <Table.Td className="name">
                        <Link to={`/students/${s.studentId}`} className="row-link">
                          {s.firstName} {s.lastName}
                        </Link>
                      </Table.Td>
                      <Table.Td>{s.fatherName}</Table.Td>
                      <Table.Td>
                        {s.enrollments[0] ? (
                          <Link to={`/classes/${s.enrollments[0].classId}`} className="class-cell" title={s.enrollments[0].academicYearName}>
                            {gradeLabel(s.enrollments[0].grade)}
                          </Link>
                        ) : (
                          <Button variant="subtle" size="compact-sm" onClick={() => setEnrolling({ studentId: s.studentId, name: `${s.firstName} ${s.lastName}` })}>
                            Enroll
                          </Button>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {balances?.has(s.studentId) && (
                          <Link to={`/students/${s.studentId}/fees`} className={`fees-link${balances.get(s.studentId)! > 0 ? " is-owed" : ""}`} aria-label={`Fee account of ${s.firstName} ${s.lastName}: ${balanceText(balances.get(s.studentId)!)}`}>
                            {balanceText(balances.get(s.studentId)!)}
                          </Link>
                        )}
                      </Table.Td>
                      <Table.Td>{showDate(s.dateOfBirth)}</Table.Td>
                      <Table.Td>{s.guardian.name}</Table.Td>
                      <Table.Td className="num">{s.guardian.phone}</Table.Td>
                      <Table.Td className="row-action">
                        <Button component={Link} to={`/students/${s.studentId}/edit`} variant="subtle" size="compact-sm" aria-label={`Edit ${s.firstName} ${s.lastName}`}>
                          Edit
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )
        )}
      </div>
      <EnrollDialog
        student={enrolling}
        onClose={() => setEnrolling(undefined)}
        onEnrolled={(enrollment) => {
          if (state.status === "loaded" && enrolling) {
            setState({ status: "loaded", students: state.students.map((s) => (s.studentId === enrolling.studentId ? { ...s, enrollments: [enrollment, ...s.enrollments] } : s)) });
            setEnrolled(`Enrolled ${enrolling.name} in ${gradeLabel(enrollment.grade)}, ${enrollment.academicYearName}.`);
          }
          setEnrolling(undefined);
        }}
      />
    </>
  );
}
