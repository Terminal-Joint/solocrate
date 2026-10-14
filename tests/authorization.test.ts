import { describe, expect, it } from "vitest";
import { can } from "../packages/authorization/src/authorize.js";

describe("authorization", () => {
  it("rejects a user who does not own the membership", () => {
  expect(
    can(
      { userId: "user-b" },
      "resource:read",
      {
        membership: {
          userId: "user-a",
          sandboxId: "sandbox-1",
          role: "admin",
          createdAt: new Date().toISOString(),
        },
      },
    ),
  ).toBe(false);
});

it("rejects a resource from a different sandbox", () => {
  expect(
    can(
      { userId: "user-a" },
      "resource:read",
      {
        membership: {
          userId: "user-a",
          sandboxId: "sandbox-1",
          role: "admin",
          createdAt: new Date().toISOString(),
        },
        resource: {
          id: "resource-1",
          sandboxId: "sandbox-2",
        } as Parameters<typeof can>[2]["resource"],
      },
    ),
  ).toBe(false);
});
  it("allows an admin to manage a sandbox", () => {
    expect(can(
      { userId: "u1" },
      "sandbox:manage",
      { membership: { userId: "u1", sandboxId: "s1", role: "admin", createdAt: new Date().toISOString() } }
    )).toBe(true);
  });

  it("rejects a member creating resources", () => {
    expect(can(
      { userId: "u1" },
      "resource:create",
      { membership: { userId: "u1", sandboxId: "s1", role: "member", createdAt: new Date().toISOString() } }
    )).toBe(false);
  });
});
