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

    await dataStore.createMembership({
      userId: "contributor-user",
      sandboxId: sandbox.id,
      role: "contributor",
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
        if (authorization === "Bearer contributor-token") {
          return { id: "contributor-user" };
        }
        if (authorization === "Bearer outsider-token") {
          return { id: "outsider" };
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

  it("prevents a non-member from accessing resource content", async () => {
    const response = await fetch(
      `${baseUrl}/resources/private-resource/content`,
      {
        headers: {
          Authorization: "Bearer outsider-token",
        },
      },
    );

    expect(response.status).toBe(403);
  });

  it("does not list resources from sandboxes the user cannot access", async () => {
    const response = await fetch(`${baseUrl}/resources`, {
      headers: {
        Authorization: "Bearer outsider-token",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resources: [] });
  });


  it("prevents a non-member from creating resources", async () => {
    const response = await fetch(`${baseUrl}/resources`, {
      method: "POST",
      headers: {
        Authorization: "Bearer outsider-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sandboxId: "private-sandbox",
        title: "Unauthorized resource",
        type: "custom",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("prevents a regular member from creating resources", async () => {
    const response = await fetch(`${baseUrl}/resources`, {
      method: "POST",
      headers: {
        Authorization: "Bearer other-user-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sandboxId: "private-sandbox",
        title: "Member resource",
        type: "custom",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("allows a contributor to create a resource and upload content", async () => {
    const createResponse = await fetch(`${baseUrl}/resources`, {
      method: "POST",
      headers: {
        Authorization: "Bearer contributor-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sandboxId: "private-sandbox",
        title: "Contributor resource",
        type: "custom",
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const resourceId = created.resource.id as string;

    const uploadResponse = await fetch(
      `${baseUrl}/resources/${encodeURIComponent(resourceId)}/content`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer contributor-token",
          "Content-Type": "application/octet-stream",
          "X-File-Name": "test.txt",
        },
        body: "Solocrate authorization test",
      },
    );

    expect(uploadResponse.status).toBe(201);
  });

});
