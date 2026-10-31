import { useEffect, useState } from "react";

export type User = { sub: string; name: string; roles: string[] };
export type SessionState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; user: User };

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    fetch("/api/me")
      .then(async (response) => setState(response.ok ? { status: "signed-in", user: await response.json() } : { status: "signed-out" }))
      .catch(() => setState({ status: "signed-out" }));
  }, []);

  return state;
}

export function signInUrl() {
  const params = new URLSearchParams(location.search);
  params.delete("signin");
  const query = params.toString();
  return `/api/auth/login?returnTo=${encodeURIComponent(location.pathname + (query ? `?${query}` : ""))}`;
}

export async function signOut() {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  const { redirect } = response.ok ? await response.json() : { redirect: "/" };
  location.assign(redirect);
}
