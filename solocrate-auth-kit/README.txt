SOLOCRATE AUTHENTICATION STARTER PATCH

Files:
- apps/api/src/server.ts
- apps/web/index.html
- apps/web/app.js

IMPORTANT BEFORE COPYING
1. Back up your current files or commit your current branch.
2. These are replacement files, not an automatic edit of your local repo.
3. The frontend key is a publishable key and is intentionally public. Never put SUPABASE_SERVICE_ROLE_KEY in apps/web.
4. The API auth helper at apps/api/src/auth/require-user.ts is assumed to be the helper already created in your branch.

API ENVIRONMENT
Set these in Render:
- SUPABASE_URL=https://wcnfajciipuimcvueynx.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=<existing server-only service-role secret>
- SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key, same project>
- SUPABASE_BUCKET=solocrate-blobs
- CORS_ALLOWED_ORIGINS=https://terminal-joint.github.io,http://localhost:5500,http://127.0.0.1:5500
- NODE_ENV=production

Do not paste secrets into chat, Git, source files, or frontend settings.

NOTES
- The app currently requires sandbox membership even for resources marked public. This is an intentional conservative first release; public/anonymous sharing should be implemented separately with explicit rules.
- Existing records owned by local-user are not automatically transferred to the first account. Plan a deliberate migration after confirming the first account's UUID.
- This starter protects routes but should be followed by automated authorization tests and a review of rate limits, signup confirmation, and storage/database RLS policies.
