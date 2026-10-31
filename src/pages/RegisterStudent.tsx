import { Button, Group, MultiSelect, NativeSelect, Radio, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toCnic } from "../cnic.ts";
import { toE164, toLocal } from "../phone.ts";
import { FAMILY_STATUSES, birthDateLimits, classGroups, currentYear, gradeLabel, isStale, send, todayInPakistan, type Year } from "../school.ts";
import { signInUrl } from "../session";
import type { Student } from "./Students";

type FieldErrors = Record<string, string>;

const labels: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fatherName: "Father name",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  bFormNumber: "B-Form number",
  "guardian.name": "Guardian name",
  "guardian.relation": "Relation",
  "guardian.phone": "Phone",
  "guardian.cnic": "Guardian CNIC",
  address: "Home address",
  familyStatus: "Family status",
  "siblings.count": "Brothers and sisters",
  familyStatusNote: "Note",
  "siblings.studentIds": "Siblings in this school",
};

const messageFor = (field: string, message: string) => {
  if (/^[A-Z]/.test(message)) return message;
  if (field === "guardian.phone") return "Enter a mobile number, for example 0300 1234567.";
  if (field === "bFormNumber" || field === "guardian.cnic") return "Enter the 13 digits, for example 35202-1234567-8.";
  if (field === "dateOfBirth") return message.includes("years old") ? "The student must be 2 to 25 years old." : "Enter a real date.";
  if (message === "is required") return `${labels[field] ?? field} is required.`;
  return `${labels[field] ?? field} ${message}.`;
};

export function EditStudent() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | "missing" | "failed">();

  useEffect(() => {
    fetch("/api/students")
      .then(async (r) => {
        if (r.status === 401) return location.assign(signInUrl());
        if (!r.ok) return setStudent("failed");
        setStudent(((await r.json()) as Student[]).find((s) => s.studentId === studentId) ?? "missing");
      })
      .catch(() => setStudent("failed"));
  }, [studentId]);

  if (student === undefined) return <Text className="state-text">Loading the student.</Text>;
  if (typeof student === "object") return <RegisterStudent student={student} />;
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
}

const detailsOf = (s: Student) => ({
  firstName: s.firstName,
  lastName: s.lastName,
  fatherName: s.fatherName,
  dateOfBirth: s.dateOfBirth,
  gender: s.gender,
  guardian: { name: s.guardian.name, relation: s.guardian.relation, phone: s.guardian.phone, cnic: s.guardian.cnic },
  bFormNumber: s.bFormNumber,
  address: s.address,
  familyStatus: s.familyStatus,
  ...(s.familyStatusNote && { familyStatusNote: s.familyStatusNote }),
  siblings: s.siblings,
});

const studentLabel = (s: Student) => `${s.firstName} ${s.lastName} (${s.admissionNumber})`;

export function RegisterStudent({ student }: { student?: Student }) {
  const navigate = useNavigate();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string>();
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [enrollKey] = useState(() => crypto.randomUUID());
  const [year, setYear] = useState<Year | null>();
  const [fatherName, setFatherName] = useState(student?.fatherName ?? "");
  const [relation, setRelation] = useState(student?.guardian.relation ?? "father");
  const [guardianName, setGuardianName] = useState(student?.guardian.name ?? "");
  const [linked, setLinked] = useState(!student || (student.guardian.relation === "father" && student.guardian.name === student.fatherName));
  const enrollment = student?.enrollments[0];
  const [others, setOthers] = useState<Student[]>([]);
  const [siblingIds, setSiblingIds] = useState<string[]>(student?.siblings?.studentIds ?? []);

  useEffect(() => {
    fetch("/api/students")
      .then(async (r) => r.ok && setOthers(((await r.json()) as Student[]).filter((s) => s.studentId !== student?.studentId)))
      .catch(() => setOthers([]));
  }, [student?.studentId]);

  useEffect(() => {
    fetch("/api/academic-years")
      .then(async (r) => {
        const years: Year[] = r.ok ? await r.json() : [];
        setYear((enrollment ? years.find((y) => y.academicYearId === enrollment.academicYearId) : currentYear(years)) ?? null);
      })
      .catch(() => setYear(null));
  }, [enrollment?.academicYearId]);

  const shownGuardian = linked && relation === "father" ? fatherName : guardianName;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const body = {
      firstName: value("firstName"),
      lastName: value("lastName"),
      fatherName: value("fatherName"),
      dateOfBirth: value("dateOfBirth"),
      gender: value("gender"),
      guardian: { name: value("guardian.name"), relation: value("guardian.relation"), phone: toE164(value("guardian.phone")), cnic: toCnic(value("guardian.cnic")) },
      bFormNumber: toCnic(value("bFormNumber")),
      address: value("address"),
      familyStatus: value("familyStatus"),
      ...(value("familyStatusNote") && { familyStatusNote: value("familyStatusNote") }),
      siblings: { count: Number(value("siblings.count")), studentIds: siblingIds },
    };
    setSaving(true);
    setProblem(undefined);
    const unchanged = student && JSON.stringify(body) === JSON.stringify(detailsOf(student));
    const answer = unchanged
      ? { ok: true as const, data: student }
      : student
        ? await send(`/api/students/${student.studentId}`, { ...body, expectedVersion: student.version }, idempotencyKey, "PUT")
        : await send("/api/students", body, idempotencyKey);
    if (!answer.ok) {
      setSaving(false);
      if (answer.status === 401) return;
      if (Object.keys(answer.fields).length) {
        const next: FieldErrors = {};
        for (const [field, message] of Object.entries(answer.fields)) next[field] = messageFor(field, message);
        setErrors(next);
        setProblem("Check the marked fields.");
        const first = Object.keys(labels).find((name) => next[name]);
        form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
        return;
      }
      setStale(isStale(answer));
      setProblem(answer.message);
      return;
    }
    const note: Record<string, string> = { studentId: answer.data.studentId, admissionNumber: student?.admissionNumber ?? answer.data.admissionNumber, name: `${body.firstName} ${body.lastName}` };
    const classId = value("classId");
    const chosen = year?.classes.find((c) => c.classId === classId);
    if (chosen && classId !== enrollment?.classId) {
      const placed = enrollment
        ? await send(`/api/enrollments/${enrollment.enrollmentId}`, { classId, expectedVersion: enrollment.version }, enrollKey, "PUT")
        : await send("/api/enrollments", { studentId: note.studentId, classId }, enrollKey);
      if (placed.ok) note.enrolledIn = gradeLabel(chosen.grade);
      else note.enrollProblem = placed.message;
    }
    setSaving(false);
    navigate("/students", { state: student ? { updated: note } : { registered: note } });
  }

  const clear = (name: string) => errors[name] && setErrors(({ [name]: _, ...rest }) => rest);
  const line = (name: string, label: string, extra: object = {}) => (
    <TextInput name={name} label={label} error={errors[name]} onChange={() => clear(name)} classNames={{ input: "field-input" }} required withAsterisk={false} {...extra} />
  );

  return (
    <div className="register">
      <header className="page-head">
        <div>
          <Title order={1}>{student ? "Edit student" : "Register student"}</Title>
          {student ? (
            <Text className="lead">
              <span className="adm-mark">{student.admissionNumber}</span> The admission number does not change.
            </Text>
          ) : (
            <Text className="lead">The admission number is given when you register.</Text>
          )}
        </div>
      </header>
      {problem && (
        <div className="problem" role="alert">
          <Text>{problem}</Text>
          {stale && (
            <Button variant="default" size="compact-sm" onClick={() => location.reload()}>
              Reload
            </Button>
          )}
        </div>
      )}
      <form ref={form} onSubmit={submit} className="panel form-panel">
        <fieldset className="entry">
          <legend>Student</legend>
          <Text className="entry-hint">Write the names as on the B-form or birth certificate.</Text>
          <div className="pair">
            {line("firstName", "First name", { autoFocus: true, autoComplete: "off", defaultValue: student?.firstName })}
            {line("lastName", "Last name", { autoComplete: "off", defaultValue: student?.lastName })}
          </div>
          {line("fatherName", "Father name", {
            autoComplete: "off",
            value: fatherName,
            onChange: (event: { currentTarget: HTMLInputElement }) => {
              clear("fatherName");
              setFatherName(event.currentTarget.value);
            },
          })}
          <div className="pair">
            {line("dateOfBirth", "Date of birth", { type: "date", ...(student ? { defaultValue: student.dateOfBirth } : birthDateLimits(todayInPakistan(new Date()))) })}
            <Radio.Group name="gender" label="Gender" defaultValue={student?.gender} error={errors.gender} onChange={() => clear("gender")} required withAsterisk={false}>
              <Group gap="lg" mt={10}>
                <Radio value="female" label="Female" />
                <Radio value="male" label="Male" />
              </Group>
            </Radio.Group>
          </div>
          {line("bFormNumber", "B-Form number", {
            inputMode: "numeric",
            placeholder: "35202-1234567-8",
            autoComplete: "off",
            description: "The 13 digits on the B-Form (child registration certificate).",
            defaultValue: student?.bFormNumber ?? undefined,
          })}
          <NativeSelect
            key={year?.academicYearId}
            name="classId"
            label="Class"
            defaultValue={enrollment?.classId}
            description={
              year === null || (year && year.classes.length === 0) ? (
                <>
                  No classes yet. Open them on the <Link to="/classes">Classes</Link> page, or enroll the student later.
                </>
              ) : year ? (
                enrollment ? `Classes of ${year.name}.` : `Classes of ${year.name}. The student is enrolled right after you save.`
              ) : undefined
            }
            data={[
              ...(enrollment ? [] : [{ value: "", label: "Choose later" }]),
              ...classGroups(year?.classes ?? []),
            ]}
            disabled={!year || year.classes.length === 0}
            classNames={{ input: "field-input" }}
          />
        </fieldset>
        <fieldset className="entry">
          <legend>Guardian</legend>
          <Text className="entry-hint">The office uses this phone number to reach the family.</Text>
          {line("guardian.name", "Guardian name", {
            autoComplete: "off",
            value: shownGuardian,
            description: linked && relation === "father" ? "Filled in from the father name. Change it if someone else is the guardian." : undefined,
            onChange: (event: { currentTarget: HTMLInputElement }) => {
              clear("guardian.name");
              setLinked(false);
              setGuardianName(event.currentTarget.value);
            },
          })}
          <div className="pair">
            <NativeSelect
              name="guardian.relation"
              label="Relation"
              data={[
                { value: "father", label: "Father" },
                { value: "mother", label: "Mother" },
                { value: "guardian", label: "Other guardian" },
              ]}
              error={errors["guardian.relation"]}
              value={relation}
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (next === "father" && !guardianName.trim()) setLinked(true);
                if (next !== "father" && linked) {
                  setGuardianName(fatherName);
                  setLinked(false);
                }
                setRelation(next);
              }}
              classNames={{ input: "field-input" }}
              required
              withAsterisk={false}
            />
            {line("guardian.phone", "Phone", { type: "tel", inputMode: "tel", placeholder: "0300 1234567", autoComplete: "off", defaultValue: student && toLocal(student.guardian.phone) })}
          </div>
          {line("guardian.cnic", "Guardian CNIC", { inputMode: "numeric", placeholder: "35202-1234567-8", autoComplete: "off", defaultValue: student?.guardian.cnic ?? undefined })}
          <Textarea
            name="address"
            label="Home address"
            placeholder="House, street, area, city"
            maxLength={300}
            autosize
            minRows={2}
            defaultValue={student?.address ?? undefined}
            error={errors.address}
            onChange={() => clear("address")}
            classNames={{ input: "field-input" }}
            required
            withAsterisk={false}
          />
        </fieldset>
        <fieldset className="entry">
          <legend>Family</legend>
          <Text className="entry-hint">The office uses this for orphan support and sibling fees.</Text>
          <div className="pair">
            <NativeSelect
              name="familyStatus"
              label="Family status"
              data={[...(student?.familyStatus ? [] : [{ value: "", label: "Choose", disabled: true }]), ...FAMILY_STATUSES.map(([value, label]) => ({ value, label }))]}
              defaultValue={student?.familyStatus ?? ""}
              error={errors.familyStatus}
              onChange={() => clear("familyStatus")}
              classNames={{ input: "field-input" }}
              required
              withAsterisk={false}
            />
            {line("siblings.count", "Brothers and sisters", {
              type: "number",
              min: 0,
              max: 20,
              inputMode: "numeric",
              description: "All of them, also those not at this school.",
              inputWrapperOrder: ["label", "input", "description", "error"],
              defaultValue: student?.siblings?.count ?? undefined,
            })}
          </div>
          <Textarea
            name="familyStatusNote"
            label="Note (optional)"
            description="For example, who looks after the student."
            maxLength={500}
            autosize
            minRows={2}
            defaultValue={student?.familyStatusNote ?? undefined}
            error={errors.familyStatusNote}
            onChange={() => clear("familyStatusNote")}
            classNames={{ input: "field-input" }}
          />
          <MultiSelect
            name="siblings.studentIds"
            label="Siblings in this school"
            description="Search by name or admission number. Leave empty when none study here."
            data={others.map((s) => ({ value: s.studentId, label: studentLabel(s) }))}
            value={siblingIds}
            onChange={(ids) => {
              clear("siblings.studentIds");
              setSiblingIds(ids);
            }}
            searchable
            clearable
            nothingFoundMessage="No student with this name or number."
            maxValues={20}
            error={errors["siblings.studentIds"]}
            classNames={{ input: "field-input" }}
          />
        </fieldset>
        <Group gap="sm" className="form-actions">
          <Button type="submit" loading={saving}>
            {student ? "Save changes" : "Register student"}
          </Button>
          <Button component={Link} to="/students" variant="default">
            Cancel
          </Button>
        </Group>
      </form>
    </div>
  );
}
