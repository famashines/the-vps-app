import { Button, NativeSelect, Text, TextInput, Title } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { isMember, labelOf, STAFF_ROLES, STATUSES, type Sheet, type StaffMember, type Status } from "../campus.ts";
import { classGroups, currentYear, gradeLabel, isStale, send, showDate, todayInPakistan, type Year } from "../school.ts";
import { ButtonGroup, plural } from "./cards";
import { firstBad, Notice, PageState, Problem, useLoad } from "./campusParts";
import type { Student } from "./Students";

type Person = { id: string; name: string; note: string };

function SheetForm({ people, sheet, path, base, idKey, onSaved }: {
  people: Person[];
  sheet?: Sheet<string>;
  path: string;
  base: object;
  idKey: "studentId" | "staffId";
  onSaved: (text: string) => void;
}) {
  const saved = useMemo(() => new Map(sheet?.marks.map((m) => [m[idKey], m.status])), [sheet, idKey]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<{ text: string; stale: boolean }>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMarks(Object.fromEntries(people.map((p) => [p.id, saved.get(p.id) ?? "present"])));
    setKey(crypto.randomUUID());
    setProblem(undefined);
  }, [people, saved]);

  const count = (status: Status) => people.filter((p) => marks[p.id] === status).length;

  async function save() {
    setSaving(true);
    setProblem(undefined);
    const answer = await send(path, { ...base, expectedVersion: sheet?.version ?? 0, marks: people.map((p) => ({ [idKey]: p.id, status: marks[p.id] ?? "present" })) }, key, "PUT");
    setSaving(false);
    if (!answer.ok) return answer.status !== 401 && setProblem({ text: answer.message, stale: isStale(answer) });
    onSaved(`Saved: ${count("present")} present, ${count("absent")} absent, ${count("leave")} on leave.`);
  }

  return (
    <>
      <Problem text={problem?.text} stale={problem?.stale} />
      <Text className="panel-text">{sheet ? "This sheet is marked. You can change it and save it again." : "Not marked yet. Everyone starts as present."}</Text>
      <ul className="sheet">
        {people.map((p) => (
          <li key={p.id}>
            <div className="sheet-person">
              <span className="row-name">{p.name}</span>
              <span className="row-note">{p.note}</span>
            </div>
            <ButtonGroup label={`Attendance of ${p.name}`} value={labelOf(STATUSES, marks[p.id] ?? "present")} onChange={(label) => setMarks((m) => ({ ...m, [p.id]: STATUSES.find(([, l]) => l === label)![0] }))} data={STATUSES.map(([, label]) => label)} />
          </li>
        ))}
      </ul>
      <div className="sheet-foot">
        <Text className="panel-text" role="status">
          {count("present")} present, {count("absent")} absent, {count("leave")} on leave
        </Text>
        <Button onClick={save} loading={saving}>
          {sheet ? "Save changes" : "Save attendance"}
        </Button>
      </div>
    </>
  );
}

export function Attendance() {
  const today = todayInPakistan(new Date());
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState("Students");
  const [classId, setClassId] = useState("");
  const [notice, setNotice] = useState<string>();
  const [students] = useLoad<Student[]>("/api/students");
  const [years] = useLoad<Year[]>("/api/academic-years");
  const [staff] = useLoad<StaffMember[]>("/api/staff");
  const [studentSheets, loadStudentSheets] = useLoad<Sheet<"studentId">[]>(`/api/attendance/students?date=${date}`);
  const [staffSheets, loadStaffSheets] = useLoad<Sheet<"staffId">[]>(`/api/attendance/staff?date=${date}`);

  const bad = firstBad(students, years, staff, studentSheets, staffSheets);
  const year = typeof years === "string" ? undefined : currentYear(years);
  const classes = year?.classes ?? [];
  const chosen = classes.find((c) => c.classId === classId) ?? classes[0];

  const roster = useMemo<Person[]>(
    () =>
      typeof students === "string" || !chosen
        ? []
        : students
            .filter((s) => s.enrollments.some((e) => e.classId === chosen.classId) && (!s.leftOn || s.leftOn >= date))
            .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
            .map((s) => ({ id: s.studentId, name: `${s.firstName} ${s.lastName}`, note: s.admissionNumber })),
    [students, chosen?.classId, date],
  );
  const members = useMemo<Person[]>(
    () => (typeof staff === "string" ? [] : staff.filter((s) => isMember(s, date)).map((s) => ({ id: s.staffId, name: s.name, note: labelOf(STAFF_ROLES, s.role) }))),
    [staff, date],
  );

  const head = (
    <header className="page-head">
      <div>
        <Title order={1}>Attendance</Title>
        <Text className="lead">Mark who is present, absent or on leave. A sheet can be changed after the day; each change is kept in the record.</Text>
      </div>
    </header>
  );
  if (bad || typeof studentSheets === "string" || typeof staffSheets === "string")
    return (
      <div className="account">
        {head}
        <PageState state={bad ?? "loading"} what="the attendance" />
      </div>
    );

  const markedIds = new Set(studentSheets.map((s) => s.classId));
  return (
    <div className="account">
      {head}
      <Notice text={notice} />
      <div className="sheet-tools">
        <TextInput
          type="date"
          label="Day"
          value={date}
          max={today}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next <= today) {
              setDate(next);
              setNotice(undefined);
            }
          }}
          classNames={{ input: "field-input" }}
        />
        <ButtonGroup label="Choose students or staff" value={tab} onChange={setTab} data={["Students", "Staff"]} />
      </div>
      {tab === "Students" ? (
        classes.length === 0 ? (
          <div className="panel state">
            <Text className="state-title">No classes are open.</Text>
            <Text className="state-text">
              Open the classes of the school year on the <Link to="/classes">Classes</Link> page.
            </Text>
          </div>
        ) : (
          <section className="panel" aria-label="Student attendance">
            <Text className="panel-text" role="status">
              {markedIds.size} of {plural(classes.length, "class", "classes")} marked for {showDate(date)}
            </Text>
            <NativeSelect
              label="Class"
              value={chosen.classId}
              onChange={(event) => setClassId(event.currentTarget.value)}
              data={classGroups(classes, (c) => `${gradeLabel(c.grade)} (${markedIds.has(c.classId) ? "marked" : "not marked"})`)}
              classNames={{ input: "field-input" }}
              className="month-pick"
              mt="md"
            />
            {roster.length === 0 ? (
              <Text className="state-text">No student is in {gradeLabel(chosen.grade)} on this day.</Text>
            ) : (
              <SheetForm
                people={roster}
                sheet={studentSheets.find((s) => s.classId === chosen.classId)}
                path="/api/attendance/students"
                base={{ classId: chosen.classId, date }}
                idKey="studentId"
                onSaved={(text) => {
                  setNotice(`${gradeLabel(chosen.grade)}, ${showDate(date)}. ${text}`);
                  void loadStudentSheets();
                }}
              />
            )}
          </section>
        )
      ) : members.length === 0 ? (
        <div className="panel state">
          <Text className="state-title">No staff member on this day.</Text>
          <Text className="state-text">
            Add the staff on the <Link to="/staff">Staff</Link> page.
          </Text>
        </div>
      ) : (
        <section className="panel" aria-label="Staff attendance">
          <SheetForm
            people={members}
            sheet={staffSheets[0]}
            path="/api/attendance/staff"
            base={{ date }}
            idKey="staffId"
            onSaved={(text) => {
              setNotice(`Staff, ${showDate(date)}. ${text}`);
              void loadStaffSheets();
            }}
          />
        </section>
      )}
    </div>
  );
}
