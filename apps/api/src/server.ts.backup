import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { createSandbox } from "../../../packages/core/src/sandbox.js";
import { createResource } from "../../../packages/core/src/resource.js";
import { createResourceVersion } from "../../../packages/core/src/resource-version.js";
import type {
  Resource,
  ResourceVersion,
  StorageRef,
} from "../../../packages/core/src/types.js";

import { LocalBlobStore } from "../../../adapters/local/src/local-blob-store.js";
import { SupabaseBlobStore } from "../../../adapters/supabase/src/supabase-blob-store.js";

const PORT = Number(process.env.PORT ?? 3000);
const OWNER_ID = "local-user";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Uses the API server's filesystem.
// Set STORAGE_DIR to a persistent disk path when available.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET ?? "solocrate-blobs";

const isProduction = process.env.NODE_ENV === "production";

const blobStore =
  supabaseUrl && supabaseKey
    ? new SupabaseBlobStore(supabaseUrl, supabaseKey, supabaseBucket)
    : isProduction
      ? (() => {
          throw new Error(
            "Supabase environment variables are required in production.",
          );
        })()
      : new LocalBlobStore(
          process.env.STORAGE_DIR ?? "./solocrate-data",
        );

const sandboxes = new Map<
  string,
  ReturnType<typeof createSandbox>
>();
const resources = new Map<string, Resource>();
const versions = new Map<string, ResourceVersion>();

function json(
  res: ServerResponse,
  status: number,
  data: unknown,
) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const path = url.pathname;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-File-Name",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    return res.end();
  }

  if (method === "GET" && path === "/health") {
    return json(res, 200, {
      ok: true,
      service: "solocrate-api",
    });
  }

  if (method === "GET" && path === "/sandboxes") {
    return json(res, 200, {
      sandboxes: [...sandboxes.values()].map((item) => item.sandbox),
    });
  }

  if (method === "POST" && path === "/sandboxes") {
    try {
      const input = await readJson(req);
      const result = createSandbox({
        ownerId: OWNER_ID,
        name: typeof input.name === "string" ? input.name : "",
        description:
          typeof input.description === "string"
            ? input.description
            : undefined,
      });

      sandboxes.set(result.sandbox.id, result);

      return json(res, 201, {
        sandbox: result.sandbox,
        membership: result.ownerMembership,
      });
    } catch (error) {
      return json(res, 400, {
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  if (method === "GET" && path === "/resources") {
    return json(res, 200, {
      resources: [...resources.values()],
    });
  }

  if (method === "POST" && path === "/resources") {
    try {
      const input = await readJson(req);

      const resource = createResource({
        sandboxId:
          typeof input.sandboxId === "string" ? input.sandboxId : "",
        ownerId: OWNER_ID,
        title: typeof input.title === "string" ? input.title : "",
        type:
          typeof input.type === "string"
            ? (input.type as Parameters<typeof createResource>[0]["type"])
            : "custom",
        description:
          typeof input.description === "string"
            ? input.description
            : undefined,
        visibility:
          typeof input.visibility === "string"
            ? (input.visibility as Parameters<typeof createResource>[0]["visibility"])
            : undefined,
      });

      if (!sandboxes.has(resource.sandboxId)) {
        return json(res, 400, { error: "Sandbox not found." });
      }

      resources.set(resource.id, resource);

      return json(res, 201, { resource });
    } catch (error) {
      return json(res, 400, {
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  }

  // Upload a file to an existing resource.
  const uploadMatch = path.match(/^\/resources\/([^/]+)\/content$/);

  if (method === "POST" && uploadMatch) {
    try {
      const resourceId = decodeURIComponent(uploadMatch[1]);
      const resource = resources.get(resourceId);

      if (!resource) {
        return json(res, 404, { error: "Resource not found." });
      }

      const content = await readBody(req);

      if (content.length === 0) {
        return json(res, 400, { error: "Uploaded file is empty." });
      }

      const versionNumber =
        [...versions.values()].filter(
          (version) => version.resourceId === resourceId,
        ).length + 1;

      const locator = `resources/${resourceId}/v${versionNumber}.bin`;

      const storageRef: StorageRef = await blobStore.put(
        resource.sandboxId,
        locator,
        content,
      );

      const version = createResourceVersion({
        resourceId,
        version: versionNumber,
        createdBy: OWNER_ID,
        storageRef,
      });

      versions.set(version.id, version);
      resource.currentVersionId = version.id;
      resource.updatedAt = new Date().toISOString();

      return json(res, 201, {
        resource,
        version,
        filename: req.headers["x-file-name"] ?? "download.bin",
        size: content.length,
      });
    } catch (error) {
      return json(res, 400, {
        error: error instanceof Error ? error.message : "Upload failed.",
      });
    }
  }

  // Download the resource's latest uploaded content.
  const downloadMatch = path.match(/^\/resources\/([^/]+)\/content$/);

  if (method === "GET" && downloadMatch) {
    try {
      const resourceId = decodeURIComponent(downloadMatch[1]);
      const resource = resources.get(resourceId);

      if (!resource) {
        return json(res, 404, { error: "Resource not found." });
      }

      if (!resource.currentVersionId) {
        return json(res, 404, { error: "No file uploaded for this resource." });
      }

      const version = versions.get(resource.currentVersionId);

      if (!version?.storageRef) {
        return json(res, 404, { error: "Stored file reference not found." });
      }

      const content = await blobStore.get(version.storageRef);

      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": content.length,
        "Content-Disposition": 'attachment; filename="download.bin"',
        "Access-Control-Allow-Origin": "*",
      });

      return res.end(Buffer.from(content));
    } catch (error) {
      return json(res, 500, {
        error: error instanceof Error ? error.message : "Download failed.",
      });
    }
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Solocrate API listening on ${PORT}`);
});
