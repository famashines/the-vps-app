import { Text, Tooltip } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { activityText, admissionsByMonth, leavers, type Activity } from "../insights.ts";
import { roundUp, type overview } from "../overview.ts";
import { gradeLabel, showDate, todayInPakistan, type Year } from "../school.ts";
import { Card, CardState, getJson, hover, plural, TextLink } from "./cards";
import type { Student } from "./Students";

type Data = ReturnType<typeof overview<Student>>;

const monthName = (month: string, form: "short" | "long") =>
  new Intl.DateTimeFormat("en-GB", { month: form, ...(form === "long" && { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

export function StudentStrength({ data, students, year }: { data: Data; students: Student[]; year: Year }) {
  const today = todayInPakistan(new Date());
  const joined = students.filter((s) => s.admissionDate >= year.startsOn && s.admissionDate <= today).length;
  const rows = [
    ["Active students", data.active.length],
    ["Girls", data.girls],
    ["Boys", data.boys],
    ["In a class", data.inClass],
    ["Not in a class", data.noClass],
    [`Admitted in ${year.name}`, joined],
    [`Left in ${year.name}`, leavers(students, year.startsOn).length],
  ] as const;
  return (
    <Card title="Student strength" action={<TextLink to="/students">Students</TextLink>}>
      <ul className="rows">
        {rows.map(([name, value]) => (
          <li key={name}>
            <span>{name}</span>
            <b>{value}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AdmissionOverview({ students, year }: { students: Student[]; year: Year }) {
  const today = todayInPakistan(new Date());
  const months = admissionsByMonth(students, year.startsOn, today < year.startsOn ? year.startsOn : today);
  const total = months.reduce((sum, m) => sum + m.count, 0);
  const top = roundUp(Math.max(2, ...months.map((m) => m.count)));
  return (
    <Card title="Admission overview" action={<TextLink to="/students/new">Register</TextLink>}>
      {total === 0 ? (
        <Text className="card-text">No student has an admission date in {year.name} yet.</Text>
      ) : (
        <>
          <p className="card-lead">
            <strong>{total}</strong> {total === 1 ? "admission" : "admissions"} in {year.name}, {months.at(-1)!.count} this month
          </p>
          <div className="plot">
            <div className="plot-axis" aria-hidden="true">
              {[top, top / 2, 0].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <div className="plot-area">
              {months.map((m) => {
                const label = `${monthName(m.key, "long")}: ${plural(m.count, "admission", "admissions")}`;
                return (
                  <Tooltip key={m.key} label={label} withArrow events={hover}>
                    <span className="bar-col" tabIndex={0} role="img" aria-label={label}>
                      <i className="bar" style={{ height: `${(m.count / top) * 100}%` }} />
                    </span>
                  </Tooltip>
                );
              })}
            </div>
            <div className="plot-labels" aria-hidden="true">
              {months.map((m) => (
                <span key={m.key}>{monthName(m.key, "short")}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export function LeavingRecords({ students, year }: { students: Student[]; year: Year }) {
  const left = leavers(students, year.startsOn);
  return (
    <Card title="Student leaving records" action={<TextLink to="/students">Students</TextLink>}>
      {left.length === 0 ? (
        <Text className="card-text">No student left in {year.name}.</Text>
      ) : (
        <>
          <p className="card-lead">
            <strong>{left.length}</strong> left in {year.name}
          </p>
          <ul className="log">
            {left.slice(0, 5).map((s) => {
              const grade = s.enrollments.find((e) => e.academicYearId === year.academicYearId)?.grade;
              return (
                <li key={s.studentId}>
                  <Link to={`/students/${s.studentId}`} className="log-text">
                    {s.firstName} {s.lastName}
                  </Link>
                  <span className="log-note">
                    {showDate(s.leftOn)}
                    {grade ? `, ${gradeLabel(grade)}` : ""}
                    {s.leftReason ? `. ${s.leftReason}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

const SERVICE_NAMES: Record<string, string> = { admissions: "students", fees: "fees", campus: "staff and attendance" };
const timeOf = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(iso));

export function RecentActivity() {
  const [state, setState] = useState<{ events: Activity[]; missing: string[] } | "loading" | "failed">("loading");

  useEffect(() => {
    getJson("/api/activity").then(setState, () => setState("failed"));
  }, []);

  return (
    <Card title="Recent activity">
      {typeof state === "string" ? (
        <CardState state={state} what="the activity log" />
      ) : (
        <>
          {state.missing.length > 0 && (
            <Text className={state.events.length ? "card-text" : "error card-text"} role="status">
              The events of {state.missing.map((name) => SERVICE_NAMES[name] ?? name).join(" and ")} did not load.
            </Text>
          )}
          {state.events.length === 0 ? (
            state.missing.length === 0 && <Text className="card-text">Nothing is recorded yet.</Text>
          ) : (
            <ul className="log">
              {state.events.slice(0, 8).map((e) => (
                <li key={e.eventId}>
                  <span className="log-text">{activityText(e)}</span>
                  <span className="log-note">{timeOf(e.occurredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
