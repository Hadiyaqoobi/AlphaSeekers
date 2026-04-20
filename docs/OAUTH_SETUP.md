# Google OAuth Setup

AlphaSeekers uses Google Sign-In in two places:

1. **NextAuth Google provider** — used by the main `Sign in with Google` flow
2. **Google Calendar / Meet integration** — used by the `Connect Google` button on the admin dashboard (scheduler → real Calendar events + Meet links)

Each flow has its own callback URL; **both must be registered** in the GCP OAuth client.

## Redirect URIs required in GCP Console

Go to: **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → (your web client) → Authorized redirect URIs**

Add these URIs:

```
https://alphaseekers.onrender.com/api/auth/callback/google
https://alphaseekers.onrender.com/api/integrations/google/callback
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/integrations/google/callback
```

After saving, wait ~30 seconds for Google to propagate, then retry the Connect Google button. Error 400 `redirect_uri_mismatch` disappears once the exact URI (including path + trailing-slash match) is in the list.

## Symptoms of a missing redirect URI

- Admin dashboard → `Connect Google` → browser shows **"Access blocked: This app's request is invalid. Error 400: redirect_uri_mismatch"**
- Reported in QA 2026-04-19 (Sahar)

## Required scopes on the OAuth consent screen

For Calendar/Meet integration the consent screen must include:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

If the app is still in Test mode, every admin email that will use the Connect Google button must be added as a **Test user** on the consent screen.

## Environment variables

Render env vars (confirm all four set):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` — must be `https://alphaseekers.onrender.com` exactly (no trailing slash)
- `NEXTAUTH_SECRET`

Mismatched `NEXTAUTH_URL` is another common cause of `redirect_uri_mismatch` — NextAuth builds the callback URL from this env var and if it does not match what is registered in GCP, Google rejects the request.

---

# R2 (Cloudflare) File Storage Setup

The platform uploads class materials, library PDFs, and student-story images to Cloudflare R2 via S3-compatible presigned URLs.

## Required env vars

Set all four on Render (and `.env.local` for dev):

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL  # optional; defaults to the bucket endpoint
```

If any of the first four is missing, `/api/uploads/presign` returns HTTP 503 with `code: "not_configured"` — the client shows a localized "File uploads are not set up yet" message.

## Symptoms of missing R2 config

- Class materials upload shows a red banner: "File uploads are not set up yet. Please contact the administrator."
- QA 2026-04-19 (Sahar): red "not configured" error on class-materials page; library form succeeded because the URL field also accepts manually-typed URLs (the "File attached" hint only means a URL is in the field, not that a file was uploaded).

## Creating the bucket

1. Cloudflare dashboard → **R2** → Create bucket (e.g. `alphaseekers-uploads`)
2. **R2** → Manage R2 API Tokens → create a token with `Object:Read` + `Object:Write` on that bucket
3. Copy Account ID (top right of R2 dashboard), Access Key ID, and Secret Access Key into Render env vars
4. Redeploy Render so the new env is picked up

