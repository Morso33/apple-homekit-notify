# HomeKit Notify

**HomeKit Notify** is a self-hosted Node.js server that bridges Apple HomeKit automations and Web Push notifications. Open the web app on your iPhone (added to your Home Screen), tap **Enable Notifications**, and you'll receive a unique webhook URL. Paste that URL into any HomeKit automation — or any HTTP-capable tool — and your phone will receive a native push notification every time it's triggered.

---

## Screenshots

<p align="center">
  <img src="docs/images/frontpage.png" width="320" alt="HomeKit Notify web UI" />
  &nbsp;&nbsp;
  <img src="docs/images/ios-notification.png" width="320" alt="iOS push notification example" />
</p>

---

## How It Works

1. The server generates a **VAPID key pair** on first run (or reads them from environment variables).
2. A visitor opens the web app, grants notification permission, and the browser creates a **Web Push subscription**.
3. The server stores the subscription and returns a **unique webhook URL** (e.g. `https://yourserver.com/notify/<uuid>`).
4. The user pastes that URL into a HomeKit automation's **"Get Contents of URL"** / **"Run Script over SSH"** action.
5. When HomeKit hits the URL, the server sends a Web Push notification directly to the subscribed browser/device.

Subscriptions are persisted to `subscriptions.json` on disk. Stale subscriptions (HTTP 410 from the push service) are removed automatically.

---

## Requirements

- **Node.js** v18 or later
- A publicly reachable HTTPS hostname (required by the Web Push API and iOS Safari)
- An **iPhone** with iOS 16.4+ (Web Push on iOS requires the site to be added to the Home Screen as a PWA)

---

## Installation

```bash
git clone https://github.com/Morso33/apple-homekit-notify.git
cd apple-homekit-notify
npm install
```

---

## Running

```bash
npm start
```

The server listens on port **3001** by default. Override with the `PORT` environment variable:

```bash
PORT=8080 npm start
```

---

## VAPID Keys

VAPID keys are required for Web Push. On first start the server auto-generates a key pair and saves it to `vapid.json`. To supply your own keys (recommended for production), set environment variables instead:

```bash
VAPID_PUBLIC_KEY=<your-public-key> VAPID_PRIVATE_KEY=<your-private-key> npm start
```

You can generate a key pair with:

```bash
node -e "const wp = require('web-push'); console.log(wp.generateVAPIDKeys())"
```

> **Note:** The VAPID contact email is hardcoded to `admin@domain.com` in `server.js`. Change it to your own email before deploying — some push services enforce this.

---

## iOS Setup (Important)

iOS Safari does **not** support Web Push in the normal browser. You must:

1. Open the site in Safari on your iPhone.
2. Tap the **Share** button → **Add to Home Screen**.
3. Open the app from your Home Screen.
4. Tap **Enable Notifications** and allow when prompted.

You will then see your unique webhook URL. Tap **Copy**.

---

## HomeKit Automation Setup

1. Open the **Home** app → **Automations** tab.
2. Create a new automation or edit an existing one.
3. Add a **"Get Contents of URL"** action (via Shortcuts).
4. Paste your webhook URL as the request URL.
5. Save — HomeKit will now push a notification to your device whenever the automation fires.

### Customising the notification

Append `title` and `body` query parameters to the webhook URL:

```
https://yourserver.com/notify/<uuid>?title=Motion+Detected&body=Backyard+camera+triggered
```

If omitted, the defaults are:
- **title:** `HomeKit Alert`
- **body:** `A HomeKit automation was triggered.`

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/vapid-public-key` | Returns the server's VAPID public key as JSON. |
| `POST` | `/subscribe` | Registers a push subscription. Body: `{ subscription, label }`. Returns `{ id, webhookUrl }`. |
| `GET` | `/notify/:id` | Triggers a push notification. Query params: `title`, `body`. |

---

## Project Structure

```
.
├── server.js          # Express server — VAPID, subscription management, push delivery
├── package.json
├── public/
│   ├── index.html     # Web UI (Tailwind CSS, dark theme, mobile-first)
│   ├── app.js         # Client-side subscription logic, cookie persistence
│   └── sw.js          # Service Worker — receives push events, shows notifications
├── subscriptions.json # Auto-created; stores active push subscriptions
└── vapid.json         # Auto-created; stores generated VAPID keys
```

---

## License

MIT
