import { Badge, Button, Group, Modal, Table, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { AccountSummary } from "../fees.ts";
import { Icon } from "../icons";
import { toLocal } from "../phone.ts";
import { gradeLabel, isStale, send, showDate, stageOf, type SchoolClass, type Year } from "../school.ts";
import { signInUrl } from "../session";
import { balanceText } from "./StudentFees";
import type { Student } from "./Students";

type State = { status: "loading" } | { status: "failed" } | { status: "missing" } | { status: "loaded"; year: Year; schoolClass: SchoolClass; students: Student[] };

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (response.status === 401) location.assign(signInUrl());
  if (!response.ok) throw new Error(path);
  return response.json();
}

function RemoveClass({ year, schoolClass }: { year: Year; schoolClass: SchoolClass }) {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ message: string; stale: boolean }>();
  const label = gradeLabel(schoolClass.grade);

  async function remove() {
    setSaving(true);
    const answer = await send(`/api/classes/${schoolClass.classId}/closure`, { expectedVersion: schoolClass.version }, key);
    setSaving(false);
    if (answer.ok) return navigate("/classes", { state: { removed: `${label}, ${year.name}` } });
    setProblem({ message: answer.message, stale: isStale(answer) });
  }

  return (
    <>
      <Button variant="default" className="danger-button" onClick={() => setOpened(true)}>
        Remove class
      </Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title={`Remove ${label}, ${year.name}?`} centered radius="md">
        <Text>The class has no students. You can open it again later on the Classes page.</Text>
        {problem && (
          <div className="problem" role="alert">
            <Text>{problem.message}</Text>
            {problem.stale && (
              <Button variant="default" size="compact-sm" onClick={() => location.reload()}>
                Reload
              </Button>
            )}
          </div>
        )}
        <Group gap="sm" mt="lg">
          <Button color="red" loading={saving} onClick={remove} data-autofocus>
            Remove {label}
          </Button>
          <Button variant="default" onClick={() => setOpened(false)}>
            Cancel
          </Button>
        </Group>
      </Modal>
    </>
  );
}

export function ClassPage() {
  const { classId } = useParams();
  const [state, setState] = useState<State>({ status: "loading" });
  const [balances, setBalances] = useState<Map<string, number>>();

  useEffect(() => {
    Promise.all([get<Year[]>("/api/academic-years"), get<Student[]>("/api/students")])
      .then(([years, students]) => {
        const year = years.find((y) => y.classes.some((c) => c.classId === classId));
        const schoolClass = year?.classes.find((c) => c.classId === classId);
        if (!year || !schoolClass) return setState({ status: "missing" });
        setState({ status: "loaded", year, schoolClass, students: students.filter((s) => s.enrollments.some((e) => e.classId === classId)) });
      })
      .catch(() => setState({ status: "failed" }));
    get<AccountSummary[]>("/api/fees/accounts")
      .then((accounts) => setBalances(new Map(accounts.filter((a) => a.classId === classId).map((a) => [a.studentId, a.balance.amount]))))
      .catch(() => {});
  }, [classId]);

  if (state.status === "loading") return <Text className="state-text">Loading the class.</Text>;
  if (state.status !== "loaded")
    return (
      <div className="panel state">
        <Text className="state-title error" role="alert">
          {state.status === "missing" ? "This class does not exist." : "The class did not load."}
        </Text>
        <Text className="state-text">{state.status === "missing" ? "It was removed, or the link is old. Find the class on the Classes page." : "Check the connection, then reload the page."}</Text>
        <Button component={Link} to="/classes" variant="default" mt="md">
          Back to classes
        </Button>
      </div>
    );

  const { year, schoolClass, students } = state;
  const label = gradeLabel(schoolClass.grade);
  const left = students.filter((s) => s.leftOn).length;

  return (
    <>
      <Link to="/classes" className="back-link">
        <Icon name="back" size={16} />
        Classes
      </Link>
      <header className="page-head">
        <div>
          <Title order={1}>{label}</Title>
          <Text className="lead">
            {stageOf(schoolClass.grade)}, {year.name}. {students.length} {students.length === 1 ? "student" : "students"}{left > 0 && `, ${left} left`}.
          </Text>
        </div>
        {students.length === 0 && <RemoveClass year={year} schoolClass={schoolClass} />}
      </header>
      <div className="panel panel-flush">
        {students.length === 0 ? (
          <div className="state">
            <Text className="state-title">No students in {label} yet.</Text>
            <Text className="state-text">Enroll students from the Students page, or choose this class when you register a student.</Text>
            <Button component={Link} to="/students/new" mt="md" leftSection={<Icon name="add" size={16} />}>
              Register student
            </Button>
          </div>
        ) : (
          <Table.ScrollContainer minWidth={900} type="native">
            <Table className="ruled" withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Admission no.</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Father name</Table.Th>
                  <Table.Th>Contact no.</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Fees</Table.Th>
                  <Table.Th className="row-action row-actions">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {students.map((s) => (
                  <Table.Tr key={s.studentId}>
                    <Table.Td className="adm">{s.admissionNumber}</Table.Td>
                    <Table.Td className="name">
                      <Link to={`/students/${s.studentId}`} className="row-link">
                        {s.firstName} {s.lastName}
                      </Link>
                    </Table.Td>
                    <Table.Td>{s.fatherName}</Table.Td>
                    <Table.Td className="num">
                      <a href={`tel:${s.guardian.phone}`} className="row-link">
                        {toLocal(s.guardian.phone)}
                      </a>
                    </Table.Td>
                    <Table.Td>
                      {s.leftOn ? (
                        <Badge color="gray" variant="light" tt="none" title={`Left on ${showDate(s.leftOn)}`}>
                          Left
                        </Badge>
                      ) : (
                        <Badge color="green" variant="light" tt="none">
                          Active
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {balances?.has(s.studentId) && (
                        <Link to={`/students/${s.studentId}/fees`} className={`fees-link${balances.get(s.studentId)! > 0 ? " is-owed" : ""}`} aria-label={`Fee account of ${s.firstName} ${s.lastName}: ${balanceText(balances.get(s.studentId)!)}`}>
                          {balanceText(balances.get(s.studentId)!)}
                        </Link>
                      )}
                    </Table.Td>
                    <Table.Td className="row-action row-actions">
                      <Group gap={4} wrap="nowrap">
                        <Button component={Link} to={`/students/${s.studentId}`} variant="subtle" size="compact-sm" aria-label={`View ${s.firstName} ${s.lastName}`}>
                          View
                        </Button>
                        <Button component={Link} to={`/students/${s.studentId}/edit`} variant="subtle" size="compact-sm" aria-label={`Edit ${s.firstName} ${s.lastName}`}>
                          Edit
                        </Button>
                        <Button component={Link} to={`/students/${s.studentId}/fees`} variant="subtle" size="compact-sm" aria-label={`Fee details of ${s.firstName} ${s.lastName}`}>
                          Fee details
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </div>
    </>
  );
}
