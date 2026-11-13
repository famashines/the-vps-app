import { Badge, Button, NativeSelect, Table, Text, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useState } from "react";
import { LOW_STOCK, type Movement, type StockItem } from "../campus.ts";
import { Icon } from "../icons";
import { showDate, todayInPakistan } from "../school.ts";
import { FormModal, Notice, PageState, useLoad } from "./campusParts";

const whole = (text: string) => (/^\d{1,6}$/.test(text) ? Number(text) : undefined);
const wholeProblem = "Enter a whole number.";

export function Stock() {
  const [stock, load] = useLoad<{ items: StockItem[]; movements: Movement[] }>("/api/stock");
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<StockItem>();
  const [notice, setNotice] = useState<string>();

  return (
    <div className="account">
      <header className="page-head">
        <div>
          <Title order={1}>School stock</Title>
          <Text className="lead">The things the school keeps, and each change of a quantity with its reason.</Text>
        </div>
        <Button leftSection={<Icon name="add" size={16} />} onClick={() => setAdding(true)}>
          Add item
        </Button>
      </header>
      <Notice text={notice} />
      {typeof stock === "string" ? (
        <PageState state={stock} what="the stock" />
      ) : stock.items.length === 0 ? (
        <div className="panel state">
          <Text className="state-title">No item yet.</Text>
          <Text className="state-text">Add the first item, for example whiteboard markers.</Text>
        </div>
      ) : (
        <div className="years">
          <section className="panel panel-flush" aria-label="Items">
            <Table.ScrollContainer minWidth={520} type="native">
              <Table className="ruled" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Item</Table.Th>
                    <Table.Th className="money">In stock</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th className="row-action">
                      <VisuallyHidden>Actions</VisuallyHidden>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stock.items.map((i) => (
                    <Table.Tr key={i.itemId}>
                      <Table.Td className="name">{i.name}</Table.Td>
                      <Table.Td className="money">
                        {i.quantity} {i.unit}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" tt="none" color={i.quantity === 0 ? "red" : i.quantity <= LOW_STOCK ? "orange" : "green"}>
                          {i.quantity === 0 ? "Out of stock" : i.quantity <= LOW_STOCK ? "Low" : "In stock"}
                        </Badge>
                      </Table.Td>
                      <Table.Td className="row-action">
                        <Button variant="subtle" size="compact-sm" aria-label={`Change the stock of ${i.name}`} onClick={() => setMoving(i)}>
                          Stock in or out
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </section>
          <section className="panel" aria-labelledby="movements-title">
            <Title order={2} className="panel-title" id="movements-title">
              Newest changes
            </Title>
            {stock.movements.length === 0 ? (
              <Text className="panel-text">No change is recorded yet.</Text>
            ) : (
              <ul className="log">
                {stock.movements.slice(0, 20).map((m) => {
                  const item = stock.items.find((i) => i.itemId === m.itemId);
                  return (
                    <li key={m.movementId}>
                      <span className="log-text">
                        {m.change > 0 ? `+${m.change}` : m.change} {item?.unit} {item?.name ?? "item"}: {m.reason}
                      </span>
                      <span className="log-note">
                        {showDate(todayInPakistan(new Date(m.recordedAt)))}, then {m.quantity} in stock
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
      <FormModal
        title="Add item"
        opened={adding}
        onClose={() => setAdding(false)}
        submit="Add item"
        request={(value) => {
          const quantity = whole(value("quantity"));
          if (quantity === undefined) return { errors: { quantity: wholeProblem } };
          return { path: "/api/stock/items", body: { name: value("name"), unit: value("unit"), quantity } };
        }}
        onDone={(data) => {
          setAdding(false);
          setNotice(`Added ${data.name}.`);
          void load();
        }}
      >
        {(field) => (
          <>
            <TextInput name="name" label="Item" placeholder="Whiteboard markers" maxLength={200} autoComplete="off" data-autofocus required withAsterisk={false} {...field("name")} />
            <div className="pair">
              <TextInput name="quantity" label="In stock now" inputMode="numeric" autoComplete="off" placeholder="12" required withAsterisk={false} {...field("quantity")} />
              <TextInput name="unit" label="Unit" placeholder="box" maxLength={30} autoComplete="off" required withAsterisk={false} {...field("unit")} />
            </div>
          </>
        )}
      </FormModal>
      <FormModal
        title={moving ? `Stock of ${moving.name}` : "Stock"}
        opened={!!moving}
        onClose={() => setMoving(undefined)}
        submit="Record change"
        request={(value) => {
          const quantity = whole(value("quantity"));
          if (!quantity) return { errors: { change: "Enter a whole number above 0." } };
          if (value("direction") === "out" && quantity > moving!.quantity) return { errors: { change: `Only ${moving!.quantity} are in stock.` } };
          return { path: `/api/stock/items/${moving!.itemId}/movements`, body: { change: value("direction") === "out" ? -quantity : quantity, reason: value("reason") } };
        }}
        onDone={(data) => {
          setNotice(`${moving?.name}: ${data.quantity} ${moving?.unit} in stock now.`);
          setMoving(undefined);
          void load();
        }}
      >
        {(field) => (
          <>
            <Text className="panel-text">
              {moving?.quantity} {moving?.unit} in stock now.
            </Text>
            <div className="pair">
              <NativeSelect name="direction" label="Change" data={[{ value: "in", label: "Stock in" }, { value: "out", label: "Stock out" }]} classNames={{ input: "field-input" }} />
              <TextInput name="quantity" label="How many" inputMode="numeric" autoComplete="off" data-autofocus required withAsterisk={false} {...field("change")} />
            </div>
            <TextInput name="reason" label="Reason" placeholder="Given to Class 3" maxLength={200} autoComplete="off" required withAsterisk={false} {...field("reason")} />
          </>
        )}
      </FormModal>
    </div>
  );
}
