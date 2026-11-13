import { Badge, Button, NativeSelect, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { monthRange } from "../cashflow.ts";
import { ENTRY_KINDS, entriesByDay, labelOf, type CalendarEntry } from "../campus.ts";
import { Icon } from "../icons";
import { showDate, todayInPakistan } from "../school.ts";
import { FormModal, Notice, PageState, useLoad } from "./campusParts";

export const entryDays = (e: CalendarEntry) => (e.endsOn === e.startsOn ? showDate(e.startsOn) : `${showDate(e.startsOn)} to ${showDate(e.endsOn)}`);

export function CalendarPage() {
  const today = todayInPakistan(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const { from, to } = monthRange(month);
  const [entries, load] = useLoad<CalendarEntry[]>(`/api/calendar?from=${from}&to=${to}`);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CalendarEntry>();
  const [notice, setNotice] = useState<string>();
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="account">
      <header className="page-head">
        <div>
          <Title order={1}>School calendar</Title>
          <Text className="lead">Holidays, exams, events and meetings of the school.</Text>
        </div>
        <Button leftSection={<Icon name="add" size={16} />} onClick={() => setAdding(true)}>
          Add entry
        </Button>
      </header>
      <Notice text={notice} />
      <TextInput type="month" label="Month" value={month} onChange={(event) => /^\d{4}-\d{2}$/.test(event.currentTarget.value) && setMonth(event.currentTarget.value)} classNames={{ input: "field-input" }} className="month-pick" />
      {typeof entries === "string" ? (
        <PageState state={entries} what="the calendar" />
      ) : entries.length === 0 ? (
        <div className="panel state">
          <Text className="state-title">Nothing is planned in {monthLabel}.</Text>
          <Text className="state-text">Add a holiday, an exam, an event or a meeting.</Text>
        </div>
      ) : (
        <section className="panel" aria-label={`Calendar of ${monthLabel}`}>
          <ul className="log">
            {entriesByDay(entries).flatMap((day) =>
              day.entries.map((e) => (
                <li key={e.entryId} className="log-row">
                  <div>
                    <span className="log-text">{e.title}</span>
                    <span className="log-note">{entryDays(e)}</span>
                  </div>
                  <Badge variant="light" tt="none" color={e.kind === "holiday" ? "green" : "accent"}>
                    {labelOf(ENTRY_KINDS, e.kind)}
                  </Badge>
                  <Button variant="subtle" color="red" size="compact-sm" aria-label={`Remove ${e.title}`} onClick={() => setRemoving(e)}>
                    Remove
                  </Button>
                </li>
              )),
            )}
          </ul>
        </section>
      )}
      <FormModal
        title="Add calendar entry"
        opened={adding}
        onClose={() => setAdding(false)}
        submit="Add entry"
        request={(value) => {
          const endsOn = value("endsOn") || value("startsOn");
          if (endsOn < value("startsOn")) return { errors: { endsOn: "The last day cannot be before the first day." } };
          return { path: "/api/calendar", body: { title: value("title"), kind: value("kind"), startsOn: value("startsOn"), endsOn } };
        }}
        onDone={(data) => {
          setAdding(false);
          setNotice(`Added ${data.title}.`);
          if (data.startsOn.slice(0, 7) === month) void load();
          else setMonth(data.startsOn.slice(0, 7));
        }}
      >
        {(field) => (
          <>
            <TextInput name="title" label="Title" placeholder="Winter holidays" maxLength={200} autoComplete="off" data-autofocus required withAsterisk={false} {...field("title")} />
            <NativeSelect name="kind" label="Kind" data={ENTRY_KINDS.map(([value, label]) => ({ value, label }))} {...field("kind")} />
            <div className="pair">
              <TextInput name="startsOn" label="First day" type="date" defaultValue={month === today.slice(0, 7) ? today : from} required withAsterisk={false} {...field("startsOn")} />
              <TextInput name="endsOn" label="Last day (optional)" type="date" description="Leave empty for one day." {...field("endsOn")} />
            </div>
          </>
        )}
      </FormModal>
      <FormModal
        title="Remove calendar entry"
        opened={!!removing}
        onClose={() => setRemoving(undefined)}
        submit="Remove entry"
        danger
        request={() => ({ path: `/api/calendar/${removing!.entryId}/removal`, body: {} })}
        onDone={() => {
          setNotice(`Removed ${removing?.title}.`);
          setRemoving(undefined);
          void load();
        }}
      >
        {() => <Text className="panel-text">{removing && `${removing.title}, ${entryDays(removing)}. The calendar does not show it after this.`}</Text>}
      </FormModal>
    </div>
  );
}
