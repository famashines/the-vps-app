import { Badge, Button, Group, Modal, Text, TextInput, Title } from "@mantine/core";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { toLocal } from "../phone.ts";
import { Icon } from "../icons";
import { familyStatusLabel, gradeLabel, isStale, send, showDate, todayInPakistan, type Answer } from "../school.ts";
import { signInUrl } from "../session";
import type { Student } from "./Students";

const relations: Record<string, string> = { father: "Father", mother: "Mother", guardian: "Guardian" };

function Leaving({ student, onDone }: { student: Student; onDone: () => void }) {
  const [opened, setOpened] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<Answer>();
  const name = `${student.firstName} ${student.lastName}`;
  const today = todayInPakistan(new Date());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") ?? "").trim();
    const body = cancelling
      ? { expectedVersion: student.version }
      : { expectedVersion: student.version, leftOn: String(data.get("leftOn")), ...(reason && { reason }) };
    setSaving(true);
    const result = await send(`/api/students/${student.studentId}/leaving${cancelling ? "/cancellation" : ""}`, body, key);
    setSaving(false);
    setAnswer(result);
    if (!result.ok) return;
    setKey(crypto.randomUUID());
    setOpened(false);
    onDone();
  }

  const failed = answer && !answer.ok ? answer : undefined;

  return (
    <>
      <Button variant="default" className={student.leftOn ? undefined : "danger-button"} onClick={() => { setAnswer(undefined); setCancelling(student.leftOn); setOpened(true); }}>
        {student.leftOn ? "Cancel leaving" : "Mark as left"}
      </Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title={cancelling ? `Cancel the leaving of ${name}?` : `Mark ${name} as left?`} centered radius="md">
        <form onSubmit={submit} className="edit-form">
          {cancelling ? (
            <Text>The student is active again. The monthly fees after {showDate(cancelling)} are charged again.</Text>
          ) : (
            <>
              <Text>The leaving month is charged. No monthly fee is charged after it. Charges for later months are reversed.</Text>
              <TextInput name="leftOn" label="Leaving day" type="date" defaultValue={today} max={today} error={failed?.fields.leftOn && (failed.fields.leftOn.startsWith("The") ? failed.fields.leftOn : "Enter a real date.")} classNames={{ input: "field-input" }} required withAsterisk={false} data-autofocus />
              <TextInput name="reason" label="Reason" description="Optional" maxLength={500} autoComplete="off" classNames={{ input: "field-input" }} />
            </>
          )}
          {failed && !Object.keys(failed.fields).length && (
            <div className="problem" role="alert">
              <Text>{failed.message}</Text>
              {isStale(failed) && (
                <Button variant="default" size="compact-sm" onClick={() => location.reload()}>
                  Reload
                </Button>
              )}
            </div>
          )}
          <Group gap="sm">
            <Button type="submit" color={cancelling ? undefined : "red"} loading={saving}>
              {cancelling ? "Cancel leaving" : "Mark as left"}
            </Button>
            <Button variant="default" onClick={() => setOpened(false)}>
              Keep as it is
            </Button>
          </Group>
        </form>
      </Modal>
    </>
  );
}

export function StudentPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | "missing" | "failed">();
  const [all, setAll] = useState<Student[]>([]);

  const load = useCallback(() => {
    fetch("/api/students")
      .then(async (r) => {
        if (r.status === 401) return location.assign(signInUrl());
        if (!r.ok) return setStudent("failed");
        const students = (await r.json()) as Student[];
        setAll(students);
        setStudent(students.find((s) => s.studentId === studentId) ?? "missing");
      })
      .catch(() => setStudent("failed"));
  }, [studentId]);

  useEffect(load, [load]);

  if (student === undefined) return <Text className="state-text">Loading the student.</Text>;
  if (typeof student !== "object")
    return (
      <div className="panel state">
        <Text className="state-title error" role="alert">
          {student === "missing" ? "This student does not exist." : "The student did not load."}
        </Text>
        <Text className="state-text">{student === "missing" ? "Find the student in the list." : "Check the connection, then reload the page."}</Text>
        <Button component={Link} to="/students" variant="default" mt="md">
          Back to students
        </Button>
      </div>
    );

  const name = `${student.firstName} ${student.lastName}`;
  const enrollment = student.enrollments[0];
  const siblings = all.filter((s) => student.siblings?.studentIds.includes(s.studentId) || s.siblings?.studentIds.includes(student.studentId));
  const notGiven = "Not given";

  return (
    <>
      <Link to="/students" className="back-link">
        <Icon name="back" size={16} />
        Students
      </Link>
      <header className="page-head">
        <div>
          <Group gap="sm" align="center">
            <Title order={1}>{name}</Title>
            {student.leftOn ? (
              <Badge color="gray" variant="light" tt="none">
                Left on {showDate(student.leftOn)}
              </Badge>
            ) : (
              <Badge color="green" variant="light" tt="none">
                Active
              </Badge>
            )}
          </Group>
          <Text className="lead">
            <span className="adm-mark">{student.admissionNumber}</span>
            {enrollment ? (
              <>
                <Link to={`/classes/${enrollment.classId}`}>{gradeLabel(enrollment.grade)}</Link>, {enrollment.academicYearName}
              </>
            ) : (
              "Not in a class yet"
            )}
          </Text>
        </div>
        <Group gap="sm">
          <Leaving student={student} onDone={load} />
          <Button component={Link} to={`/students/${student.studentId}/fees`} variant="default" leftSection={<Icon name="fees" size={16} />}>
            Fee account
          </Button>
          <Button component={Link} to={`/students/${student.studentId}/edit`}>
            Edit details
          </Button>
        </Group>
      </header>
      <section className="panel" aria-label={`Details of ${name}`}>
        <dl className="facts">
          <div>
            <dt>Father name</dt>
            <dd>{student.fatherName ?? "Not given"}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{showDate(student.dateOfBirth)}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{student.gender === "female" ? "Female" : "Male"}</dd>
          </div>
          <div>
            <dt>Guardian</dt>
            <dd>
              {student.guardian.name}, {relations[student.guardian.relation] ?? student.guardian.relation}
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className="num">
              <a href={`tel:${student.guardian.phone}`}>{toLocal(student.guardian.phone)}</a>
            </dd>
          </div>
          <div>
            <dt>Guardian CNIC</dt>
            <dd className="num">{student.guardian.cnic ?? notGiven}</dd>
          </div>
          <div>
            <dt>B-Form number</dt>
            <dd className="num">{student.bFormNumber ?? notGiven}</dd>
          </div>
          <div>
            <dt>Home address</dt>
            <dd>{student.address ?? notGiven}</dd>
          </div>
          <div>
            <dt>Family status</dt>
            <dd>
              {student.familyStatus ? familyStatusLabel(student.familyStatus) : notGiven}
              {student.familyStatusNote && <span className="fact-line">{student.familyStatusNote}</span>}
            </dd>
          </div>
          <div>
            <dt>Brothers and sisters</dt>
            <dd>
              {student.siblings ? student.siblings.count : notGiven}
              {siblings.map((s) => (
                <span key={s.studentId} className="fact-line">
                  <Link to={`/students/${s.studentId}`}>
                    {s.firstName} {s.lastName}
                  </Link>{" "}
                  <span className="num">{s.admissionNumber}</span>
                </span>
              ))}
            </dd>
          </div>
          {student.leftReason && (
            <div>
              <dt>Leaving reason</dt>
              <dd>{student.leftReason}</dd>
            </div>
          )}
          <div>
            <dt>Classes</dt>
            <dd>
              {student.enrollments.length === 0
                ? "Not enrolled"
                : student.enrollments.map((e) => (
                    <span key={e.enrollmentId} className="fact-line">
                      <Link to={`/classes/${e.classId}`}>{gradeLabel(e.grade)}</Link>, {e.academicYearName}
                    </span>
                  ))}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
