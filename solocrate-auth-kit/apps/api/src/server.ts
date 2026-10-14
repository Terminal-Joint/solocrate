import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createSandbox } from "../../../packages/core/src/sandbox.js";
import { createResource } from "../../../packages/core/src/resource.js";
import { createResourceVersion } from "../../../packages/core/src/resource-version.js";
import type { Actor, Resource, StorageRef } from "../../../packages/core/src/types.js";
import { can } from "../../../packages/authorization/src/authorize.js";
import { verifyAccessToken, type AuthenticatedUser } from "./auth/require-user.js";
import { InMemoryDataStore } from "../../../adapters/local/src/in-memory-data-store.js";
import { LocalBlobStore } from "../../../adapters/local/src/local-blob-store.js";
import { SupabaseBlobStore } from "../../../adapters/supabase/src/supabase-blob-store.js";
import { SupabaseDataStore } from "../../../adapters/supabase/src/supabase-data-store.js";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET ?? "solocrate-blobs";
const isProduction = process.env.NODE_ENV === "production";
const useSupabase = Boolean(supabaseUrl && supabaseKey);
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS ?? "https://terminal-joint.github.io,http://localhost:5500,http://127.0.0.1:5500")
    .split(",").map((origin) => origin.trim()).filter(Boolean),
);

if (isProduction && !useSupabase) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.");
}
const dataStore = useSupabase
  ? new SupabaseDataStore(supabaseUrl!, supabaseKey!)
  : new InMemoryDataStore();
const blobStore = useSupabase
  ? new SupabaseBlobStore(supabaseUrl!, supabaseKey!, supabaseBucket)
  : new LocalBlobStore(process.env.STORAGE_DIR ?? "./solocrate-data");

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-File-Name");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return !origin || allowedOrigins.has(origin);
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_FILE_SIZE) throw new Error("File is too large. Maximum size is 10 MB.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const buffer = await readBody(req);
  if (!buffer.length) return {};
  const value: unknown = JSON.parse(buffer.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

async function membershipFor(user: AuthenticatedUser, sandboxId: string) {
  return dataStore.getMembership(user.id, sandboxId);
}

function canReadResource(user: AuthenticatedUser, resource: Resource, role: string): boolean {
  if (resource.visibility === "private" && resource.ownerId !== user.id && role !== "admin") return false;
  // Public links are not anonymous in this first secure release: sandbox membership is still required.
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const originAllowed = applyCors(req, res);
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;

    if (method === "OPTIONS") {
      res.writeHead(originAllowed ? 204 : 403);
      return res.end();
    }
    if (!originAllowed) return json(res, 403, { error: "Origin is not allowed." });
    if (method === "GET" && path === "/health") {
      return json(res, 200, { ok: true, service: "solocrate-api" });
    }

    const user = await verifyAccessToken(req.headers.authorization);
    if (!user) return json(res, 401, { error: "Sign in required. Please sign in and try again." });
    const actor: Actor = { userId: user.id };

    if (method === "GET" && path === "/sandboxes") {
      const all = await dataStore.getSandboxes();
      const visible = [];
      for (const sandbox of all) {
        const membership = await membershipFor(user, sandbox.id);
        if (membership && can(actor, "sandbox:read", { membership })) visible.push(sandbox);
      }
      return json(res, 200, { sandboxes: visible });
    }

    if (method === "POST" && path === "/sandboxes") {
      try {
        const input = await readJson(req);
        const result = createSandbox({
          ownerId: user.id,
          name: typeof input.name === "string" ? input.name : "",
          description: typeof input.description === "string" ? input.description : undefined,
        });
        await dataStore.createSandbox(result.sandbox);
        await dataStore.createMembership(result.ownerMembership);
        return json(res, 201, { sandbox: result.sandbox, membership: result.ownerMembership });
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : "Sandbox creation failed." });
      }
    }

    if (method === "GET" && path === "/resources") {
      const all = await dataStore.getResources();
      const visible: Resource[] = [];
      for (const resource of all) {
        const membership = await membershipFor(user, resource.sandboxId);
        if (!membership || !can(actor, "resource:read", { membership, resource })) continue;
        if (canReadResource(user, resource, membership.role)) visible.push(resource);
      }
      return json(res, 200, { resources: visible });
    }

    if (method === "POST" && path === "/resources") {
      try {
        const input = await readJson(req);
        const sandboxId = typeof input.sandboxId === "string" ? input.sandboxId : "";
        const sandbox = await dataStore.getSandbox(sandboxId);
        if (!sandbox) return json(res, 404, { error: "Sandbox not found." });
        const membership = await membershipFor(user, sandboxId);
        if (!membership || !can(actor, "resource:create", { membership })) {
          return json(res, 403, { error: "You do not have permission to create resources in this sandbox." });
        }
        const resource = createResource({
          sandboxId,
          ownerId: user.id,
          title: typeof input.title === "string" ? input.title : "",
          type: typeof input.type === "string" ? input.type as Parameters<typeof createResource>[0]["type"] : "custom",
          description: typeof input.description === "string" ? input.description : undefined,
          visibility: typeof input.visibility === "string" ? input.visibility as Parameters<typeof createResource>[0]["visibility"] : undefined,
        });
        await dataStore.createResource(resource);
        return json(res, 201, { resource });
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : "Resource creation failed." });
      }
    }

    const contentMatch = path.match(/^\/resources\/([^/]+)\/content$/);
    if (contentMatch && method === "POST") {
      try {
        const resourceId = decodeURIComponent(contentMatch[1]);
        const resource = await dataStore.getResource(resourceId);
        if (!resource) return json(res, 404, { error: "Resource not found." });
        const membership = await membershipFor(user, resource.sandboxId);
        if (!membership || !can(actor, "resource:update", { membership, resource })) {
          return json(res, 403, { error: "You do not have permission to upload to this resource." });
        }
        if (resource.visibility === "private" && resource.ownerId !== user.id && membership.role !== "admin") {
          return json(res, 403, { error: "You do not have permission to modify this private resource." });
        }
        const content = await readBody(req);
        if (content.length === 0) return json(res, 400, { error: "Uploaded file is empty." });
        const existingVersions = await dataStore.getResourceVersions(resourceId);
        const versionNumber = existingVersions.reduce((highest, version) => Math.max(highest, version.version), 0) + 1;
        const locator = `resources/${resourceId}/v${versionNumber}.bin`;
        const storageRef: StorageRef = await blobStore.put(resource.sandboxId, locator, content);
        const version = createResourceVersion({ resourceId, version: versionNumber, createdBy: user.id, storageRef });
        await dataStore.createResourceVersion(version);
        resource.currentVersionId = version.id;
        resource.updatedAt = new Date().toISOString();
        await dataStore.createResource(resource);
        return json(res, 201, { resource, version, filename: req.headers["x-file-name"] ?? "download.bin", size: content.length });
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : "Upload failed." });
      }
    }

    if (contentMatch && method === "GET") {
      try {
        const resourceId = decodeURIComponent(contentMatch[1]);
        const resource = await dataStore.getResource(resourceId);
        if (!resource) return json(res, 404, { error: "Resource not found." });
        const membership = await membershipFor(user, resource.sandboxId);
        if (!membership || !can(actor, "resource:read", { membership, resource }) || !canReadResource(user, resource, membership.role)) {
          return json(res, 403, { error: "You do not have permission to download this resource." });
        }
        if (!resource.currentVersionId) return json(res, 404, { error: "No file uploaded for this resource." });
        const version = await dataStore.getResourceVersion(resource.currentVersionId);
        if (!version?.storageRef) return json(res, 404, { error: "Stored file reference not found." });
        const content = await blobStore.get(version.storageRef);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": content.length,
          "Content-Disposition": 'attachment; filename="download.bin"',
        });
        return res.end(Buffer.from(content));
      } catch (error) {
        console.error("Resource download failed:", error);
        return json(res, 500, { error: "Download failed." });
      }
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("API request failed:", error);
    return json(res, 500, { error: "An internal server error occurred." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Solocrate API listening on ${PORT} (${useSupabase ? "Supabase" : "local"} storage)`);
});
