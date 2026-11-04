import { Button, Text, Title } from "@mantine/core";
import { Link } from "react-router";

export function NotFound() {
  return (
    <header className="page-head">
      <div>
        <Title order={1}>Page not found</Title>
        <Text className="lead">This address does not match a page. Check the link, or go back to the dashboard.</Text>
        <Button component={Link} to="/" variant="light" mt="lg">
          Go to dashboard
        </Button>
      </div>
    </header>
  );
}
