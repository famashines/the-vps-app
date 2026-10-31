import { Button, Progress, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Icon } from "../icons";
import { currentYear, gradeLabel, type Year } from "../school.ts";
import { signInUrl } from "../session";
import type { Student } from "./Students";

type State = { status: "loading" } | { status: "failed" } | { status: "loaded"; students: Student[]; years: Year[] };

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

const today = () => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const actions = [
  { to: "/students/new", icon: "add", title: "Register a student", text: "The admission number is given on save." },
  { to: "/students", icon: "students", title: "Find a student", text: "Filter by name, father name or phone." },
  { to: "/classes", icon: "classes", title: "Set up classes", text: "Open a school year and a class for each grade." },
] as const;

const coming = ["Fee reports and defaulters"];

async function getJson(path: string) {
  const response = await fetch(path);
  if (response.status === 401) location.assign(signInUrl());
  if (!response.ok) throw new Error(path);
  return response.json();
}

function YearStatus({ students, years }: { students: Student[]; years: Year[] }) {
  const year = currentYear(years);
  if (!year)
    return (
      <>
        <Title order={2} className="panel-title">
          No school year yet
        </Title>
        <Text className="panel-text">Open the first school year and its classes. Then students can be enrolled.</Text>
        <Button component={Link} to="/classes" mt="md" variant="light">
          Open a school year
        </Button>
      </>
    );
  const inYear = students.filter((s) => s.enrollments.some((e) => e.academicYearId === year.academicYearId)).length;
  const waiting = students.length - inYear;
  const share = students.length ? Math.round((inYear / students.length) * 100) : 0;
  return (
    <>
      <div className="status-head">
        <Title order={2} className="panel-title">
          School year {year.name}
        </Title>
        <Text className="panel-text">{plural(year.classes.length, "class", "classes")}</Text>
      </div>
      <p className="status-line">
        <strong>{inYear}</strong> of {plural(students.length, "student is", "students are")} in a class.
      </p>
      <Progress value={share} size="lg" radius="xl" aria-label={`${share}% of students are in a class`} className="status-bar" />
      {waiting > 0 ? (
        <div className="status-todo">
          <Text>
            {plural(waiting, "student needs", "students need")} a class for {year.name}.
          </Text>
          <Button component={Link} to="/students" variant="light" size="compact-md" rightSection={<Icon name="arrow" size={16} />}>
            Enroll
          </Button>
        </div>
      ) : (
        students.length > 0 && (
          <Text className="status-done">
            <Icon name="check" size={16} /> Every student is in a class.
          </Text>
        )
      )}
    </>
  );
}

function Recent({ students }: { students: Student[] }) {
  const recent = [...students].sort((a, b) => b.admissionNumber.localeCompare(a.admissionNumber)).slice(0, 5);
  if (recent.length === 0)
    return (
      <Text className="panel-text recent-empty">
        No students yet. <Link to="/students/new">Register the first student.</Link>
      </Text>
    );
  return (
    <ul className="recent">
      {recent.map((s) => (
        <li key={s.studentId}>
          <Link to={`/students/${s.studentId}`} className="recent-row">
            <span className="recent-adm">{s.admissionNumber}</span>
            <span className="recent-name">
              {s.firstName} {s.lastName}
            </span>
            <span className={s.enrollments[0] ? "recent-class" : "recent-class none"}>
              {s.enrollments[0] ? gradeLabel(s.enrollments[0].grade) : "No class"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard({ name }: { name: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    Promise.all([getJson("/api/students"), getJson("/api/academic-years")])
      .then(([students, years]) => setState({ status: "loaded", students, years }))
      .catch(() => setState({ status: "failed" }));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <Title order={1}>
            {greeting()}, {name.split(" ")[0]}
          </Title>
          <Text className="lead">{today()}</Text>
        </div>
        <Button component={Link} to="/students/new" leftSection={<Icon name="add" size={16} />}>
          Register student
        </Button>
      </header>
      <div className="dash">
        <div className="dash-main">
          <section className="panel" aria-live="polite">
            {state.status === "loading" && <Text className="state-text">Loading the school year.</Text>}
            {state.status === "failed" && (
              <Text className="error" role="alert">
                The figures did not load. Reload the page to try again.
              </Text>
            )}
            {state.status === "loaded" && <YearStatus students={state.students} years={state.years} />}
          </section>
          <section className="panel" aria-labelledby="recent">
            <div className="panel-head">
              <Title order={2} id="recent" className="panel-title">
                Recently registered
              </Title>
              <Link to="/students" className="panel-link">
                All students
              </Link>
            </div>
            {state.status === "loaded" && <Recent students={state.students} />}
          </section>
        </div>
        <div className="dash-side">
          <section className="panel" aria-labelledby="start-here">
            <Title order={2} id="start-here" className="panel-title">
              Start here
            </Title>
            <ul className="action-list">
              {actions.map((action) => (
                <li key={action.to}>
                  <Link to={action.to} className="action">
                    <span className="action-icon">
                      <Icon name={action.icon} size={18} />
                    </span>
                    <span>
                      <span className="action-title">{action.title}</span>
                      <span className="action-text">{action.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel panel-quiet" aria-labelledby="coming-next">
            <Title order={2} id="coming-next" className="panel-title">
              Coming next
            </Title>
            <ul className="coming-list">
              {coming.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
