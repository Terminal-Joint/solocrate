
import type { BlobStore } from "../../packages/storage/src/contracts.js";
import type { StorageRef } from "../../packages/core/src/types.js";

export class InMemoryBlobStore implements BlobStore {
  private readonly blobs = new Map<string, Uint8Array>();

  async put(
    namespace: string,
    locator: string,
    content: Uint8Array,
  ): Promise<StorageRef> {
    this.blobs.set(`${namespace}:${locator}`, new Uint8Array(content));

    return {
      backend: "memory",
      namespace,
      locator,
    };
  }

  async get(ref: StorageRef): Promise<Uint8Array> {
    if (ref.backend !== "memory") {
      throw new Error(`Unsupported backend: ${ref.backend}`);
    }

    const content = this.blobs.get(`${ref.namespace}:${ref.locator}`);

    if (!content) {
      throw new Error("Blob not found.");
    }

    return new Uint8Array(content);
  }

  async delete(ref: StorageRef): Promise<void> {
    if (ref.backend !== "memory") {
      throw new Error(`Unsupported backend: ${ref.backend}`);
    }

    this.blobs.delete(`${ref.namespace}:${ref.locator}`);
  }
}
