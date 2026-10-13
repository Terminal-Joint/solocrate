
import { createClient } from "@supabase/supabase-js";
import type {
  DataStore,
} from "../../../packages/storage/src/contracts.js";
import type {
  Membership,
  Resource,
  ResourceVersion,
  Sandbox,
} from "../../../packages/core/src/types.js";

export class SupabaseDataStore implements DataStore {
  private readonly client;

  constructor(url: string, serviceRoleKey: string) {
    if (!url.trim() || !serviceRoleKey.trim()) {
      throw new Error("Supabase URL and service role key are required.");
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async createSandbox(sandbox: Sandbox): Promise<void> {
    const { error } = await this.client
      .from("solocrate_sandboxes")
      .upsert({ id: sandbox.id, data: sandbox });

    if (error) throw new Error(`Saving sandbox failed: ${error.message}`);
  }

  async getSandbox(id: string): Promise<Sandbox | null> {
    const { data, error } = await this.client
      .from("solocrate_sandboxes")
      .select("data")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Loading sandbox failed: ${error.message}`);
    return (data?.data as Sandbox | undefined) ?? null;
  }

  async getSandboxes(): Promise<Sandbox[]> {
    const { data, error } = await this.client
      .from("solocrate_sandboxes")
      .select("data")
      .order("id", { ascending: true });

    if (error) {
      throw new Error(`Loading sandboxes failed: ${error.message}`);
    }

    return (data ?? []).map((row) => row.data as Sandbox);
  }

  async createMembership(membership: Membership): Promise<void> {
    const { error } = await this.client
      .from("solocrate_memberships")
      .upsert({
        user_id: membership.userId,
        sandbox_id: membership.sandboxId,
        data: membership,
      });

    if (error) throw new Error(`Saving membership failed: ${error.message}`);
  }

  async getMembership(
    userId: string,
    sandboxId: string,
  ): Promise<Membership | null> {
    const { data, error } = await this.client
      .from("solocrate_memberships")
      .select("data")
      .eq("user_id", userId)
      .eq("sandbox_id", sandboxId)
      .maybeSingle();

    if (error) throw new Error(`Loading membership failed: ${error.message}`);
    return (data?.data as Membership | undefined) ?? null;
  }

  async createResource(resource: Resource): Promise<void> {
    const { error } = await this.client
      .from("solocrate_resources")
      .upsert({
        id: resource.id,
        sandbox_id: resource.sandboxId,
        data: resource,
      });

    if (error) throw new Error(`Saving resource failed: ${error.message}`);
  }

  async getResource(id: string): Promise<Resource | null> {
    const { data, error } = await this.client
      .from("solocrate_resources")
      .select("data")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Loading resource failed: ${error.message}`);
    return (data?.data as Resource | undefined) ?? null;
  }

  async getResources(): Promise<Resource[]> {
    const { data, error } = await this.client
      .from("solocrate_resources")
      .select("data")
      .order("id", { ascending: true });

    if (error) {
      throw new Error(`Loading resources failed: ${error.message}`);
    }

    return (data ?? []).map((row) => row.data as Resource);
  }

  async createResourceVersion(version: ResourceVersion): Promise<void> {
    const { error } = await this.client
      .from("solocrate_resource_versions")
      .upsert({
        id: version.id,
        resource_id: version.resourceId,
        version: version.version,
        data: version,
      });

    if (error) {
      throw new Error(`Saving resource version failed: ${error.message}`);
    }
  }

  async getResourceVersion(id: string): Promise<ResourceVersion | null> {
    const { data, error } = await this.client
      .from("solocrate_resource_versions")
      .select("data")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Loading resource version failed: ${error.message}`);
    }

    return (data?.data as ResourceVersion | undefined) ?? null;
  }

  async getResourceVersions(
    resourceId: string,
  ): Promise<ResourceVersion[]> {
    const { data, error } = await this.client
      .from("solocrate_resource_versions")
      .select("data")
      .eq("resource_id", resourceId)
      .order("version", { ascending: true });

    if (error) {
      throw new Error(`Loading resource versions failed: ${error.message}`);
    }

    return (data ?? []).map((row) => row.data as ResourceVersion);
  }
}
