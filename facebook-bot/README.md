# Facebook Daily Post Bot

Automated Node.js scheduler that uses Claude AI to generate and publish daily Facebook Page content about programming, tech, and software development — targeting a bilingual Arabic/English tech audience.

## Features

- Daily posts at **1:00 PM Cairo time** (configurable)
- Claude AI content generation with Arabic/English code-switching
- 10 rotating topic categories (no repeat two days in a row)
- Facebook Graph API v19.0 integration
- Post history (`posts-log.json`, last 30 posts)
- Failed post logging (`failed-posts.json`)
- GitHub Actions workflow for cloud scheduling

## Quick Start

### 1. Install dependencies

```bash
cd facebook-bot
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Claude via agentrouter |
| `ANTHROPIC_ENDPOINT` | Default: `https://agentrouter.org/v1` |
| `FACEBOOK_PAGE_ID` | Your Facebook Page numeric ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Long-lived Page access token |
| `POST_HOUR` | Hour to post (24h), default `13` |
| `POST_MINUTE` | Minute to post, default `0` |
| `TIMEZONE` | IANA timezone, default `Africa/Cairo` |

### 3. Run locally

**Start the scheduler** (waits until 1 PM Cairo daily):

```bash
npm start
```

**Post immediately** (test run):

```bash
npm run post-now
# or
node index.js --now
```

---

## How to Get a Facebook Page Access Token

### Step 1: Create a Meta Developer App

1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** → **Create App**.
3. Choose **Other** → **Business** (or **Consumer** if you prefer).
4. Name your app and link it to your Meta Business account if prompted.

### Step 2: Add the Facebook Login product

1. In your app dashboard, click **Add Product**.
2. Select **Facebook Login** → **Set Up**.
3. Under **Facebook Login** → **Settings**, add `https://developers.facebook.com/tools/explorer/` to **Valid OAuth Redirect URIs** (for token generation via Graph API Explorer).

### Step 3: Generate a User Access Token with Page permissions

1. Open [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Select your app from the dropdown.
3. Click **Generate Access Token**.
4. Grant these permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_manage_metadata` (optional, for some Page settings)
5. Authorize and copy the **User Access Token** shown.

### Step 4: Get your Page ID

**Option A — Graph API Explorer**

1. In Graph API Explorer, with your user token active, call:
   ```
   GET /me/accounts
   ```
2. Find your Page in the response. Note:
   - `id` → this is your **Page ID** (`FACEBOOK_PAGE_ID`)
   - `access_token` → this is a **short-lived Page token**

**Option B — From your Page**

1. Open your Facebook Page.
2. Click **About** → scroll to **Page transparency** or check Page settings.
3. Or visit: `https://facebook.com/your-page-name` and use the Graph API:
   ```
   GET /{page-username}?fields=id
   ```

---

## How to Get a LONG-LIVED Page Token (Never Expires)

> **Critical:** Short-lived tokens expire in ~1–2 hours. User tokens last ~60 days. You need a **long-lived Page access token** for automation.

### Step 1: Exchange user token for a long-lived user token (~60 days)

```bash
curl -G "https://graph.facebook.com/v19.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=YOUR_APP_ID" \
  --data-urlencode "client_secret=YOUR_APP_SECRET" \
  --data-urlencode "fb_exchange_token=YOUR_SHORT_LIVED_USER_TOKEN"
```

Response:

```json
{
  "access_token": "LONG_LIVED_USER_TOKEN",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

Save `access_token` as your long-lived **user** token.

### Step 2: Get the long-lived Page token

```bash
curl -G "https://graph.facebook.com/v19.0/me/accounts" \
  --data-urlencode "access_token=LONG_LIVED_USER_TOKEN"
```

In the response, find your Page:

```json
{
  "data": [
    {
      "access_token": "PAGE_ACCESS_TOKEN_HERE",
      "category": "Software",
      "name": "Your Page Name",
      "id": "123456789012345",
      "tasks": ["ANALYZE", "ADVERTISE", "MODERATE", "CREATE_CONTENT"]
    }
  ]
}
```

- `id` → `FACEBOOK_PAGE_ID`
- `access_token` → `FACEBOOK_PAGE_ACCESS_TOKEN`

### Step 3: Verify the Page token does not expire

```bash
curl -G "https://graph.facebook.com/v19.0/debug_token" \
  --data-urlencode "input_token=PAGE_ACCESS_TOKEN" \
  --data-urlencode "access_token=YOUR_APP_ID|YOUR_APP_SECRET"
```

Look for:

```json
{
  "data": {
    "type": "PAGE",
    "expires_at": 0
  }
}
```

**`expires_at: 0` means the Page token never expires** — this is what you want for GitHub Actions and local scheduling.

---

## Short-Lived vs Long-Lived Tokens

| Token type | Typical lifetime | Use case |
|------------|------------------|----------|
| **Short-lived user token** | ~1–2 hours | Graph API Explorer testing only |
| **Long-lived user token** | ~60 days | Intermediate step to get Page token |
| **Page access token (from long-lived user)** | **Never expires** (`expires_at: 0`) | **Production bots & CI/CD** |

Why it matters:

- A token from Graph API Explorer without exchange **will stop working within hours**.
- Automating daily posts requires a **Page token derived from a long-lived user token**.
- Page tokens tied to a Page admin role remain valid until permissions are revoked or the admin loses Page access.

---

## GitHub Actions Setup

The workflow runs daily at **11:00 AM UTC** (= **1:00 PM Cairo**, UTC+2).

### 1. Add repository secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `ANTHROPIC_ENDPOINT` | `https://agentrouter.org/v1` |
| `FACEBOOK_PAGE_ID` | Page numeric ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Long-lived Page token |

### 2. Enable the workflow

The file `.github/workflows/daily-post.yml` is already configured with:

- **Schedule:** `cron: '0 11 * * *'` (1 PM Cairo)
- **Manual trigger:** Actions tab → **Daily Facebook Post** → **Run workflow**

### 3. Monitor runs

Check the **Actions** tab for logs. On success, a new entry appears in `posts-log.json` (if you commit logs) or check your Facebook Page directly.

> **Tip:** GitHub scheduled workflows can be delayed by a few minutes during high load. For exact timing, run the bot on a VPS with `npm start` instead.

---

## Project Structure

```
facebook-bot/
├── index.js         # Scheduler + main entry point
├── generator.js     # Claude content generation
├── facebook.js      # Facebook Graph API wrapper
├── topics.js        # Rotating topic categories
├── .env.example     # Environment template
├── posts-log.json   # Last 30 successful posts (created at runtime)
├── failed-posts.json# Failed post attempts (created at runtime)
├── package.json
└── README.md
```

## Content Strategy

Topics rotate by day-of-year index across 10 categories:

1. Quick programming tips
2. Tech memes & relatable dev moments
3. "Did you know?" tech facts
4. Tool & resource spotlights
5. Career advice for junior devs
6. AI tools & prompts for developers
7. Open source project highlights
8. Tech news explained simply
9. Motivational dev stories
10. Code challenge of the day

The same category never repeats two days in a row.

## Error Handling

- Claude API: **1 automatic retry** on failure
- Facebook API errors: logged + saved to `failed-posts.json`
- All operations logged with ISO timestamps
- Process exits with code `1` on failure (visible in CI)

## License

MIT
