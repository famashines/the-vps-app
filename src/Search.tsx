import { Kbd, UnstyledButton } from "@mantine/core";
import { Spotlight, spotlight } from "@mantine/spotlight";
import { useState } from "react";
import { useNavigate } from "react-router";
import { findsStudent } from "./find.ts";
import { Icon, type IconName } from "./icons";
import type { Student } from "./pages/Students";
import { gradeLabel } from "./school.ts";
import { signInUrl } from "./session";

const places: { to: string; label: string; text: string; icon: IconName }[] = [
  { to: "/", label: "Dashboard", text: "Today at the office", icon: "dashboard" },
  { to: "/students", label: "Students", text: "Every registered student", icon: "students" },
  { to: "/students/new", label: "Register a student", text: "New admission", icon: "add" },
  { to: "/classes", label: "Classes", text: "School years and their classes", icon: "classes" },
  { to: "/fees", label: "Fees", text: "Fee schedule and student balances", icon: "fees" },
  { to: "/reports", label: "Reports", text: "Collected and remaining fees, defaulters", icon: "reports" },
];

type Loaded = { status: "idle" | "loading" | "failed" } | { status: "loaded"; students: Student[] };

export function SearchButton() {
  return (
    <UnstyledButton className="search-button" onClick={spotlight.open} aria-keyshortcuts="/ Control+K">
      <Icon name="search" size={16} />
      <span className="search-button-text">Search or go to</span>
      <Kbd className="search-key">/</Kbd>
    </UnstyledButton>
  );
}

export function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<Loaded>({ status: "idle" });

  function load() {
    setLoaded({ status: "loading" });
    fetch("/api/students")
      .then(async (response) => {
        if (response.status === 401) return location.assign(signInUrl());
        setLoaded(response.ok ? { status: "loaded", students: await response.json() } : { status: "failed" });
      })
      .catch(() => setLoaded({ status: "failed" }));
  }

  const q = query.trim().toLowerCase();
  const shownPlaces = places.filter((p) => !q || p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q));
  const found = q && loaded.status === "loaded" ? loaded.students.filter((s) => findsStudent(s, query)) : [];

  return (
    <Spotlight.Root
      query={query}
      onQueryChange={setQuery}
      shortcut={["mod + K", "/"]}
      onSpotlightOpen={load}
      scrollable
      maxHeight="min(28rem, 60vh)"
      classNames={{ content: "search", body: "search-body" }}
    >
      <Spotlight.Search placeholder="Search students, or type a page name" leftSection={<Icon name="search" />} aria-label="Search" />
      <Spotlight.ActionsList>
        {found.length > 0 && (
          <Spotlight.ActionsGroup label={`Students (${found.length})`}>
            {found.slice(0, 8).map((s) => {
              const enrollment = s.enrollments[0];
              return (
                <Spotlight.Action key={s.studentId} className="search-item" onClick={() => navigate(`/students/${s.studentId}`)}>
                  <span className="search-adm">{s.admissionNumber}</span>
                  <span className="search-main">
                    <span className="search-label">
                      {s.firstName} {s.lastName}
                    </span>
                    <span className="search-text">
                      {s.fatherName ? `Father ${s.fatherName}` : `Guardian ${s.guardian.name}`}, {s.guardian.phone}
                    </span>
                  </span>
                  <span className={enrollment ? "search-class" : "search-class none"}>{enrollment ? gradeLabel(enrollment.grade) : "No class"}</span>
                </Spotlight.Action>
              );
            })}
          </Spotlight.ActionsGroup>
        )}
        {shownPlaces.length > 0 && (
          <Spotlight.ActionsGroup label="Go to">
            {shownPlaces.map((p) => (
              <Spotlight.Action key={p.to} className="search-item" onClick={() => navigate(p.to)}>
                <span className="search-icon">
                  <Icon name={p.icon} size={16} />
                </span>
                <span className="search-main">
                  <span className="search-label">{p.label}</span>
                  <span className="search-text">{p.text}</span>
                </span>
              </Spotlight.Action>
            ))}
          </Spotlight.ActionsGroup>
        )}
        {q && found.length === 0 && shownPlaces.length === 0 && (
          <Spotlight.Empty>
            {loaded.status === "loading"
              ? "Loading students."
              : loaded.status === "failed"
                ? "The student list did not load. Close the search and try again."
                : `No student or page matches "${query.trim()}". Search by name, father name, admission number or phone.`}
          </Spotlight.Empty>
        )}
      </Spotlight.ActionsList>
      <Spotlight.Footer className="search-footer">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
        </span>
        <span>
          <Kbd>Enter</Kbd> to open
        </span>
        <span>
          <Kbd>Esc</Kbd> to close
        </span>
      </Spotlight.Footer>
    </Spotlight.Root>
  );
}
