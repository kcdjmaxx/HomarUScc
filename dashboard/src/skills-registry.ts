// CRC: crc-ViewRegistry.md | Seq: seq-view-registration.md
// R401: Skills registry module — self-registration pattern for dashboard views

import type { ComponentType } from "react";

// R403: ViewProps interface — uniform props for sidebar skill components
export interface ViewProps {
  messages: any[];
  send: (type: string, payload: unknown) => void;
}

// R402: SkillRegistration interface with surface types
export interface SkillRegistration {
  id: string;                                    // unique slug
  name: string;                                  // display name
  icon: string;                                  // single character icon
  surface: "sidebar" | "apps" | "headless";
  order: number;                                 // position (sidebar sort, apps grid order)
  core: boolean;                                 // true = always enabled, not toggleable
  // sidebar-specific (R421)
  component?: ComponentType<ViewProps>;
  // apps-specific (R422)
  url?: string;
  description?: string;
  // headless-specific (R423)
  tools?: string[];
  timers?: string[];
}

// R419: Simple module-level array — no React context, no runtime mutation after initial import
const registrations: SkillRegistration[] = [];

// R404: Called at module scope by each skill file as import side effect
export function registerSkill(reg: SkillRegistration): void {
  registrations.push(reg);
}

// R401, R413: Returns sidebar skills sorted by order
export function getSidebarSkills(): SkillRegistration[] {
  return registrations
    .filter((r) => r.surface === "sidebar")
    .sort((a, b) => a.order - b.order);
}

// R401, R416: Returns apps skills sorted by order
export function getAppsSkills(): SkillRegistration[] {
  return registrations
    .filter((r) => r.surface === "apps")
    .sort((a, b) => a.order - b.order);
}

// R401, R424: Returns headless skills
export function getHeadlessSkills(): SkillRegistration[] {
  return registrations.filter((r) => r.surface === "headless");
}

// R417: Returns id of the first core sidebar skill by order (Chat)
export function getDefaultViewId(): string {
  const core = registrations
    .filter((r) => r.surface === "sidebar" && r.core)
    .sort((a, b) => a.order - b.order);
  return core.length > 0 ? core[0].id : "chat";
}
