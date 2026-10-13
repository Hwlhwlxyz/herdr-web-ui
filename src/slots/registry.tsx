/**
 * The slot registry: the only bridge between App.tsx and the extensions under src/ext/.
 * App calls `menuItems(...)` and renders `<Slot />`; extensions call `registerMenuItems` and
 * `registerSlot` from their index.ts (loaded by src/ext/load.ts). An extension that throws is
 * dropped from that render, never the app.
 */
import { type ComponentType } from "react";

import type { RowMenuItem } from "../components/RowMenu.tsx";
import { RenderBoundary } from "../components/RenderBoundary.tsx";
import type { AppSlotContext, MenuSlotName, ViewSlotName } from "./types.ts";

export type { AppSlotContext, MenuSlotName, ViewSlotName } from "./types.ts";

type MenuProvider = (ctx: AppSlotContext) => RowMenuItem[];
export type SlotComponent = ComponentType<{ ctx: AppSlotContext }>;

const menus = new Map<MenuSlotName, { id: string; provider: MenuProvider }[]>();
const views = new Map<ViewSlotName, { id: string; component: SlotComponent }[]>();

/** Adds rows to a menu; `id` names the extension, and registering it again replaces its rows (HMR). */
export function registerMenuItems(slot: MenuSlotName, id: string, provider: MenuProvider): void {
  menus.set(slot, [...(menus.get(slot) ?? []).filter((entry) => entry.id !== id), { id, provider }]);
}

/** Draws a component into a place; `id` as for registerMenuItems. */
export function registerSlot(slot: ViewSlotName, id: string, component: SlotComponent): void {
  views.set(slot, [...(views.get(slot) ?? []).filter((entry) => entry.id !== id), { id, component }]);
}

/** The rows the extensions add to `slot`, in registration order. */
export function menuItems(slot: MenuSlotName, ctx: AppSlotContext): RowMenuItem[] {
  return (menus.get(slot) ?? []).flatMap(({ id, provider }) => {
    try {
      return provider(ctx);
    } catch (error) {
      console.error(`slot ${slot}: extension ${id} failed`, error);
      return [];
    }
  });
}

/** Renders every component registered for `name`, each inside its own error boundary. */
export function Slot({ name, ctx }: { name: ViewSlotName; ctx: AppSlotContext }) {
  return <>{(views.get(name) ?? []).map(({ id, component: View }) => (
    <RenderBoundary key={id} resetKey={ctx.pane?.pane_id ?? null} fallback={() => null}>
      <View ctx={ctx} />
    </RenderBoundary>
  ))}</>;
}
