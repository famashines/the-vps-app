import { Badge, Button, Group, NativeSelect, Table, Text, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useState } from "react";
import { labelOf, STAFF_ROLES, type StaffMember } from "../campus.ts";
import { Icon } from "../icons";
import { isMobile, phoneAsTyped, toE164, toLocal } from "../phone.ts";
import { showDate, todayInPakistan } from "../school.ts";
import { FormModal, Notice, PageState, useLoad } from "./campusParts";

export function Staff() {
  const today = todayInPakistan(new Date());
  const [staff, load] = useLoad<StaffMember[]>("/api/staff");
  const [editing, setEditing] = useState<StaffMember | "new">();
  const [leaving, setLeaving] = useState<StaffMember>();
  const [notice, setNotice] = useState<string>();
  const [shown, setShown] = useState<StaffMember>();
  const member = editing === "new" ? undefined : (editing ?? shown);

  const done = (text: string) => {
    setNotice(text);
    setEditing(undefined);
    setLeaving(undefined);
    void load();
  };

  return (
    <div className="account">
      <header className="page-head">
        <div>
          <Title order={1}>Staff</Title>
          <Text className="lead">The teachers and the other staff of the school. The staff attendance uses this list.</Text>
        </div>
        <Button leftSection={<Icon name="add" size={16} />} onClick={() => setEditing("new")}>
          Add staff member
        </Button>
      </header>
      <Notice text={notice} />
      {typeof staff === "string" ? (
        <PageState state={staff} what="the staff list" />
      ) : staff.length === 0 ? (
        <div className="panel state">
          <Text className="state-title">No staff member yet.</Text>
          <Text className="state-text">Add the teachers and the other staff. Then you can mark their attendance.</Text>
        </div>
      ) : (
        <section className="panel panel-flush" aria-label="Staff list">
          <Table.ScrollContainer minWidth={640} type="native">
            <Table className="ruled" withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Joined</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th className="row-action">
                    <VisuallyHidden>Actions</VisuallyHidden>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {staff.map((s) => (
                  <Table.Tr key={s.staffId}>
                    <Table.Td className="name">{s.name}</Table.Td>
                    <Table.Td>{labelOf(STAFF_ROLES, s.role)}</Table.Td>
                    <Table.Td className="num">{s.phone ? <a href={`tel:${s.phone}`} className="row-link">{toLocal(s.phone)}</a> : "Not given"}</Table.Td>
                    <Table.Td>{showDate(s.joinedOn)}</Table.Td>
                    <Table.Td>
                      {s.leftOn ? (
                        <Badge color="gray" variant="light" tt="none">
                          Left on {showDate(s.leftOn)}
                        </Badge>
                      ) : (
                        <Badge color="green" variant="light" tt="none">
                          Active
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td className="row-action">
                      <Group gap={4} wrap="nowrap" justify="flex-end">
                        <Button variant="subtle" size="compact-sm" aria-label={`Edit ${s.name}`} onClick={() => { setShown(s); setEditing(s); }}>
                          Edit
                        </Button>
                        {!s.leftOn && (
                          <Button variant="subtle" color="red" size="compact-sm" aria-label={`Mark ${s.name} as left`} onClick={() => setLeaving(s)}>
                            Mark as left
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </section>
      )}
      <FormModal
        title={member ? "Edit staff member" : "Add staff member"}
        opened={!!editing}
        onClose={() => setEditing(undefined)}
        submit={member ? "Save changes" : "Add staff member"}
        request={(value) => {
          if (value("phone") && !isMobile(value("phone"))) return { errors: { phone: "Enter the 11 digits of the mobile number, for example 0300 1234567." } };
          const body = { name: value("name"), role: value("role"), joinedOn: value("joinedOn"), ...(value("phone") && { phone: toE164(value("phone")) }) };
          return member ? { path: `/api/staff/${member.staffId}`, method: "PUT", body: { ...body, expectedVersion: member.version } } : { path: "/api/staff", body };
        }}
        onDone={(data) => done(member ? `Saved the changes of ${data.name}.` : `Added ${data.name}.`)}
      >
        {(field) => (
          <>
            <TextInput key={member?.staffId} name="name" label="Name" defaultValue={member?.name} maxLength={200} autoComplete="off" data-autofocus required withAsterisk={false} {...field("name")} />
            <div className="pair">
              <NativeSelect name="role" label="Role" data={STAFF_ROLES.map(([value, label]) => ({ value, label }))} defaultValue={member?.role ?? "teacher"} {...field("role")} />
              <TextInput name="joinedOn" label="Joining day" type="date" defaultValue={member?.joinedOn ?? today} required withAsterisk={false} {...field("joinedOn")} />
            </div>
            <TextInput
              name="phone"
              label="Phone (optional)"
              type="tel"
              inputMode="numeric"
              placeholder="0300 1234567"
              autoComplete="off"
              defaultValue={member?.phone ? toLocal(member.phone) : undefined}
              error={field("phone").error}
              classNames={{ input: "field-input" }}
              onChange={(event) => {
                field("phone").onChange();
                event.currentTarget.value = phoneAsTyped(event.currentTarget.value);
              }}
            />
          </>
        )}
      </FormModal>
      <FormModal
        title="Mark as left"
        opened={!!leaving}
        onClose={() => setLeaving(undefined)}
        submit="Mark as left"
        danger
        request={(value) => ({ path: `/api/staff/${leaving!.staffId}/leaving`, body: { leftOn: value("leftOn") } })}
        onDone={() => done(`Marked ${leaving?.name} as left.`)}
      >
        {(field) => (
          <>
            <Text className="panel-text">{leaving?.name} stays in the list and in the old attendance sheets. New sheets after the leaving day do not have this person.</Text>
            <TextInput name="leftOn" label="Leaving day" type="date" defaultValue={today} max={today} min={leaving?.joinedOn} required withAsterisk={false} {...field("leftOn")} />
          </>
        )}
      </FormModal>
    </div>
  );
}
