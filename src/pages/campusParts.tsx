import { Button, Group, Modal, Text } from "@mantine/core";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { isStale, send } from "../school.ts";
import { getJson } from "./cards";

export type Loaded<T> = T | "loading" | "failed";

export function useLoad<T>(path: string | undefined): [Loaded<T>, () => Promise<void>] {
  const [state, setState] = useState<Loaded<T>>("loading");
  const load = useCallback(() => (path ? getJson(path).then(setState, () => setState("failed")) : Promise.resolve()), [path]);
  useEffect(() => {
    setState("loading");
    void load();
  }, [load]);
  return [state, load];
}

export const firstBad = (...states: Loaded<unknown>[]) => (states.includes("failed") ? "failed" : states.includes("loading") ? "loading" : undefined);

export function PageState({ state, what }: { state: "loading" | "failed"; what: string }) {
  if (state === "loading") return <Text className="state-text">Loading {what}.</Text>;
  return (
    <div className="panel state">
      <Text className="state-title error" role="alert">
        {what.charAt(0).toUpperCase() + what.slice(1)} did not load.
      </Text>
      <Text className="state-text">Check the connection, then reload the page.</Text>
      <Button variant="default" mt="md" onClick={() => location.reload()}>
        Reload page
      </Button>
    </div>
  );
}

export function Notice({ text }: { text?: string }) {
  return text ? (
    <div className="notice" role="status">
      <Text>{text}</Text>
    </div>
  ) : null;
}

export function Problem({ text, stale }: { text?: string; stale?: boolean }) {
  return text ? (
    <div className="problem" role="alert">
      <Text>{text}</Text>
      {stale && (
        <Button variant="default" size="compact-sm" onClick={() => location.reload()}>
          Reload
        </Button>
      )}
    </div>
  ) : null;
}

export type FormRequest = { path: string; body: object; method?: "POST" | "PUT" } | { errors: Record<string, string> };
type Field = (name: string) => { error?: string; onChange: () => void; classNames: { input: string } };

export function FormModal({ title, opened, onClose, submit, danger, request, onDone, children }: {
  title: string;
  opened: boolean;
  onClose: () => void;
  submit: string;
  danger?: boolean;
  request: (value: (name: string) => string) => FormRequest;
  onDone: (data: any) => void;
  children?: (field: Field) => ReactNode;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setKey(crypto.randomUUID());
    setErrors({});
    setProblem(undefined);
    setStale(false);
  }, [opened]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const asked = request((name) => String(data.get(name) ?? "").trim());
    if ("errors" in asked) return setErrors(asked.errors);
    setSaving(true);
    setProblem(undefined);
    const answer = await send(asked.path, asked.body, key, asked.method);
    setSaving(false);
    if (answer.ok) return onDone(answer.data);
    if (answer.status === 401) return;
    const fields = Object.entries(answer.fields);
    setErrors(Object.fromEntries(fields.map(([name, message]) => [name, /^[A-Z]/.test(message) ? message : "Check this field."])));
    setStale(isStale(answer));
    setProblem(fields.find(([, message]) => /^[A-Z]/.test(message))?.[1] ?? answer.message);
  }

  const field: Field = (name) => ({ error: errors[name], onChange: () => errors[name] && setErrors(({ [name]: _, ...rest }) => rest), classNames: { input: "field-input" } });

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <form onSubmit={onSubmit} className="edit-form">
        <Problem text={problem} stale={stale} />
        {children?.(field)}
        <Group gap="sm">
          <Button type="submit" color={danger ? "red" : undefined} loading={saving}>
            {submit}
          </Button>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
