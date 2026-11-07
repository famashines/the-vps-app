import { Avatar, Button, FileButton, Group, MultiSelect, NativeSelect, Radio, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { cnicAsTyped, toCnic } from "../cnic.ts";
import { capitalizeWords } from "../names.ts";
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
  admissionDate: "Admission date",
  gender: "Gender",
  bFormNumber: "B-Form number",
  previousSchoolName: "Previous school name",
  previousClass: "Previous class",
  "guardian.name": "Guardian name",
  "guardian.relation": "Relation",
  "guardian.cnic": "Guardian CNIC",
  "guardian.phone": "Phone No 1",
  "guardian.phone2": "Phone No 2",
  address: "Home address",
  familyStatus: "Family status",
  "siblings.count": "Brothers and sisters",
  familyStatusNote: "Note",
  "siblings.studentIds": "Siblings in this school",
};

const messageFor = (field: string, message: string) => {
  if (/^[A-Z]/.test(message)) return message;
  if (field === "guardian.phone" || field === "guardian.phone2") return "Enter a mobile number, for example 0300 1234567.";
  if (field === "bFormNumber" || field === "guardian.cnic") return "Enter the 13 digits, for example 35202-1234567-8.";
  if (field === "dateOfBirth") return message.includes("years old") ? "The student must be 2 to 25 years old." : "Enter a real date.";
  if (field === "admissionDate") return "Enter a real date.";
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
  admissionDate: s.admissionDate,
  gender: s.gender,
  guardian: { name: s.guardian.name, relation: s.guardian.relation, phone: s.guardian.phone, ...(s.guardian.phone2 && { phone2: s.guardian.phone2 }), cnic: s.guardian.cnic },
  bFormNumber: s.bFormNumber,
  address: s.address,
  familyStatus: s.familyStatus,
  ...(s.familyStatusNote && { familyStatusNote: s.familyStatusNote }),
  siblings: s.siblings,
  ...(s.previousSchoolName && { previousSchoolName: s.previousSchoolName }),
  ...(s.previousClass && { previousClass: s.previousClass }),
});

const studentLabel = (s: Student) => `${s.firstName} ${s.lastName} (${s.admissionNumber})`;

function retype(input: HTMLInputElement, format: (value: string) => string) {
  const caret = format(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
  const next = format(input.value);
  if (next === input.value) return;
  input.value = next;
  input.setSelectionRange(caret, caret);
}

type Photo = { preview: string; file: Blob };

async function toPhoto(file: File, longest = 480): Promise<Photo> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, longest / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("no picture");
  return { preview: canvas.toDataURL("image/jpeg", 0.85), file: blob };
}

async function uploadPhoto(studentId: string, photo: Photo) {
  try {
    const response = await fetch(`/api/students/${studentId}/photo`, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: photo.file });
    if (response.ok) return undefined;
    return ((await response.json().catch(() => ({}))) as { error?: string }).error ?? "The photo was not saved.";
  } catch {
    return "The photo was not saved, because the connection failed.";
  }
}

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
  const [photo, setPhoto] = useState<Photo>();
  const today = todayInPakistan(new Date());

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
      firstName: capitalizeWords(value("firstName")),
      lastName: capitalizeWords(value("lastName")),
      fatherName: capitalizeWords(value("fatherName")),
      dateOfBirth: value("dateOfBirth"),
      admissionDate: value("admissionDate"),
      gender: value("gender"),
      guardian: { name: capitalizeWords(value("guardian.name")), relation: value("guardian.relation"), phone: toE164(value("guardian.phone")), ...(value("guardian.phone2") && { phone2: toE164(value("guardian.phone2")) }), cnic: toCnic(value("guardian.cnic")) },
      bFormNumber: toCnic(value("bFormNumber")),
      address: value("address"),
      familyStatus: value("familyStatus"),
      ...(value("familyStatusNote") && { familyStatusNote: value("familyStatusNote") }),
      siblings: { count: Number(value("siblings.count")), studentIds: siblingIds },
      ...(value("previousSchoolName") && { previousSchoolName: value("previousSchoolName") }),
      ...(value("previousClass") && { previousClass: value("previousClass") }),
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
    if (photo) {
      const photoProblem = await uploadPhoto(note.studentId, photo);
      if (photoProblem) note.photoProblem = photoProblem;
    }
    setSaving(false);
    navigate("/students", { state: student ? { updated: note } : { registered: note } });
  }

  const clear = (name: string) => errors[name] && setErrors(({ [name]: _, ...rest }) => rest);
  const typed = (name: string, format: (value: string) => string, set?: (value: string) => void) => ({
    onChange: (event: { currentTarget: HTMLInputElement }) => {
      clear(name);
      retype(event.currentTarget, format);
      set?.(event.currentTarget.value);
    },
  });
  const nameField = (name: string, set?: (value: string) => void) => ({ autoComplete: "off", autoCapitalize: "words", ...typed(name, capitalizeWords, set) });
  const cnicField = (name: string) => ({ inputMode: "numeric", placeholder: "35202-1234567-8", autoComplete: "off", maxLength: 15, ...typed(name, cnicAsTyped) });
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
          <Group gap="md">
            <Avatar
              src={photo?.preview ?? (student?.hasPhoto ? `/api/students/${student.studentId}/photo` : null)}
              name={student ? `${student.firstName} ${student.lastName}` : undefined}
              color="accent"
              size={88}
              radius="lg"
              alt="Student photo"
            />
            <div>
              <Text fw={500}>Photo (optional)</Text>
              <Text size="sm" c="var(--md-on-surface-variant)">A clear photo of the face. It is made smaller before it is saved.</Text>
              <Group gap="xs" mt={6}>
                <FileButton
                  accept="image/*"
                  onChange={(file) => {
                    setErrors(({ photo: _, ...rest }) => rest);
                    if (file) toPhoto(file).then(setPhoto, () => setErrors((e) => ({ ...e, photo: "This file is not a picture. Choose a JPEG or PNG photo." })));
                  }}
                >
                  {(props) => (
                    <Button variant="default" size="compact-sm" {...props}>
                      {photo || student?.hasPhoto ? "Change photo" : "Choose photo"}
                    </Button>
                  )}
                </FileButton>
                {photo && (
                  <Button variant="subtle" size="compact-sm" onClick={() => setPhoto(undefined)}>
                    Undo
                  </Button>
                )}
              </Group>
              {errors.photo && (
                <Text role="alert" c="red" size="sm" mt={4}>
                  {errors.photo}
                </Text>
              )}
            </div>
          </Group>
          <div className="pair">
            {line("firstName", "First name", { autoFocus: true, defaultValue: student?.firstName, ...nameField("firstName") })}
            {line("lastName", "Last name", { defaultValue: student?.lastName, ...nameField("lastName") })}
          </div>
          {line("fatherName", "Father name", { value: fatherName, ...nameField("fatherName", setFatherName) })}
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
            ...cnicField("bFormNumber"),
            description: "The 13 digits on the B-Form (child registration certificate).",
            defaultValue: student?.bFormNumber ?? undefined,
          })}
          <div className="pair">
            {line("admissionDate", "Admission date", { type: "date", max: today, defaultValue: student?.admissionDate ?? today })}
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
          </div>
          <div className="pair">
            {line("previousSchoolName", "Previous school name (optional)", { required: false, maxLength: 200, autoComplete: "off", defaultValue: student?.previousSchoolName ?? undefined })}
            {line("previousClass", "Previous class (optional)", { required: false, maxLength: 50, autoComplete: "off", defaultValue: student?.previousClass ?? undefined })}
          </div>
        </fieldset>
        <fieldset className="entry">
          <legend>Guardian</legend>
          <Text className="entry-hint">The office uses these phone numbers to reach the family.</Text>
          {line("guardian.name", "Guardian name", {
            value: shownGuardian,
            description: linked && relation === "father" ? "Filled in from the father name. Change it if someone else is the guardian." : undefined,
            ...nameField("guardian.name", (value) => {
              setLinked(false);
              setGuardianName(value);
            }),
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
            {line("guardian.cnic", "Guardian CNIC", { ...cnicField("guardian.cnic"), defaultValue: student?.guardian.cnic ?? undefined })}
          </div>
          <div className="pair">
            {line("guardian.phone", "Phone No 1", { type: "tel", inputMode: "tel", placeholder: "0300 1234567", autoComplete: "off", defaultValue: student && toLocal(student.guardian.phone) })}
            {line("guardian.phone2", "Phone No 2 (optional)", { required: false, type: "tel", inputMode: "tel", placeholder: "0321 1234567", autoComplete: "off", defaultValue: student?.guardian.phone2 ? toLocal(student.guardian.phone2) : undefined })}
          </div>
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
