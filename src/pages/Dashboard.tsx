import { Avatar, Button, Text, Title, Tooltip } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { AccountSummary } from "../fees.ts";
import { Icon, type IconName } from "../icons";
import { feeParts, feesByStage, overview, roundUp, smoothLine, wavyRing } from "../overview.ts";
import { toLocal } from "../phone.ts";
import { feeReport, share } from "../report.ts";
import { currentYear, gradeLabel, type Year } from "../school.ts";
import { CampusCards } from "./CampusCards";
import { ButtonGroup, Card, compact, hover, getJson, plural, rs, rsShort, TextLink } from "./cards";
import { MoneyCards } from "./MoneyCards";
import { AdmissionOverview, LeavingRecords, RecentActivity, StudentStrength } from "./SchoolCards";
import type { Student } from "./Students";

type State = { status: "loading" } | { status: "failed" } | { status: "loaded"; students: Student[]; years: Year[]; accounts: AccountSummary[] | null };
type Data = ReturnType<typeof overview<Student>>;
type Report = ReturnType<typeof feeReport>;

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

const today = () => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
const shortGrade = (grade: string) => (grade === "playgroup" ? "PG" : grade.startsWith("class-") ? grade.slice(6) : gradeLabel(grade).replace("-", ""));

function FeesMissing({ failed }: { failed: boolean }) {
  if (failed)
    return (
      <Text className="error card-text" role="alert">
        The fees did not load. Reload the page to try again.
      </Text>
    );
  return (
    <Text className="card-text">
      No fees are charged yet. Set the fee of each class on the <Link to="/fees">Fees</Link> page.
    </Text>
  );
}

function FeeHero({ report, failed }: { report: Report; failed: boolean }) {
  const { total } = report;
  if (failed || total.charged === 0)
    return (
      <section className="hero hero-empty" aria-label="Fees collected">
        <Title order={2}>Fees collected</Title>
        <FeesMissing failed={failed} />
      </section>
    );
  const percent = share(total.collected, total.charged) ?? 0;
  const { notDue, late } = feeParts(total);
  const parts = [
    { name: "Collected", value: total.collected, className: "c-primary" },
    { name: "Not due yet", value: notDue, className: "c-sky" },
    { name: "Late", value: late, className: "c-amber" },
  ];
  return (
    <section className="hero" aria-label="Fees collected">
      <div className="hero-ring" role="img" aria-label={`${percent}% of the fees are collected`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="wave-track" cx="50" cy="50" r="40" />
          <path className="wave" pathLength="100" d={wavyRing(Math.min(percent, 100) / 100)} />
        </svg>
        <strong>{percent}%</strong>
      </div>
      <div className="hero-body">
        <Text className="hero-label">Fees collected</Text>
        <Text className="hero-value">{rs(total.collected)}</Text>
        <Text className="hero-note">of {rs(total.charged)} charged</Text>
        <ul className="hero-parts">
          {parts.slice(1).map((p) => (
            <li key={p.name}>
              <i className={p.className} aria-hidden="true" />
              {p.name} <b>{rsShort(p.value)}</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, note, tone }: { icon: IconName; label: string; value: string | number; note: string; tone: string }) {
  return (
    <div className={`stat ${tone}`}>
      <span className="cookie" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <Text className="stat-value">{value}</Text>
      <Text className="stat-label">{label}</Text>
      <Text className="stat-note">{note}</Text>
    </div>
  );
}

const STAGE_COLORS = ["c-primary", "c-teal", "c-sky", "c-plum"];

function StageDonut({ data }: { data: Data }) {
  const [active, setActive] = useState<string>();
  const whole = data.inClass;
  const gap = data.stages.filter((s) => s.students > 0).length > 1 ? 6 : 0;
  let start = 0;
  const focus = data.stages.find((s) => s.stage === active);
  return (
    <Card title="Students by stage" className="card-tall" action={<TextLink to="/classes">Classes</TextLink>}>
      <div className="donut">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {data.stages.map((s, i) => {
            const length = whole ? (s.students / whole) * 100 : 0;
            const arc = length > 0 && (
              <circle key={s.stage} className={`donut-arc ${STAGE_COLORS[i]} ${gap ? "" : "whole"} ${active && active !== s.stage ? "dim" : ""}`} cx="50" cy="50" r="41" pathLength="100" strokeDasharray={`${Math.max(length - gap, 0.5)} 100`} strokeDashoffset={-start - gap / 2} onPointerEnter={() => setActive(s.stage)} onPointerLeave={() => setActive(undefined)} />
            );
            start += length;
            return arc;
          })}
        </svg>
        <div className="donut-text">
          <strong>{focus ? focus.students : whole}</strong>
          <span>{focus ? focus.stage : "In a class"}</span>
        </div>
      </div>
      <ul className="legend-rows">
        {data.stages.map((s, i) => (
          <li key={s.stage} onPointerEnter={() => setActive(s.stage)} onPointerLeave={() => setActive(undefined)} className={active === s.stage ? "on" : undefined}>
            <i className={STAGE_COLORS[i]} aria-hidden="true" />
            <span>{s.stage}</span>
            <strong>{s.students}</strong>
            <em>{share(s.students, whole) ?? 0}%</em>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ClassSizes({ data }: { data: Data }) {
  const [stage, setStage] = useState("All");
  const stages = data.stages.filter((s) => data.classes.some((c) => c.stage === s.stage)).map((s) => s.stage);
  const shown = stage === "All" ? data.classes : data.classes.filter((c) => c.stage === stage);
  const top = roundUp(Math.max(2, ...shown.map((c) => c.students)));
  const largest = Math.max(...shown.map((c) => c.students), 0);
  const average = shown.length ? shown.reduce((sum, c) => sum + c.students, 0) / shown.length : 0;
  return (
    <Card title="Students by class">
      {data.classes.length === 0 ? (
        <Text className="card-text">
          No classes are open. Open them on the <Link to="/classes">Classes</Link> page.
        </Text>
      ) : (
        <>
          {stages.length > 1 && <ButtonGroup label="Filter by stage" value={stage} onChange={setStage} data={["All", ...stages]} />}
          <div className="plot">
            <div className="plot-axis" aria-hidden="true">
              {[top, top / 2, 0].map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <div className="plot-area">
              {shown.length > 1 && (
                <div className="plot-mean" style={{ bottom: `${(average / top) * 100}%` }}>
                  <span>Average {average < 10 ? average.toFixed(1) : Math.round(average)}</span>
                </div>
              )}
              {shown.map((c) => {
                const label = `${gradeLabel(c.grade)}: ${plural(c.students, "student", "students")}`;
                return (
                  <Tooltip key={c.grade} label={label} withArrow events={hover}>
                    <Link to={`/classes/${c.classId}`} className="bar-col" aria-label={label}>
                      <i className={c.students === largest && largest > 0 ? "bar top" : "bar"} style={{ height: `${(c.students / top) * 100}%` }} />
                    </Link>
                  </Tooltip>
                );
              })}
            </div>
            <div className="plot-labels" aria-hidden="true">
              {shown.map((c) => (
                <span key={c.grade}>{shortGrade(c.grade)}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function NextSteps({ data, failed }: { data: Data; failed: boolean }) {
  const steps = [
    data.noClass > 0 && { title: `${plural(data.noClass, "student needs", "students need")} a class`, note: "Enroll them for this school year.", to: "/students", action: "Enroll" },
    data.missingBForm > 0 && { title: `${plural(data.missingBForm, "student has", "students have")} no B-Form`, note: "Add the number to the student details.", to: "/students", action: "Students" },
    !failed && data.late.length > 0 && { title: `${plural(data.late.length, "student is", "students are")} late with fees`, note: "Call the guardians and take the payments.", to: "/reports", action: "Report" },
  ].filter((s) => !!s);
  return (
    <Card title="Next steps" className="card-next">
      {steps.length === 0 ? (
        <Text className="status-done card-text">
          <Icon name="check" size={16} /> Nothing is waiting for you.
        </Text>
      ) : (
        <ul className="steps">
          {steps.map((step, i) => (
            <li key={step.title}>
              <div>
                <span className="row-name">{step.title}</span>
                <span className="row-note">{step.note}</span>
              </div>
              <Button component={Link} to={step.to} size="xs" variant={i === 0 ? "filled" : "white"}>
                {step.action}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const MEASURES = {
  Charged: { key: "charged", className: "line-sky" },
  Collected: { key: "collected", className: "line-primary" },
  Late: { key: "overdue", className: "line-amber" },
} as const;

function FeeLine({ report, failed }: { report: Report; failed: boolean }) {
  const [measure, setMeasure] = useState<keyof typeof MEASURES>("Collected");
  const { byGrade, total } = report;
  const { key, className } = MEASURES[measure];
  const top = roundUp(Math.max(1, ...byGrade.map((g) => g[key])));
  const x = (i: number) => (byGrade.length > 1 ? (i / (byGrade.length - 1)) * 100 : 50);
  const y = (value: number) => 100 - (value / top) * 100;
  const line = smoothLine(byGrade.map((g, i): [number, number] => [x(i), y(g[key])]));
  return (
    <Card title="Fees across the classes" action={<TextLink to="/fees">Fees</TextLink>}>
      {failed || byGrade.length === 0 ? (
        <FeesMissing failed={failed} />
      ) : (
        <>
          <p className="card-lead">
            <strong>{rsShort(total[key])}</strong> {measure.toLowerCase()} in {plural(byGrade.length, "class", "classes")}
          </p>
          <ButtonGroup label="Choose the amount" value={measure} onChange={(next) => setMeasure(next as keyof typeof MEASURES)} data={Object.keys(MEASURES)} />
          <div className={`plot plot-line ${className}`}>
            <div className="plot-axis" aria-hidden="true">
              {[top, top / 2, 0].map((n) => (
                <span key={n}>{n === 0 ? "0" : compact.format(n / 100)}</span>
              ))}
            </div>
            <div className="plot-area">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path className="line-fill" d={`${line}L${x(byGrade.length - 1)} 100L${x(0)} 100Z`} />
                <path className="line-stroke" d={line} vectorEffect="non-scaling-stroke" />
              </svg>
              {byGrade.map((g, i) => {
                const label = `${gradeLabel(g.grade)}: ${rs(g[key])} ${measure.toLowerCase()}`;
                return (
                  <Tooltip key={g.grade} label={label} withArrow events={hover}>
                    <span className="line-hit" tabIndex={0} aria-label={label} style={{ left: `${x(i)}%`, width: `${100 / byGrade.length}%` }}>
                      <i style={{ top: `${y(g[key])}%` }} />
                    </span>
                  </Tooltip>
                );
              })}
            </div>
            <div className="plot-labels" aria-hidden="true">
              {byGrade.map((g) => (
                <span key={g.grade}>{shortGrade(g.grade)}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

const TICKS = 28;

function FeeProgress({ data, report, failed }: { data: Data; report: Report; failed: boolean }) {
  const stages = feesByStage(report.byGrade);
  const filled = data.billed ? Math.round((data.paidUp / data.billed) * TICKS) : 0;
  return (
    <Card title="Fee progress" action={<TextLink to="/reports">Reports</TextLink>}>
      {failed || stages.length === 0 ? (
        <FeesMissing failed={failed} />
      ) : (
        <>
          <p className="card-lead">
            <strong>{data.paidUp}</strong> of {plural(data.billed, "student", "students")} are paid up
          </p>
          <div className="ticks" role="img" aria-label={`${data.paidUp} of ${data.billed} students are paid up`}>
            {Array.from({ length: TICKS }, (_, i) => (
              <i key={i} className={i < filled ? "on" : undefined} />
            ))}
          </div>
          <ul className="stage-rows">
            {stages.map((s) => {
              const percent = share(s.collected, s.charged) ?? 0;
              return (
                <li key={s.stage}>
                  <span>{s.stage}</span>
                  <span className="stage-track">
                    <i style={{ width: `${Math.min(percent, 100)}%` }} />
                  </span>
                  <b>{percent}%</b>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function LateFees({ data, failed }: { data: Data; failed: boolean }) {
  return (
    <Card title="Late fees" action={<TextLink to="/reports">{data.late.length > 5 ? `All ${data.late.length}` : "Reports"}</TextLink>}>
      {failed ? (
        <FeesMissing failed />
      ) : data.late.length === 0 ? (
        <Text className="status-done card-text">
          <Icon name="check" size={16} /> No student is late with fees.
        </Text>
      ) : (
        <ul className="people">
          {data.late.slice(0, 5).map(({ student, amount, grade }) => {
            const name = `${student.firstName} ${student.lastName}`;
            return (
              <li key={student.studentId} className="person">
                <Avatar name={name} color="accent" size={40} radius="xl" />
                <div className="person-text">
                  <Link to={`/students/${student.studentId}/fees`} className="person-name">
                    {name}
                  </Link>
                  <span className="person-note">
                    {grade ? gradeLabel(grade) : "No class"},{" "}
                    <a href={`tel:${student.guardian.phone}`} aria-label={`Call the guardian of ${name}`}>
                      {toLocal(student.guardian.phone)}
                    </a>
                  </span>
                </div>
                <span className="pill-late">{rsShort(amount)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function KeyFigures({ data, report, failed }: { data: Data; report: Report; failed: boolean }) {
  const [tab, setTab] = useState("Records");
  const whole = data.active.length;
  const { total } = report;
  const rows =
    tab === "Records"
      ? [
          { name: "In a class", value: `${data.inClass} of ${whole}` },
          { name: "B-Form on file", value: `${whole - data.missingBForm} of ${whole}` },
          { name: "Girls", value: `${data.girls}` },
          { name: "Boys", value: `${data.boys}` },
        ]
      : failed || total.accounts === 0
        ? []
        : [
            { name: "Charged per student", value: rs(Math.round(total.charged / total.accounts / 100) * 100) },
            { name: "Collected per student", value: rs(Math.round(total.collected / total.accounts / 100) * 100) },
            { name: "Remaining", value: rs(total.remaining) },
            { name: "Advance payments", value: rs(total.credit) },
          ];
  return (
    <Card title="Key figures">
      <ButtonGroup label="Choose the figures" value={tab} onChange={setTab} data={["Records", "Fees"]} />
      {rows.length === 0 ? (
        <FeesMissing failed={failed} />
      ) : (
        <ul className="rows">
          {rows.map((r) => (
            <li key={r.name}>
              <span>{r.name}</span>
              <b>{r.value}</b>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Overview({ students, years, accounts }: { students: Student[]; years: Year[]; accounts: AccountSummary[] | null }) {
  const year = currentYear(years);
  if (!year)
    return (
      <section className="panel">
        <Title order={2} className="panel-title">
          No school year yet
        </Title>
        <Text className="panel-text">Open the first school year and its classes. Then students can be enrolled.</Text>
        <Button component={Link} to="/classes" mt="md" variant="light">
          Open a school year
        </Button>
      </section>
    );
  const data = overview(students, year, accounts ?? []);
  if (data.active.length === 0)
    return (
      <section className="panel">
        <Title order={2} className="panel-title">
          No students yet
        </Title>
        <Text className="panel-text">Register the first student. The overview of the school starts from there.</Text>
        <Button component={Link} to="/students/new" mt="md" variant="light">
          Register student
        </Button>
      </section>
    );
  const failed = accounts === null;
  const report = feeReport((accounts ?? []).filter((a) => a.academicYearId === year.academicYearId));
  return (
    <div className="bento">
      <MoneyCards year={year} dues={failed ? null : report.total.remaining} />
      <div className="bento-lead">
        <FeeHero report={report} failed={failed} />
        <div className="stats">
          <Stat icon="students" tone="tone-a" value={data.active.length} label="Students" note={`${data.inClass} in a class`} />
          <Stat icon="classes" tone="tone-b" value={data.classes.length} label="Classes open" note={`School year ${year.name}`} />
          <Stat icon="fees" tone="tone-c" value={failed ? "Not loaded" : data.late.length} label="Late with fees" note={failed ? "Reload the page" : `${rsShort(report.total.overdue)} is late`} />
        </div>
      </div>
      <div className="bento-side">
        <StageDonut data={data} />
      </div>
      <div className="bento-wide">
        <ClassSizes data={data} />
      </div>
      <div className="bento-narrow">
        <NextSteps data={data} failed={failed} />
      </div>
      <div className="bento-wide">
        <FeeLine report={report} failed={failed} />
      </div>
      <div className="bento-narrow">
        <FeeProgress data={data} report={report} failed={failed} />
      </div>
      <div className="bento-wide">
        <LateFees data={data} failed={failed} />
      </div>
      <div className="bento-narrow">
        <KeyFigures data={data} report={report} failed={failed} />
      </div>
      <CampusCards year={year} years={years} />
      <div className="bento-wide">
        <AdmissionOverview students={students} year={year} />
      </div>
      <div className="bento-narrow">
        <StudentStrength data={data} students={students} year={year} />
      </div>
      <div className="bento-wide">
        <RecentActivity />
      </div>
      <div className="bento-narrow">
        <LeavingRecords students={students} year={year} />
      </div>
    </div>
  );
}

export function Dashboard({ name }: { name: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    Promise.all([getJson("/api/students"), getJson("/api/academic-years"), getJson("/api/fees/accounts").catch(() => null)])
      .then(([students, years, accounts]) => setState({ status: "loaded", students, years, accounts }))
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
        <Button component={Link} to="/students/new" size="md" radius="md" className="fab" leftSection={<Icon name="add" size={18} />}>
          Register student
        </Button>
      </header>
      {state.status === "loading" && <Text className="state-text">Loading the overview.</Text>}
      {state.status === "failed" && (
        <div className="panel state">
          <Text className="state-title error" role="alert">
            The overview did not load.
          </Text>
          <Text className="state-text">Check the connection, then reload the page.</Text>
          <Button variant="default" mt="md" onClick={() => location.reload()}>
            Reload page
          </Button>
        </div>
      )}
      {state.status === "loaded" && <Overview students={state.students} years={state.years} accounts={state.accounts} />}
    </>
  );
}
