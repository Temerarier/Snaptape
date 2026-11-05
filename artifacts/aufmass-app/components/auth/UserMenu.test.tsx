import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enUS } from "@/i18n/en-US";

const mock = vi.hoisted(() => ({
  signOut: vi.fn(),
  navigate: vi.fn(),
  pending: vi.fn(),
  failed: vi.fn(),
  stateIndex: 0,
  busy: false,
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: vi.fn(),
  useRef: () => ({ current: null }),
  useState: () => {
    const index = mock.stateIndex++;
    if (index === 0) return [true, vi.fn()];
    if (index === 1) return [mock.busy, mock.pending];
    return [false, mock.failed];
  },
}));
vi.mock("@clerk/nextjs", () => ({ useClerk: () => ({ signOut: mock.signOut }) }));
vi.mock("@/i18n/LocaleProvider", () => ({
  useDictionary: () => enUS,
  useLocale: () => "en-US",
}));
vi.mock("@/lib/auth/actions", () => ({ setLocaleAction: vi.fn() }));
vi.mock("next/link", () => ({ default: () => null }));

import { UserMenu } from "./UserMenu";

function logoutButton(node: ReactNode): ReactElement<{
  onClick: () => Promise<void>;
  disabled: boolean;
  type: string;
}> | undefined {
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.type === "button" && element.props.children === enUS.common.logout) {
    return element as ReturnType<typeof logoutButton>;
  }
  const children = element.props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = logoutButton(child as ReactNode);
    if (found) return found;
  }
  return undefined;
}

describe("UserMenu browser sign-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.stateIndex = 0;
    mock.busy = false;
    vi.stubGlobal("window", { location: { assign: mock.navigate } });
  });

  it("uses Clerk before a full document navigation, not a server-action form", async () => {
    mock.signOut.mockImplementation(async (done: () => void) => {
      expect(mock.navigate).not.toHaveBeenCalled();
      done();
    });
    const button = logoutButton(UserMenu({ email: "test@example.com" }))!;
    expect(button.props.type).toBe("button");
    await button.props.onClick();
    expect(mock.signOut).toHaveBeenCalledOnce();
    expect(mock.navigate).toHaveBeenCalledWith("/");
    expect(mock.pending.mock.calls).toEqual([[true], [false]]);
    expect(mock.failed.mock.calls).toEqual([[false]]);
  });

  it("keeps a failed sign-out on the current page and enables retry", async () => {
    mock.signOut.mockRejectedValue(new Error("Network unavailable"));
    const button = logoutButton(UserMenu({ email: "test@example.com" }))!;
    await expect(button.props.onClick()).resolves.toBeUndefined();
    expect(mock.navigate).not.toHaveBeenCalled();
    expect(mock.failed.mock.calls).toEqual([[false], [true]]);
    expect(mock.pending).toHaveBeenLastCalledWith(false);
  });

  it("does not submit again while sign-out is pending", async () => {
    mock.busy = true;
    const button = logoutButton(UserMenu({ email: "test@example.com" }))!;
    expect(button.props.disabled).toBe(true);
    await button.props.onClick();
    expect(mock.signOut).not.toHaveBeenCalled();
  });
});
