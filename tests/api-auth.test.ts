import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiServer } from "../apps/api/src/app.js";
import { InMemoryDataStore } from "../adapters/local/src/in-memory-data-store.js";
import { InMemoryBlobStore } from "./helpers/in-memory-blob-store.js";

describe("API authentication", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApiServer({
      dataStore: new InMemoryDataStore(),
      blobStore: new InMemoryBlobStore(),
      verifyAccessToken: async (authorization) => {
        if (authorization === "Bearer test-token") {
          return { id: "test-user" };
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

  it("accepts a valid test token", async () => {
    const response = await fetch(`${baseUrl}/sandboxes`, {
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sandboxes: [] });
  });
});
