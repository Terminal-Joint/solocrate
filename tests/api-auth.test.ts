import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiServer } from "../apps/api/src/app.js";
import { InMemoryDataStore } from "../adapters/local/src/in-memory-data-store.js";
import { InMemoryBlobStore } from "./helpers/in-memory-blob-store.js";
import { createSandbox } from "../packages/core/src/sandbox.js";
import { createResource } from "../packages/core/src/resource.js";


describe("API authentication", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const dataStore = new InMemoryDataStore();

    const { sandbox, ownerMembership } = createSandbox({
      id: "private-sandbox",
      name: "Private sandbox",
      ownerId: "test-user",
    });

    await dataStore.createSandbox(sandbox);
    await dataStore.createMembership(ownerMembership);
    await dataStore.createMembership({
      userId: "other-user",
      sandboxId: sandbox.id,
      role: "member",
      createdAt: new Date().toISOString(),
    });

    await dataStore.createResource(createResource({
      id: "private-resource",
      sandboxId: sandbox.id,
      ownerId: "test-user",
      title: "Secret",
      type: "custom",
      visibility: "private",
    }));

    server = createApiServer({
      dataStore,
      blobStore: new InMemoryBlobStore(),
      verifyAccessToken: async (authorization) => {
        if (authorization === "Bearer test-token") {
          return { id: "test-user" };
        }
        if (authorization === "Bearer other-user-token") {
          return { id: "other-user" };
        }
        return null;
      },
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it("allows health checks without authentication", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "solocrate-api",
    });
  });

  it("rejects requests without an access token", async () => {
    const response = await fetch(`${baseUrl}/sandboxes`);

    expect(response.status).toBe(401);
  });


it("rejects invalid access tokens", async () => {
  const response = await fetch(`${baseUrl}/sandboxes`, {
    headers: {
      Authorization: "Bearer invalid-token",
    },
  });

  expect(response.status).toBe(401);
});


  it("accepts a valid test token", async () => {
    const response = await fetch(`${baseUrl}/sandboxes`, {
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sandboxes: [
        {
          id: "private-sandbox",
          name: "Private sandbox",
          slug: "private-sandbox",
          createdAt: expect.any(String),
        },
      ],
    });
  });

  it("prevents another member from accessing a private resource", async () => {
    const response = await fetch(
      `${baseUrl}/resources/private-resource/content`,
      {
        headers: {
          Authorization: "Bearer other-user-token",
        },
      },
    );

    expect(response.status).toBe(403);
  });
});
