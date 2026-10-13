
import type {
  Membership,
  Resource,
  ResourceVersion,
  Sandbox,
  StorageRef,
} from "../../core/src/types.js";

export interface DataStore {
  createSandbox(sandbox: Sandbox): Promise<void>;
  getSandbox(id: string): Promise<Sandbox | null>;
  getSandboxes(): Promise<Sandbox[]>;

  createMembership(membership: Membership): Promise<void>;
  getMembership(
    userId: string,
    sandboxId: string,
  ): Promise<Membership | null>;

  createResource(resource: Resource): Promise<void>;
  getResource(id: string): Promise<Resource | null>;
  getResources(): Promise<Resource[]>;

  createResourceVersion(version: ResourceVersion): Promise<void>;
  getResourceVersion(id: string): Promise<ResourceVersion | null>;
  getResourceVersions(resourceId: string): Promise<ResourceVersion[]>;
}

export interface BlobStore {
  put(
    namespace: string,
    locator: string,
    content: Uint8Array,
  ): Promise<StorageRef>;

  get(ref: StorageRef): Promise<Uint8Array>;
  delete(ref: StorageRef): Promise<void>;
}

export interface StorageBackend {
  name: string;
  data: DataStore;
  blobs: BlobStore;
}
