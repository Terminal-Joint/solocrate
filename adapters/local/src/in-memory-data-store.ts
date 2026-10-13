
import type { DataStore } from "../../../packages/storage/src/contracts.js";
import type {
  Membership,
  Resource,
  ResourceVersion,
  Sandbox,
} from "../../../packages/core/src/types.js";

export class InMemoryDataStore implements DataStore {
  private readonly sandboxes = new Map<string, Sandbox>();
  private readonly memberships = new Map<string, Membership>();
  private readonly resources = new Map<string, Resource>();
  private readonly versions = new Map<string, ResourceVersion>();

  async createSandbox(sandbox: Sandbox): Promise<void> {
    this.sandboxes.set(sandbox.id, sandbox);
  }

  async getSandbox(id: string): Promise<Sandbox | null> {
    return this.sandboxes.get(id) ?? null;
  }

  async getSandboxes(): Promise<Sandbox[]> {
    return [...this.sandboxes.values()];
  }

  async createMembership(membership: Membership): Promise<void> {
    this.memberships.set(
      `${membership.userId}:${membership.sandboxId}`,
      membership,
    );
  }

  async getMembership(
    userId: string,
    sandboxId: string,
  ): Promise<Membership | null> {
    return this.memberships.get(`${userId}:${sandboxId}`) ?? null;
  }

  async createResource(resource: Resource): Promise<void> {
    this.resources.set(resource.id, resource);
  }

  async getResource(id: string): Promise<Resource | null> {
    return this.resources.get(id) ?? null;
  }

  async getResources(): Promise<Resource[]> {
    return [...this.resources.values()];
  }

  async createResourceVersion(version: ResourceVersion): Promise<void> {
    this.versions.set(version.id, version);
  }

  async getResourceVersion(id: string): Promise<ResourceVersion | null> {
    return this.versions.get(id) ?? null;
  }

  async getResourceVersions(resourceId: string): Promise<ResourceVersion[]> {
    return [...this.versions.values()]
      .filter((version) => version.resourceId === resourceId)
      .sort((a, b) => a.version - b.version);
  }
}
