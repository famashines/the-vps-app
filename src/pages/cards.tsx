import { Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Icon } from "../icons";
import { pkr, showMoney } from "../money.ts";
import { signInUrl } from "../session";

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const rs = (paisa: number) => `${paisa < 0 ? "- " : ""}${showMoney(pkr(paisa))}`;
export const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export const rsShort = (paisa: number) => `${paisa < 0 ? "- " : ""}Rs ${compact.format(Math.abs(paisa) / 100)}`;
export const hover = { hover: true, focus: true, touch: false };

export async function getJson(path: string) {
  const response = await fetch(path);
  if (response.status === 401) location.assign(signInUrl());
  if (!response.ok) throw new Error(path);
  return response.json();
}

export function ButtonGroup({ label, value, onChange, data }: { label: string; value: string; onChange: (value: string) => void; data: string[] }) {
  return (
    <div className="group" role="group" aria-label={label}>
      {data.map((item) => (
        <button key={item} type="button" aria-pressed={item === value} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function Card({ title, action, className = "", children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`card ${className}`} aria-label={title}>
      <div className="card-head">
        <Title order={2}>{title}</Title>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="card-link">
      {children}
      <Icon name="arrow" size={14} />
    </Link>
  );
}

export function CardState({ state, what }: { state: "loading" | "failed"; what: string }) {
  return state === "loading" ? (
    <Text className="card-text">Loading {what}.</Text>
  ) : (
    <Text className="error card-text" role="alert">
      {what.charAt(0).toUpperCase() + what.slice(1)} did not load. Reload the page to try again.
    </Text>
  );
}

export function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "loss" }) {
  return (
    <div className={`tile${tone ? ` tile-${tone}` : ""}`}>
      <Text className="tile-label">{label}</Text>
      <Text className="tile-value">{value}</Text>
      <Text className="tile-note">{note}</Text>
    </div>
  );
}
