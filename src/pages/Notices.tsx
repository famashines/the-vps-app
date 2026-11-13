import { Badge, Button, Group, NativeSelect, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { AUDIENCES, labelOf, whatsAppLink, type Notice as NoticeItem } from "../campus.ts";
import { Icon } from "../icons";
import { showDate, todayInPakistan } from "../school.ts";
import { FormModal, Notice, PageState, useLoad } from "./campusParts";

export const noticeDay = (n: NoticeItem) => showDate(todayInPakistan(new Date(n.publishedAt)));

export function Notices() {
  const [notices, load] = useLoad<NoticeItem[]>("/api/notices");
  const [publishing, setPublishing] = useState(false);
  const [withdrawing, setWithdrawing] = useState<NoticeItem>();
  const [notice, setNotice] = useState<string>();

  return (
    <div className="account">
      <header className="page-head">
        <div>
          <Title order={1}>Notices</Title>
          <Text className="lead">Notices and announcements of the school. "Send on WhatsApp" opens WhatsApp with the text, and the school sends it from its own WhatsApp.</Text>
        </div>
        <Button leftSection={<Icon name="add" size={16} />} onClick={() => setPublishing(true)}>
          Publish notice
        </Button>
      </header>
      <Notice text={notice} />
      {typeof notices === "string" ? (
        <PageState state={notices} what="the notices" />
      ) : notices.length === 0 ? (
        <div className="panel state">
          <Text className="state-title">No notice yet.</Text>
          <Text className="state-text">Publish the first notice for the parents or the staff.</Text>
        </div>
      ) : (
        <div className="years">
          {notices.map((n) => (
            <article key={n.noticeId} className="panel" aria-label={n.title}>
              <Group justify="space-between" align="flex-start" gap="sm">
                <Title order={2} className="panel-title">
                  {n.title}
                </Title>
                <Badge variant="light" tt="none">
                  {labelOf(AUDIENCES, n.audience)}
                </Badge>
              </Group>
              <Text className="notice-body">{n.body}</Text>
              <Group justify="space-between" gap="sm" mt="md">
                <Text className="log-note">{noticeDay(n)}</Text>
                <Group gap={4}>
                  <Button component="a" href={whatsAppLink(n)} target="_blank" rel="noreferrer" variant="subtle" size="compact-sm" aria-label={`Send ${n.title} on WhatsApp`}>
                    Send on WhatsApp
                  </Button>
                  <Button variant="subtle" color="red" size="compact-sm" aria-label={`Withdraw ${n.title}`} onClick={() => setWithdrawing(n)}>
                    Withdraw
                  </Button>
                </Group>
              </Group>
            </article>
          ))}
        </div>
      )}
      <FormModal
        title="Publish notice"
        opened={publishing}
        onClose={() => setPublishing(false)}
        submit="Publish notice"
        request={(value) => ({ path: "/api/notices", body: { title: value("title"), body: value("body"), audience: value("audience") } })}
        onDone={(data) => {
          setPublishing(false);
          setNotice(`Published ${data.title}.`);
          void load();
        }}
      >
        {(field) => (
          <>
            <TextInput name="title" label="Title" placeholder="Parent meeting on Saturday" maxLength={200} autoComplete="off" data-autofocus required withAsterisk={false} {...field("title")} />
            <NativeSelect name="audience" label="For" data={AUDIENCES.map(([value, label]) => ({ value, label }))} {...field("audience")} />
            <Textarea name="body" label="Text" maxLength={2000} autosize minRows={4} required withAsterisk={false} {...field("body")} />
          </>
        )}
      </FormModal>
      <FormModal
        title="Withdraw notice"
        opened={!!withdrawing}
        onClose={() => setWithdrawing(undefined)}
        submit="Withdraw notice"
        danger
        request={() => ({ path: `/api/notices/${withdrawing!.noticeId}/withdrawal`, body: {} })}
        onDone={() => {
          setNotice(`Withdrew ${withdrawing?.title}.`);
          setWithdrawing(undefined);
          void load();
        }}
      >
        {() => <Text className="panel-text">{withdrawing?.title}. The list does not show it after this. A message that was sent on WhatsApp stays there.</Text>}
      </FormModal>
    </div>
  );
}
