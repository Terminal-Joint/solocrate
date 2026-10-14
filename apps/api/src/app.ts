
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { createSandbox } from "../../../packages/core/src/sandbox.js";
import { createResource } from "../../../packages/core/src/resource.js";
import { createResourceVersion } from "../../../packages/core/src/resource-version.js";
import type {
  Actor,
  Resource,
  StorageRef,
} from "../../../packages/core/src/types.js";

import { can } from "../../../packages/authorization/src/authorize.js";


import type { DataStore, BlobStore } from "../../../packages/storage/src/contracts.js";
import type { AuthenticatedUser } from "./auth/require-user.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedOrigins = new Set([
  "https://terminal-joint.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

export interface ApiServerOptions {
  dataStore: DataStore;
  blobStore: BlobStore;
  verifyAccessToken: (
    authorization: string | undefined,
  ) => Promise<AuthenticatedUser | null>;
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-File-Name",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function json(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  data: unknown,
): void {
  applyCors(req, res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_FILE_SIZE) {
      throw new Error("File is too large. Maximum size is 10 MB.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readJson(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  const buffer = await readBody(req);
  if (!buffer.length) return {};

  const value: unknown = JSON.parse(buffer.toString("utf8"));

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

async function authenticate(
  req: IncomingMessage,
  verifyToken: ApiServerOptions["verifyAccessToken"],
) {
  return verifyToken(req.headers.authorization);
}

function isResourceVisibleTo(
  resource: Resource,
  userId: string,
  role: string,
): boolean {
  // Public access is deliberately not anonymous in this first secure release.
  // A public resource still requires sandbox membership.
  if (resource.visibility === "private") {
    return resource.ownerId === userId || role === "admin";
  }

  return true;
}


export function createApiServer({
  dataStore,
  blobStore,
  verifyAccessToken,
}: ApiServerOptions) {
  async function getMembership(userId: string, sandboxId: string) {
    return dataStore.getMembership(userId, sandboxId);
  }

  return createServer(async (req, res) => {
  applyCors(req, res);

  try {
    const method = req.method ?? "GET";
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const path = url.pathname;

    if (method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    if (method === "GET" && path === "/health") {
      return json(req, res, 200, {
        ok: true,
        service: "solocrate-api",
      });
    }

    // Every route below this point requires a valid Supabase access token.
    const user = await authenticate(req, verifyAccessToken);
    if (!user) {
      return json(req, res, 401, {
        error: "Authentication required. Please sign in.",
      });
    }

    const actor: Actor = { userId: user.id };

    if (method === "GET" && path === "/sandboxes") {
      const allSandboxes = await dataStore.getSandboxes();
      const sandboxes = [];

      for (const sandbox of allSandboxes) {
        const membership = await getMembership(user.id, sandbox.id);

        if (
          membership &&
          can(actor, "sandbox:read", { membership })
        ) {
          sandboxes.push(sandbox);
        }
      }

      return json(req, res, 200, { sandboxes });
    }

    if (method === "POST" && path === "/sandboxes") {
      try {
        const input = await readJson(req);

        const result = createSandbox({
          ownerId: user.id,
          name: typeof input.name === "string" ? input.name : "",
          description:
            typeof input.description === "string"
              ? input.description
              : undefined,
        });

        await dataStore.createSandbox(result.sandbox);
        await dataStore.createMembership(result.ownerMembership);

        return json(req, res, 201, {
          sandbox: result.sandbox,
          membership: result.ownerMembership,
        });
      } catch (error) {
        return json(req, res, 400, {
          error: error instanceof Error
            ? error.message
            : "Sandbox creation failed.",
        });
      }
    }

    if (method === "GET" && path === "/resources") {
      const allResources = await dataStore.getResources();
      const resources: Resource[] = [];

      for (const resource of allResources) {
        const membership = await getMembership(user.id, resource.sandboxId);

        if (
          membership &&
          can(actor, "resource:read", { membership, resource }) &&
          isResourceVisibleTo(resource, user.id, membership.role)
        ) {
          resources.push(resource);
        }
      }

      return json(req, res, 200, { resources });
    }

    if (method === "POST" && path === "/resources") {
      try {
        const input = await readJson(req);
        const sandboxId =
          typeof input.sandboxId === "string" ? input.sandboxId : "";

        const sandbox = await dataStore.getSandbox(sandboxId);

        if (!sandbox) {
          return json(req, res, 404, { error: "Sandbox not found." });
        }

        const membership = await getMembership(user.id, sandboxId);

        if (
          !membership ||
          !can(actor, "resource:create", { membership })
        ) {
          return json(req, res, 403, {
            error: "You do not have permission to create resources here.",
          });
        }

        const resource = createResource({
          sandboxId,
          ownerId: user.id,
          title: typeof input.title === "string" ? input.title : "",
          type: typeof input.type === "string"
            ? input.type as Parameters<typeof createResource>[0]["type"]
            : "custom",
          description: typeof input.description === "string"
            ? input.description
            : undefined,
          visibility: typeof input.visibility === "string"
            ? input.visibility as Parameters<typeof createResource>[0]["visibility"]
            : undefined,
        });

        await dataStore.createResource(resource);

        return json(req, res, 201, { resource });
      } catch (error) {
        return json(req, res, 400, {
          error: error instanceof Error
            ? error.message
            : "Resource creation failed.",
        });
      }
    }

    const contentMatch = path.match(/^\/resources\/([^/]+)\/content$/);

    if (contentMatch && (method === "POST" || method === "GET")) {
      const resourceId = decodeURIComponent(contentMatch[1]);
      const resource = await dataStore.getResource(resourceId);

      if (!resource) {
        return json(req, res, 404, { error: "Resource not found." });
      }

      const membership = await getMembership(user.id, resource.sandboxId);

      if (!membership) {
        return json(req, res, 403, {
          error: "You are not a member of this resource's sandbox.",
        });
      }

      if (
        !isResourceVisibleTo(resource, user.id, membership.role)
      ) {
        return json(req, res, 403, {
          error: "You do not have permission to access this private resource.",
        });
      }

      if (method === "POST") {
        if (!can(actor, "resource:update", { membership, resource })) {
          return json(req, res, 403, {
            error: "You do not have permission to upload to this resource.",
          });
        }

        try {
          const content = await readBody(req);

          if (content.length === 0) {
            return json(req, res, 400, {
              error: "Uploaded file is empty.",
            });
          }

          const versions = await dataStore.getResourceVersions(resourceId);
          const versionNumber =
            versions.reduce(
              (highest, version) => Math.max(highest, version.version),
              0,
            ) + 1;

          const locator = `resources/${resourceId}/v${versionNumber}.bin`;

          const storageRef: StorageRef = await blobStore.put(
            resource.sandboxId,
            locator,
            content,
          );

          const version = createResourceVersion({
            resourceId,
            version: versionNumber,
            createdBy: user.id,
            storageRef,
          });

          await dataStore.createResourceVersion(version);

          resource.currentVersionId = version.id;
          resource.updatedAt = new Date().toISOString();

          await dataStore.createResource(resource);

          return json(req, res, 201, {
            resource,
            version,
            filename: req.headers["x-file-name"] ?? "download.bin",
            size: content.length,
          });
        } catch (error) {
          return json(req, res, 400, {
            error: error instanceof Error
              ? error.message
              : "Upload failed.",
          });
        }
      }

      if (!can(actor, "resource:read", { membership, resource })) {
        return json(req, res, 403, {
          error: "You do not have permission to download this resource.",
        });
      }

      if (!resource.currentVersionId) {
        return json(req, res, 404, {
          error: "No file uploaded for this resource.",
        });
      }

      const version = await dataStore.getResourceVersion(
        resource.currentVersionId,
      );

      if (!version?.storageRef) {
        return json(req, res, 404, {
          error: "Stored file reference not found.",
        });
      }

      const content = await blobStore.get(version.storageRef);

      applyCors(req, res);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": content.length,
        "Content-Disposition": 'attachment; filename="download.bin"',
        "Cache-Control": "no-store",
      });

      return res.end(Buffer.from(content));
    }

    return json(req, res, 404, { error: "Not found." });
  } catch (error) {
    console.error("API request failed:", error);

    return json(req, res, 500, {
      error: "An internal server error occurred.",
    });
  }
});

}
