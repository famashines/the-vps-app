import { Button, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { signInUrl, signOut } from "../session";

function CopyPage({ children }: { children: ReactNode }) {
  return (
    <main className="copy-page">
      <Stack gap="lg" align="flex-start" className="copy-content">
        <div>
          <Title order={1} className="copy-title">
            VPS
          </Title>
          <Text className="lead">The Vision Public School</Text>
        </div>
        {children}
      </Stack>
    </main>
  );
}

export function SignIn() {
  const failed = new URLSearchParams(location.search).get("signin") === "failed";
  return (
    <CopyPage>
      {failed && (
        <Text className="error" role="alert">
          Sign-in did not finish. Try again.
        </Text>
      )}
      <Text className="lead">Sign in with your school account to open the dashboard.</Text>
      <Button component="a" href={signInUrl()} size="md">
        Sign in
      </Button>
    </CopyPage>
  );
}

export function NoAccess({ name }: { name: string }) {
  return (
    <CopyPage>
      <Text className="lead">
        You are signed in as {name}, but this account has no access to the school office. Ask an administrator to give
        it the admin role, then sign in again.
      </Text>
      <Button variant="light" onClick={signOut}>
        Sign out
      </Button>
    </CopyPage>
  );
}
