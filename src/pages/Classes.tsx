import { Button, Group, Modal, Text, TextInput, Title } from "@mantine/core";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Icon } from "../icons";
import { gradeLabel, isStale, schoolYearOf, send, showDate, STAGES, yearStarting, type Answer, type Year } from "../school.ts";
import { signInUrl } from "../session";

type State = { status: "loading" } | { status: "failed" } | { status: "loaded"; years: Year[] };

const fieldNames: Record<string, string> = { name: "Name", startsOn: "Starts on", endsOn: "Ends on" };

function useKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  return [key, () => setKey(crypto.randomUUID())] as const;
}

function OpenYear({ suggested, onOpened }: { suggested: { name: string; startsOn: string; endsOn: string }; onOpened: () => void }) {
  const [key, nextKey] = useKey();
  const [problem, setProblem] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = { name: String(data.get("name")).trim(), startsOn: String(data.get("startsOn")), endsOn: String(data.get("endsOn")) };
    setSaving(true);
    const answer = await send("/api/academic-years", body, key);
    setSaving(false);
    if (answer.ok) {
      nextKey();
      setProblem(undefined);
      setFields({});
      onOpened();
      return;
    }
    setFields(answer.fields);
    setProblem(Object.keys(answer.fields).length ? "Check the marked fields." : answer.message);
  }

  const error = (name: string) => (fields[name] ? `${fieldNames[name]} ${name === "name" ? "must look like 2026-27" : fields[name]}.` : undefined);

  return (
    <form className="panel year-form" onSubmit={submit} key={suggested.name}>
      <Title order={2} className="panel-title">
        Open a school year
      </Title>
      <Text className="panel-text">A school year runs from 1 April to 31 March. Change the dates if your school uses others.</Text>
      {problem && (
        <Text className="error" role="alert" mt="sm">
          {problem}
        </Text>
      )}
      <div className="year-fields">
        <TextInput name="name" label="Name" defaultValue={suggested.name} error={error("name")} classNames={{ input: "field-input" }} required withAsterisk={false} />
        <TextInput name="startsOn" label="Starts on" type="date" defaultValue={suggested.startsOn} error={error("startsOn")} classNames={{ input: "field-input" }} required withAsterisk={false} />
        <TextInput name="endsOn" label="Ends on" type="date" defaultValue={suggested.endsOn} error={error("endsOn")} classNames={{ input: "field-input" }} required withAsterisk={false} />
        <Button type="submit" loading={saving} className="year-submit">
          Open {suggested.name}
        </Button>
      </div>
    </form>
  );
}

function EditDialog({ title, opened, onClose, onSave, children }: {
  title: string;
  opened: boolean;
  onClose: () => void;
  onSave: (data: FormData, key: string) => Promise<Answer>;
  children: (fields: Record<string, string>) => ReactNode;
}) {
  const [key, nextKey] = useKey();
  const [answer, setAnswer] = useState<Answer>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) setAnswer(undefined);
  }, [opened]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await onSave(new FormData(event.currentTarget), key);
    setSaving(false);
    setAnswer(result);
    if (result.ok) nextKey();
  }

  const failed = answer && !answer.ok ? answer : undefined;
  const fields = failed?.fields ?? {};

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered radius="md">
      <form onSubmit={submit} className="edit-form">
        {children(fields)}
        {failed && !Object.keys(fields).length && (
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
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

function EditYear({ year, opened, onClose, onSaved }: { year: Year; opened: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <EditDialog
      title={`Edit ${year.name}`}
      opened={opened}
      onClose={onClose}
      onSave={async (data, key) => {
        const body = { name: String(data.get("name")).trim(), startsOn: String(data.get("startsOn")), endsOn: String(data.get("endsOn")), expectedVersion: year.version };
        const answer = await send(`/api/academic-years/${year.academicYearId}`, body, key, "PUT");
        if (answer.ok) onSaved();
        return answer;
      }}
    >
      {(fields) => (
        <>
          <TextInput name="name" label="Name" defaultValue={year.name} data-autofocus error={fields.name && "Name must look like 2026-27."} classNames={{ input: "field-input" }} required withAsterisk={false} />
          <div className="pair">
            <TextInput name="startsOn" label="Starts on" type="date" defaultValue={year.startsOn} error={fields.startsOn && "Enter a real date."} classNames={{ input: "field-input" }} required withAsterisk={false} />
            <TextInput name="endsOn" label="Ends on" type="date" defaultValue={year.endsOn} error={fields.endsOn && (fields.endsOn.startsWith("The") ? fields.endsOn : "Enter a real date.")} classNames={{ input: "field-input" }} required withAsterisk={false} />
          </div>
        </>
      )}
    </EditDialog>
  );
}

function OpenGrade({ year, grade, onDone }: { year: Year; grade: string; onDone: (text: string, ok: boolean) => void }) {
  const [key] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const label = gradeLabel(grade);

  async function open() {
    setSaving(true);
    const answer = await send("/api/classes", { academicYearId: year.academicYearId, grade }, key);
    setSaving(false);
    onDone(answer.ok ? `Opened ${label}.` : `${label} was not opened. ${answer.message}`, answer.ok);
  }

  return (
    <button type="button" className="grade grade-closed" onClick={open} disabled={saving} aria-label={`Open the class ${label} in ${year.name}`}>
      <span className="grade-name">{label}</span>
      <span className="grade-note">{saving ? "Opening" : "Open class"}</span>
    </button>
  );
}

function YearPanel({ year, onChanged }: { year: Year; onChanged: () => void }) {
  const [editingYear, setEditingYear] = useState(false);
  const [saved, setSaved] = useState<string>();
  const [failed, setFailed] = useState<string>();
  const students = year.classes.reduce((sum, c) => sum + c.students, 0);

  return (
    <section className="panel year" aria-labelledby={`year-${year.academicYearId}`}>
      <header className="year-head">
        <div>
          <Title order={2} className="panel-title" id={`year-${year.academicYearId}`}>
            {year.name}
          </Title>
          <Text className="panel-text">
            {showDate(year.startsOn)} to {showDate(year.endsOn)}
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap" className="year-tools">
          <Text className="year-count">
            {year.classes.length} {year.classes.length === 1 ? "class" : "classes"}, {students} {students === 1 ? "student" : "students"}
          </Text>
          <Button variant="subtle" size="compact-sm" onClick={() => setEditingYear(true)} aria-label={`Edit the school year ${year.name}`}>
            Edit year
          </Button>
        </Group>
      </header>
      {year.classes.length === 0 && <Text className="state-text board-empty">No classes yet. Open a class for each grade that the school teaches this year.</Text>}
      <dl className="board ladder">
        {STAGES.map(([stage, grades]) => (
          <div className="board-row" key={stage}>
            <dt>{stage}</dt>
            <dd>
              {grades.map((grade) => {
                const c = year.classes.find((x) => x.grade === grade);
                return c ? (
                  <Link to={`/classes/${c.classId}`} className="grade" key={grade}>
                    <span className="grade-name">{gradeLabel(grade)}</span>
                    <span className="grade-note">
                      {c.students} {c.students === 1 ? "student" : "students"}
                    </span>
                  </Link>
                ) : (
                  <OpenGrade
                    key={grade}
                    year={year}
                    grade={grade}
                    onDone={(text, ok) => {
                      setSaved(ok ? text : undefined);
                      setFailed(ok ? undefined : text);
                      if (ok) onChanged();
                    }}
                  />
                );
              })}
            </dd>
          </div>
        ))}
      </dl>
      {saved && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>{saved}</Text>
        </div>
      )}
      {failed && (
        <Text className="error" role="alert">
          {failed}
        </Text>
      )}
      <EditYear
        year={year}
        opened={editingYear}
        onClose={() => setEditingYear(false)}
        onSaved={() => {
          setEditingYear(false);
          setFailed(undefined);
          setSaved("Saved the school year.");
          onChanged();
        }}
      />
    </section>
  );
}

export function Classes() {
  const [state, setState] = useState<State>({ status: "loading" });
  const { removed } = (useLocation().state ?? {}) as { removed?: string };

  const load = useCallback(() => {
    fetch("/api/academic-years")
      .then(async (response) => {
        if (response.status === 401) return location.assign(signInUrl());
        setState(response.ok ? { status: "loaded", years: await response.json() } : { status: "failed" });
      })
      .catch(() => setState({ status: "failed" }));
  }, []);

  useEffect(load, [load]);

  const years = state.status === "loaded" ? state.years : [];
  const suggested = years.length ? yearStarting(Number(years[0].endsOn.slice(0, 4))) : schoolYearOf(new Date());

  return (
    <>
      <header className="page-head">
        <div>
          <Title order={1}>Classes</Title>
          <Text className="lead">One class for each grade in a school year. Open a class to see its students.</Text>
        </div>
      </header>
      {removed && (
        <div className="notice" role="status">
          <Icon name="check" />
          <Text>Removed {removed}.</Text>
        </div>
      )}
      {state.status === "loading" && <Text className="state-text">Loading school years.</Text>}
      {state.status === "failed" && (
        <div className="panel state">
          <Text className="state-title error" role="alert">
            The school years did not load.
          </Text>
          <Text className="state-text">Check the connection, then reload the page.</Text>
          <Button variant="default" mt="md" onClick={() => location.reload()}>
            Reload page
          </Button>
        </div>
      )}
      {state.status === "loaded" && (
        <div className="years">
          {years.length === 0 && (
            <div className="panel state">
              <Text className="state-title">No school year yet.</Text>
              <Text className="state-text">Open the first school year below. Then open its classes.</Text>
            </div>
          )}
          {years.map((year) => (
            <YearPanel key={year.academicYearId} year={year} onChanged={load} />
          ))}
          <OpenYear suggested={suggested} onOpened={load} />
        </div>
      )}
    </>
  );
}
