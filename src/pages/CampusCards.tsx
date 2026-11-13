import { Table, Text, Title, Tooltip } from "@mantine/core";
import { useState } from "react";
import { Link } from "react-router";
import { classesToday, EXAM_KINDS, labelOf, lastDays, rateByDay, resultsOf, stockAlerts, type CalendarEntry, type Exam, type Movement, type Notice, type StockItem, type Summary } from "../campus.ts";
import { Icon } from "../icons";
import { gradeLabel, showDate, todayInPakistan, type Year } from "../school.ts";
import { entryDays } from "./CalendarPage";
import { ButtonGroup, Card, CardState, hover, plural, TextLink } from "./cards";
import { useLoad, type Loaded } from "./campusParts";
import { averageText, gradeOfClass } from "./Exams";
import { noticeDay } from "./Notices";

const shortDay = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const rateText = (rate: number | undefined) => (rate === undefined ? "Not marked" : `${rate}%`);

function StudentsToday({ summary, year, today }: { summary: Loaded<Summary>; year: Year; today: string }) {
  const body = () => {
    if (typeof summary === "string") return <CardState state={summary} what="the student attendance" />;
    if (year.classes.length === 0)
      return (
        <Text className="card-text">
          No classes are open. Open them on the <Link to="/classes">Classes</Link> page.
        </Text>
      );
    const t = classesToday(summary.students, year.classes, today);
    return (
      <>
        <p className="card-lead">
          <strong>{t.rate === undefined ? "Not marked" : `${t.rate}%`}</strong> {t.rate === undefined ? "today" : `present, ${t.counts.absent} absent, ${t.counts.leave} on leave`}
        </p>
        <Text className="card-text" role="status">
          {t.markedClasses} of {plural(t.classes, "class", "classes")} marked today
        </Text>
        <ul className="stage-rows class-rates">
          {t.byClass.map((c) => {
            const rate = c.counts && Math.round((c.counts.present / (c.counts.present + c.counts.absent + c.counts.leave)) * 100);
            return (
              <li key={c.classId}>
                <span>{gradeLabel(c.grade)}</span>
                <span className="stage-track">{rate !== undefined && <i style={{ width: `${rate}%` }} />}</span>
                <b>{rateText(rate)}</b>
              </li>
            );
          })}
        </ul>
      </>
    );
  };
  return (
    <Card title="Today's student attendance" action={<TextLink to="/attendance">Mark</TextLink>}>
      {body()}
    </Card>
  );
}

function StaffToday({ summary, today }: { summary: Loaded<Summary>; today: string }) {
  const counts = typeof summary === "string" ? undefined : summary.staff.find((s) => s.date === today);
  return (
    <Card title="Staff attendance" action={<TextLink to="/attendance">Mark</TextLink>}>
      {typeof summary === "string" ? (
        <CardState state={summary} what="the staff attendance" />
      ) : !counts ? (
        <Text className="card-text">The staff attendance of today is not marked.</Text>
      ) : (
        <ul className="rows">
          {(["present", "absent", "leave"] as const).map((status) => (
            <li key={status}>
              <span>{status === "leave" ? "On leave" : status === "present" ? "Present" : "Absent"}</span>
              <b>{counts[status]}</b>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OverTime({ summary, today }: { summary: Loaded<Summary>; today: string }) {
  const [who, setWho] = useState("Students");
  const body = () => {
    if (typeof summary === "string") return <CardState state={summary} what="the attendance over time" />;
    const days = rateByDay(who === "Students" ? summary.students : summary.staff, lastDays(today, 30));
    const done = days.filter((d) => d.rate !== undefined);
    return (
      <>
        <ButtonGroup label="Choose students or staff" value={who} onChange={setWho} data={["Students", "Staff"]} />
        {done.length === 0 ? (
          <Text className="card-text">No {who.toLowerCase()} attendance is marked in the last 30 days.</Text>
        ) : (
          <>
            <p className="card-lead">
              <strong>{Math.round(done.reduce((sum, d) => sum + d.rate!, 0) / done.length)}%</strong> present on average, {plural(done.length, "day", "days")} marked
            </p>
            <div className="plot">
              <div className="plot-axis" aria-hidden="true">
                <span>100%</span>
                <span>50%</span>
                <span>0</span>
              </div>
              <div className="plot-area">
                {days.map((d) => {
                  const label = `${showDate(d.date)}: ${d.rate === undefined ? "not marked" : `${d.rate}% present, ${d.counts.absent} absent, ${d.counts.leave} on leave`}`;
                  return (
                    <Tooltip key={d.date} label={label} withArrow events={hover}>
                      <span className="bar-col" tabIndex={0} role="img" aria-label={label}>
                        {d.rate !== undefined && <i className="bar" style={{ height: `${d.rate}%` }} />}
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
              <div className="plot-labels" aria-hidden="true">
                {days.map((d, i) => (
                  <span key={d.date}>{i % 7 === 1 ? shortDay(d.date) : ""}</span>
                ))}
              </div>
            </div>
          </>
        )}
      </>
    );
  };
  return (
    <Card title="Attendance over time" action={<TextLink to="/attendance">Attendance</TextLink>}>
      {body()}
    </Card>
  );
}

function Listed<T>({ title, link, state, what, empty, rows, render }: { title: string; link: { to: string; label: string }; state: Loaded<T>; what: string; empty: string; rows: (data: T) => unknown[]; render: (data: T) => React.ReactNode }) {
  return (
    <Card title={title} action={<TextLink to={link.to}>{link.label}</TextLink>}>
      {typeof state === "string" ? <CardState state={state as "loading" | "failed"} what={what} /> : rows(state as T).length === 0 ? <Text className="card-text">{empty}</Text> : render(state as T)}
    </Card>
  );
}

export function CampusCards({ year, years }: { year: Year; years: Year[] }) {
  const today = todayInPakistan(new Date());
  const days = lastDays(today, 30);
  const ahead = new Date(Date.parse(`${today}T00:00:00Z`) + 90 * 86_400_000).toISOString().slice(0, 10);
  const [summary] = useLoad<Summary>(`/api/attendance/summary?from=${days[0]}&to=${today}`);
  const [calendar] = useLoad<CalendarEntry[]>(`/api/calendar?from=${today}&to=${ahead}`);
  const [notices] = useLoad<Notice[]>("/api/notices");
  const [exams] = useLoad<Exam[]>("/api/exams");
  const [stock] = useLoad<{ items: StockItem[]; movements: Movement[] }>("/api/stock");

  return (
    <>
      <div className="bento-wide">
        <StudentsToday summary={summary} year={year} today={today} />
      </div>
      <div className="bento-narrow">
        <StaffToday summary={summary} today={today} />
      </div>
      <div className="bento-wide">
        <OverTime summary={summary} today={today} />
      </div>
      <div className="bento-narrow">
        <Listed
          title="School calendar"
          link={{ to: "/calendar", label: "Calendar" }}
          state={calendar}
          what="the calendar"
          empty="Nothing is planned in the next 90 days."
          rows={(list) => list}
          render={(list) => (
            <ul className="log">
              {list.slice(0, 5).map((e) => (
                <li key={e.entryId}>
                  <span className="log-text">{e.title}</span>
                  <span className="log-note">{entryDays(e)}</span>
                </li>
              ))}
            </ul>
          )}
        />
      </div>
      <div className="bento-wide">
        <Listed
          title="Tests and results"
          link={{ to: "/exams", label: "Tests and exams" }}
          state={exams}
          what="the tests and results"
          empty="No test or exam is scheduled yet."
          rows={(list) => list}
          render={(list) => (
            <ul className="log">
              {list.slice(0, 5).map((e) => (
                <li key={e.examId} className="log-row">
                  <div>
                    <span className="log-text">
                      {e.name}, {e.subject}
                    </span>
                    <span className="log-note">
                      {gradeOfClass(years, e.classId)}, {showDate(e.heldOn)}, {labelOf(EXAM_KINDS, e.kind).toLowerCase()}
                    </span>
                  </div>
                  <b>{averageText(e)}</b>
                </li>
              ))}
            </ul>
          )}
        />
      </div>
      <div className="bento-narrow">
        <Listed
          title="Notices"
          link={{ to: "/notices", label: "Notices" }}
          state={notices}
          what="the notices"
          empty="No notice is published."
          rows={(list) => list}
          render={(list) => (
            <ul className="log">
              {list.slice(0, 3).map((n) => (
                <li key={n.noticeId}>
                  <span className="log-text">{n.title}</span>
                  <span className="log-note">{noticeDay(n)}</span>
                </li>
              ))}
            </ul>
          )}
        />
      </div>
      <div className="bento-full">
        <Card title="School stock" action={<TextLink to="/stock">Stock</TextLink>}>
          {typeof stock === "string" ? (
            <CardState state={stock} what="the stock" />
          ) : stock.items.length === 0 ? (
            <Text className="card-text">No stock item is recorded yet.</Text>
          ) : stockAlerts(stock.items).length === 0 ? (
            <Text className="status-done card-text">
              <Icon name="check" size={16} /> All {plural(stock.items.length, "item is", "items are")} in stock.
            </Text>
          ) : (
            <ul className="rows">
              {stockAlerts(stock.items).map((i) => (
                <li key={i.itemId}>
                  <span>{i.name}</span>
                  <b>{i.state === "out" ? "Out of stock" : `Low: ${i.quantity} ${i.unit}`}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function ProgressReport({ studentId }: { studentId: string }) {
  const [exams] = useLoad<Exam[]>("/api/exams");
  const results = typeof exams === "string" ? [] : resultsOf(exams, studentId);
  return (
    <section className="panel panel-flush" aria-labelledby="progress-title">
      <div className="panel-pad">
        <Title order={2} className="panel-title" id="progress-title">
          Progress report
        </Title>
        {typeof exams === "string" ? (
          <CardState state={exams} what="the test and exam results" />
        ) : (
          results.length === 0 && <Text className="panel-text">No test or exam result yet.</Text>
        )}
      </div>
      {results.length > 0 && (
        <Table.ScrollContainer minWidth={560} type="native">
          <Table className="ruled" withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Day</Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th>Test or exam</Table.Th>
                <Table.Th className="money">Marks</Table.Th>
                <Table.Th className="money">Percent</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.map((r) => (
                <Table.Tr key={r.exam.examId}>
                  <Table.Td>{showDate(r.exam.heldOn)}</Table.Td>
                  <Table.Td>{r.exam.subject}</Table.Td>
                  <Table.Td>{r.exam.name}</Table.Td>
                  <Table.Td className="money">{r.marks === null ? "Absent" : `${r.marks} of ${r.exam.totalMarks}`}</Table.Td>
                  <Table.Td className="money">{r.percent === undefined ? "" : `${r.percent}%`}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </section>
  );
}
