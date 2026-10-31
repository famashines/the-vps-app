import { Button, Group, Modal, NativeSelect, Text } from "@mantine/core";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { classGroups, gradeLabel, send, type Year } from "../school.ts";

export type Enrollment = { enrollmentId: string; version: number; academicYearId: string; academicYearName: string; classId: string; grade: string };

export function EnrollDialog({ student, onClose, onEnrolled }: {
  student: { studentId: string; name: string } | undefined;
  onClose: () => void;
  onEnrolled: (enrollment: Enrollment) => void;
}) {
  const [years, setYears] = useState<Year[]>();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const select = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!student) return;
    setTitle(`Enroll ${student.name}`);
    setYears(undefined);
    setProblem(undefined);
    setKey(crypto.randomUUID());
    fetch("/api/academic-years")
      .then(async (r) => setYears(r.ok ? await r.json() : []))
      .catch(() => setYears([]));
  }, [student]);

  const classes = (years ?? []).flatMap((y) => y.classes.map((c) => ({ ...c, year: y })));

  useEffect(() => {
    if (student && classes.length) select.current?.focus();
  }, [student, classes.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const classId = String(new FormData(event.currentTarget).get("classId"));
    const chosen = classes.find((c) => c.classId === classId);
    if (!student || !chosen) return;
    setSaving(true);
    const answer = await send("/api/enrollments", { studentId: student.studentId, classId }, key);
    setSaving(false);
    if (!answer.ok) return setProblem(answer.message);
    onEnrolled({ enrollmentId: answer.data.enrollmentId, version: 1, academicYearId: chosen.year.academicYearId, academicYearName: chosen.year.name, classId, grade: chosen.grade });
  }

  return (
    <Modal opened={!!student} onClose={onClose} title={title} centered radius="md">
      {years === undefined ? (
        <Text className="state-text">Loading classes.</Text>
      ) : classes.length === 0 ? (
        <>
          <Text className="state-text">No classes yet. Open a school year and its classes first.</Text>
          <Button component={Link} to="/classes" mt="md" onClick={onClose}>
            Go to classes
          </Button>
        </>
      ) : (
        <form onSubmit={submit}>
          <NativeSelect
            name="classId"
            label="Class"
            ref={select}
            classNames={{ input: "field-input" }}
            data={(years ?? []).flatMap((y) =>
              classGroups(y.classes, (c) => `${gradeLabel(c.grade)} (${c.students} ${c.students === 1 ? "student" : "students"})`, `, ${y.name}`),
            )}
          />
          {problem && (
            <Text className="error" role="alert" mt="sm">
              {problem}
            </Text>
          )}
          <Group gap="sm" mt="lg">
            <Button type="submit" loading={saving}>
              Enroll
            </Button>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
          </Group>
        </form>
      )}
    </Modal>
  );
}
