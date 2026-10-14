import { createApiServer } from "./app.js";
import { verifyAccessToken } from "./auth/require-user.js";

import { InMemoryDataStore } from "../../../adapters/local/src/in-memory-data-store.js";
import { LocalBlobStore } from "../../../adapters/local/src/local-blob-store.js";
import { SupabaseBlobStore } from "../../../adapters/supabase/src/supabase-blob-store.js";
import { SupabaseDataStore } from "../../../adapters/supabase/src/supabase-data-store.js";

const PORT = Number(process.env.PORT ?? 3000);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET ?? "solocrate-blobs";
const isProduction = process.env.NODE_ENV === "production";

const useSupabase = Boolean(supabaseUrl && supabaseKey);

if (isProduction && !useSupabase) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.",
  );
}

const dataStore = useSupabase
  ? new SupabaseDataStore(supabaseUrl!, supabaseKey!)
  : new InMemoryDataStore();

const blobStore = useSupabase
  ? new SupabaseBlobStore(supabaseUrl!, supabaseKey!, supabaseBucket)
  : new LocalBlobStore(process.env.STORAGE_DIR ?? "./solocrate-data");

const server = createApiServer({
  dataStore,
  blobStore,
  verifyAccessToken,
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Solocrate API listening on ${PORT} (${useSupabase ? "Supabase" : "local"} storage)`,
  );
});
