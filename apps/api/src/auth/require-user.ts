import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublicKey =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY are required for authentication.",
  );
}

const authClient = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export type PlatformRole = "user" | "moderator" | "admin";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  platformRole?: PlatformRole;
}

export async function verifyAccessToken(
  authorization: string | undefined,
): Promise<AuthenticatedUser | null> {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return null;
  }

  try {
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    // Only app_metadata is trusted here. Users can edit user_metadata themselves.
    const configuredRole = data.user.app_metadata?.solocrate_role;
    const platformRole: PlatformRole =
      configuredRole === "admin" || configuredRole === "moderator"
        ? configuredRole
        : "user";
    return {
      id: data.user.id,
      ...(data.user.email ? { email: data.user.email } : {}),
      platformRole,
    };
  } catch {
    return null;
  }
}
