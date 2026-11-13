import { Text, Tooltip } from "@mantine/core";
import { useEffect, useState } from "react";
import { flowByDay, flowByMonth, moneyFigures, type Flow, type FlowDay } from "../cashflow.ts";
import { roundUp } from "../overview.ts";
import { showDate, todayInPakistan, type Year } from "../school.ts";
import { ButtonGroup, Card, CardState, compact, getJson, hover, rs, rsShort, TextLink, Tile } from "./cards";

type FlowState = FlowDay[] | "loading" | "failed";
type Series = { name: string; key: keyof Flow; className: string };

const monthName = (month: string, form: "short" | "long") =>
  new Intl.DateTimeFormat("en-GB", { month: form, ...(form === "long" && { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

function MoneyOverview({ flow, year, today, dues }: { flow: FlowState; year: Year; today: string; dues: number | null }) {
  const month = monthName(today.slice(0, 7), "long");
  return (
    <Card title="Income and expense" action={<TextLink to="/expenses">Expenses</TextLink>}>
      {typeof flow === "string" ? (
        <CardState state={flow} what="the income and expense figures" />
      ) : (
        (() => {
          const f = moneyFigures(flow, year.startsOn, today);
          const profit = f.month.income - f.month.spent;
          return (
            <>
              {flow.length === 0 && <Text className="card-text">No payment or expense is recorded in {year.name} yet.</Text>}
              <div className="tiles">
                <Tile label="Total dues" value={dues === null ? "Not loaded" : rs(dues)} note={dues === null ? "Reload the page" : `Fees not paid yet, ${year.name}`} />
                <Tile label="Income this year" value={rs(f.year.income)} note={`School year ${year.name}`} />
                <Tile label="Income this month" value={rs(f.month.income)} note={month} />
                <Tile label="Income today" value={rs(f.today.income)} note={showDate(today)} />
                <Tile label="Profit this month" value={rs(profit)} note="Income less expense" tone={profit < 0 ? "loss" : undefined} />
                <Tile label="Expense this year" value={rs(f.year.spent)} note={`School year ${year.name}`} />
                <Tile label="Expense this month" value={rs(f.month.spent)} note={month} />
                <Tile label="Expense today" value={rs(f.today.spent)} note={showDate(today)} />
              </div>
            </>
          );
        })()
      )}
    </Card>
  );
}

function FlowChart({ title, link, flow, from, today, series, empty }: { title: string; link: { to: string; label: string }; flow: FlowState; from: string; today: string; series: [Series, Series]; empty: string }) {
  const [span, setSpan] = useState("This year");
  const body = () => {
    if (typeof flow === "string") return <CardState state={flow} what={title.toLowerCase()} />;
    const byMonth = span === "This year";
    const groups = byMonth ? flowByMonth(flow, from, today) : flowByDay(flow, today);
    const totals = series.map((s) => groups.reduce((sum, g) => sum + g[s.key], 0));
    const top = roundUp(Math.max(100, ...groups.flatMap((g) => series.map((s) => g[s.key]))));
    const some = groups.some((g) => series.some((s) => g[s.key] !== 0));
    return (
      <>
        <p className="card-lead">
          <strong>{rsShort(totals[1])}</strong> {series[1].name.toLowerCase()}, {rsShort(totals[0])} {series[0].name.toLowerCase()}
        </p>
        <ButtonGroup label="Choose the period" value={span} onChange={setSpan} data={["This year", "This month"]} />
        {!some ? (
          <Text className="card-text">{empty}</Text>
        ) : (
          <>
            <div className="plot">
              <div className="plot-axis" aria-hidden="true">
                {[top, top / 2, 0].map((n) => (
                  <span key={n}>{n === 0 ? "0" : compact.format(n / 100)}</span>
                ))}
              </div>
              <div className="plot-area">
                {groups.map((g) => {
                  const label = `${byMonth ? monthName(g.key, "long") : showDate(g.key)}: ${series.map((s) => `${rs(g[s.key])} ${s.name.toLowerCase()}`).join(", ")}`;
                  return (
                    <Tooltip key={g.key} label={label} withArrow events={hover}>
                      <span className="bar-col bar-pair" tabIndex={0} role="img" aria-label={label}>
                        {series.map((s) => (
                          <i key={s.key} className={`bar ${s.className}`} style={{ height: `${(Math.max(g[s.key], 0) / top) * 100}%` }} />
                        ))}
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
              <div className="plot-labels" aria-hidden="true">
                {groups.map((g, i) => (
                  <span key={g.key}>{byMonth ? monthName(g.key, "short") : i === 0 || (i + 1) % 5 === 0 ? i + 1 : ""}</span>
                ))}
              </div>
            </div>
            <ul className="legend">
              {series.map((s) => (
                <li key={s.key}>
                  <i className={s.className} aria-hidden="true" />
                  {s.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  };
  return (
    <Card title={title} action={<TextLink to={link.to}>{link.label}</TextLink>}>
      {body()}
    </Card>
  );
}

export function MoneyCards({ year, dues }: { year: Year; dues: number | null }) {
  const today = todayInPakistan(new Date());
  const from = year.startsOn;
  const to = today < from ? from : today;
  const [flow, setFlow] = useState<FlowState>("loading");

  useEffect(() => {
    setFlow("loading");
    getJson(`/api/fees/cash-flow?from=${from}&to=${to}`).then(
      (answer: { days: FlowDay[] }) => setFlow(answer.days),
      () => setFlow("failed"),
    );
  }, [from, to]);

  return (
    <>
      <div className="bento-full">
        <MoneyOverview flow={flow} year={year} today={today} dues={dues} />
      </div>
      <div className="bento-half">
        <FlowChart
          title="Fees charged and collected"
          link={{ to: "/reports", label: "Reports" }}
          flow={flow}
          from={from}
          today={to}
          series={[
            { name: "Charged", key: "charged", className: "c-sky" },
            { name: "Collected", key: "income", className: "c-primary" },
          ]}
          empty="No fee is charged or collected in this period."
        />
      </div>
      <div className="bento-half">
        <FlowChart
          title="Income and expense over time"
          link={{ to: "/expenses", label: "Expenses" }}
          flow={flow}
          from={from}
          today={to}
          series={[
            { name: "Expense", key: "spent", className: "c-amber" },
            { name: "Income", key: "income", className: "c-primary" },
          ]}
          empty="No payment or expense is recorded in this period."
        />
      </div>
    </>
  );
}
