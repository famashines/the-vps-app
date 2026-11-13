import { Button, Checkbox, NativeSelect, Table, Text, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useState } from "react";
import { EXAM_KINDS, examAverage, labelOf, type Exam } from "../campus.ts";
import { Icon } from "../icons";
import { classGroups, currentYear, gradeLabel, showDate, todayInPakistan, type Year } from "../school.ts";
import { ButtonGroup } from "./cards";
import { firstBad, FormModal, Notice, PageState, useLoad, type FormRequest } from "./campusParts";
import type { Student } from "./Students";

const FILTERS = { All: undefined, "Monthly tests": "monthly-test", Exams: "exam" } as const;

export const gradeOfClass = (years: Year[], classId: string) => {
  const grade = years.flatMap((y) => y.classes).find((c) => c.classId === classId)?.grade;
  return grade ? gradeLabel(grade) : "Class not found";
};
export const averageText = (exam: Exam) => {
  const average = examAverage(exam);
  return average === undefined ? "No results" : `${average}%`;
};

export function Exams() {
  const today = todayInPakistan(new Date());
  const [exams, load] = useLoad<Exam[]>("/api/exams");
  const [years] = useLoad<Year[]>("/api/academic-years");
  const [students] = useLoad<Student[]>("/api/students");
  const [filter, setFilter] = useState<keyof typeof FILTERS>("All");
  const [scheduling, setScheduling] = useState(false);
  const [marking, setMarking] = useState<Exam>();
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string>();

  const head = (
    <header className="page-head">
      <div>
        <Title order={1}>Tests and exams</Title>
        <Text className="lead">Monthly tests and exams of each class and subject, with the marks of each student.</Text>
      </div>
      <Button leftSection={<Icon name="add" size={16} />} onClick={() => setScheduling(true)}>
        Schedule test or exam
      </Button>
    </header>
  );
  const bad = firstBad(exams, years, students);
  if (bad || typeof exams === "string" || typeof years === "string" || typeof students === "string")
    return (
      <div className="account">
        {head}
        <PageState state={bad ?? "loading"} what="the tests and exams" />
      </div>
    );

  const classes = currentYear(years)?.classes ?? [];
  const shown = exams.filter((e) => !FILTERS[filter] || e.kind === FILTERS[filter]);
  const roster = marking
    ? students
        .filter((s) => marking.results.some((r) => r.studentId === s.studentId) || (s.enrollments.some((e) => e.classId === marking.classId) && (!s.leftOn || s.leftOn >= marking.heldOn)))
        .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
    : [];
  const open = (exam: Exam) => {
    setAbsent(Object.fromEntries(exam.results.filter((r) => r.marks === null).map((r) => [r.studentId, true])));
    setMarking(exam);
  };

  return (
    <div className="account">
      {head}
      <Notice text={notice} />
      {exams.length === 0 ? (
        <div className="panel state">
          <Text className="state-title">No test or exam yet.</Text>
          <Text className="state-text">Schedule the first monthly test or exam of a class.</Text>
        </div>
      ) : (
        <>
          <div className="sheet-tools">
            <ButtonGroup label="Filter by kind" value={filter} onChange={(next) => setFilter(next as keyof typeof FILTERS)} data={Object.keys(FILTERS)} />
          </div>
          <section className="panel panel-flush" aria-label="Tests and exams">
            {shown.length === 0 ? (
              <Text className="state-text ledger-empty">Nothing of this kind yet.</Text>
            ) : (
              <Table.ScrollContainer minWidth={720} type="native">
                <Table className="ruled" withRowBorders={false}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Day</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Class</Table.Th>
                      <Table.Th>Subject</Table.Th>
                      <Table.Th className="money">Total marks</Table.Th>
                      <Table.Th className="money">Class average</Table.Th>
                      <Table.Th className="row-action">
                        <VisuallyHidden>Actions</VisuallyHidden>
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {shown.map((e) => (
                      <Table.Tr key={e.examId}>
                        <Table.Td>{showDate(e.heldOn)}</Table.Td>
                        <Table.Td className="ledger-entry">
                          {e.name}
                          <span className="entry-note">{labelOf(EXAM_KINDS, e.kind)}</span>
                        </Table.Td>
                        <Table.Td>{gradeOfClass(years, e.classId)}</Table.Td>
                        <Table.Td>{e.subject}</Table.Td>
                        <Table.Td className="money">{e.totalMarks}</Table.Td>
                        <Table.Td className="money">{averageText(e)}</Table.Td>
                        <Table.Td className="row-action">
                          <Button variant="subtle" size="compact-sm" aria-label={`Results of ${e.name}, ${e.subject}`} onClick={() => open(e)}>
                            {e.results.length ? "Change results" : "Enter results"}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </section>
        </>
      )}
      <FormModal
        title="Schedule test or exam"
        opened={scheduling}
        onClose={() => setScheduling(false)}
        submit="Schedule"
        request={(value): FormRequest => {
          const totalMarks = Number(value("totalMarks"));
          if (!/^\d{1,4}$/.test(value("totalMarks")) || totalMarks < 1 || totalMarks > 1000) return { errors: { totalMarks: "Enter a whole number from 1 to 1000." } };
          if (!value("classId")) return { errors: { classId: "Choose a class." } };
          return { path: "/api/exams", body: { name: value("name"), kind: value("kind"), classId: value("classId"), subject: value("subject"), heldOn: value("heldOn"), totalMarks } };
        }}
        onDone={(data) => {
          setScheduling(false);
          setNotice(`Scheduled ${data.name}, ${data.subject}.`);
          void load();
        }}
      >
        {(field) => (
          <>
            <TextInput name="name" label="Name" placeholder="November monthly test" maxLength={200} autoComplete="off" data-autofocus required withAsterisk={false} {...field("name")} />
            <div className="pair">
              <NativeSelect name="kind" label="Kind" data={EXAM_KINDS.map(([value, label]) => ({ value, label }))} {...field("kind")} />
              <NativeSelect name="classId" label="Class" data={[{ value: "", label: "Choose", disabled: true }, ...classGroups(classes)]} defaultValue="" required withAsterisk={false} {...field("classId")} />
            </div>
            <TextInput name="subject" label="Subject" placeholder="Mathematics" maxLength={100} autoComplete="off" required withAsterisk={false} {...field("subject")} />
            <div className="pair">
              <TextInput name="heldOn" label="Day" type="date" defaultValue={today} required withAsterisk={false} {...field("heldOn")} />
              <TextInput name="totalMarks" label="Total marks" inputMode="numeric" autoComplete="off" placeholder="50" required withAsterisk={false} {...field("totalMarks")} />
            </div>
          </>
        )}
      </FormModal>
      <FormModal
        title={marking ? `${marking.name}, ${marking.subject}` : "Results"}
        opened={!!marking}
        onClose={() => setMarking(undefined)}
        submit="Save results"
        request={(value): FormRequest => {
          const results = roster.map((s) => ({ studentId: s.studentId, text: value(`marks.${s.studentId}`), away: !!absent[s.studentId] }));
          const wrong = results.find((r) => !r.away && (!/^\d{1,4}$/.test(r.text) || Number(r.text) > marking!.totalMarks));
          if (wrong) return { errors: { results: `Enter marks from 0 to ${marking!.totalMarks} for each student, or tick Absent.`, [`marks.${wrong.studentId}`]: "Check" } };
          return { path: `/api/exams/${marking!.examId}/results`, method: "PUT", body: { expectedVersion: marking!.version, results: results.map((r) => ({ studentId: r.studentId, marks: r.away ? null : Number(r.text) })) } };
        }}
        onDone={() => {
          setNotice(`Saved the results of ${marking?.name}, ${marking?.subject}.`);
          setMarking(undefined);
          void load();
        }}
      >
        {(field) =>
          marking &&
          (roster.length === 0 ? (
            <Text className="panel-text">No student is in {gradeOfClass(years, marking.classId)}. Enroll the students first.</Text>
          ) : (
            <>
              <Text className="panel-text">
                {gradeOfClass(years, marking.classId)}, {showDate(marking.heldOn)}. Marks out of {marking.totalMarks}.
              </Text>
              {field("results").error && (
                <Text className="problem" role="alert">
                  {field("results").error}
                </Text>
              )}
              <ul className="sheet">
                {roster.map((s) => {
                  const saved = marking.results.find((r) => r.studentId === s.studentId)?.marks;
                  const name = `${s.firstName} ${s.lastName}`;
                  return (
                    <li key={s.studentId}>
                      <div className="sheet-person">
                        <span className="row-name">{name}</span>
                        <span className="row-note">{s.admissionNumber}</span>
                      </div>
                      <div className="marks">
                        <TextInput
                          name={`marks.${s.studentId}`}
                          aria-label={`Marks of ${name}`}
                          inputMode="numeric"
                          autoComplete="off"
                          defaultValue={saved ?? undefined}
                          disabled={!!absent[s.studentId]}
                          error={!!field(`marks.${s.studentId}`).error}
                          onChange={() => {
                            field(`marks.${s.studentId}`).onChange();
                            field("results").onChange();
                          }}
                          classNames={{ input: "field-input" }}
                        />
                        <Checkbox label="Absent" aria-label={`${name} was absent`} checked={!!absent[s.studentId]} onChange={(event) => setAbsent((a) => ({ ...a, [s.studentId]: event.currentTarget.checked }))} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ))
        }
      </FormModal>
    </div>
  );
}
