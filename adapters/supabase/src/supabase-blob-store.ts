
import { createClient } from "@supabase/supabase-js";
import type { BlobStore } from "../../../packages/storage/src/contracts.js";
import type { StorageRef } from "../../../packages/core/src/types.js";

export class SupabaseBlobStore implements BlobStore {
  private readonly client;
  private readonly bucket: string;

  constructor(
    url: string,
    serviceRoleKey: string,
    bucket = "solocrate-blobs",
  ) {
    if (!url.trim() || !serviceRoleKey.trim()) {
      throw new Error("Supabase URL and service role key are required.");
    }

    if (!bucket.trim()) {
      throw new Error("Supabase bucket name is required.");
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    this.bucket = bucket;
  }

  async put(
    namespace: string,
    locator: string,
    content: Uint8Array,
  ): Promise<StorageRef> {
    if (!namespace.trim() || !locator.trim()) {
      throw new Error("Storage namespace and locator are required.");
    }

    if (content.length === 0) {
      throw new Error("Cannot store an empty file.");
    }

    const path = `${namespace}/${locator}`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, content, {
        upsert: true,
        contentType: "application/octet-stream",
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return {
      backend: "supabase",
      namespace: this.bucket,
      locator: path,
    };
  }

  async get(ref: StorageRef): Promise<Uint8Array> {
    this.validateRef(ref);

    const { data, error } = await this.client.storage
      .from(ref.namespace)
      .download(ref.locator);

    if (error) {
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    return new Uint8Array(await data.arrayBuffer());
  }

  async delete(ref: StorageRef): Promise<void> {
    this.validateRef(ref);

    const { error } = await this.client.storage
      .from(ref.namespace)
      .remove([ref.locator]);

    if (error) {
      throw new Error(`Supabase deletion failed: ${error.message}`);
    }
  }

  private validateRef(ref: StorageRef): void {
    if (ref.backend !== "supabase") {
      throw new Error(`Unsupported storage backend: ${ref.backend}`);
    }

    if (ref.namespace !== this.bucket) {
      throw new Error("Storage reference belongs to a different bucket.");
    }

    if (!ref.locator.trim()) {
      throw new Error("Storage locator is required.");
    }
  }
}
