'use strict';

const express = require('express');
const webpush = require('web-push');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'subscriptions.json');
const VAPID_FILE = path.join(__dirname, 'vapid.json');

function loadOrGenerateVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  try {
    const stored = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
    if (stored.publicKey && stored.privateKey) {
      return stored;
    }
  } catch {

  }

  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf8');
  console.log('Generated new VAPID keys and saved to vapid.json');
  return keys;
}

const { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } =
  loadOrGenerateVapidKeys();

webpush.setVapidDetails(
  'mailto:admin@domain.com', //This may be really strict on iOS, I just recommed using your real email if you run into issues.
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function loadSubscriptions() {
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveSubscriptions(data) {
  await fsp.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// Serve VAPID public key to the frontend
app.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Register a new push subscription and return a unique webhook URL
app.post('/subscribe', async (req, res) => {
  const { subscription, label } = req.body;

  if (
    !subscription ||
    !subscription.endpoint ||
    !subscription.keys ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    return res.status(400).json({ error: 'Invalid subscription object.' });
  }

  const id = uuidv4();
  const subs = await loadSubscriptions();

  subs[id] = {
    id,
    label: label || 'My HomeKit Automation',
    subscription,
    createdAt: new Date().toISOString(),
  };

  await saveSubscriptions(subs);

  const webhookUrl = `${req.protocol}://${req.get('host')}/notify/${id}`;
  res.status(201).json({ id, webhookUrl });
});

// Webhook endpoint called by HomeKit
app.get('/notify/:id', async (req, res) => {
  const { id } = req.params;
  const title = req.query.title || 'HomeKit Alert';
  const body = req.query.body || 'A HomeKit automation was triggered.';

  const subs = await loadSubscriptions();
  const entry = subs[id];

  if (!entry) {
    return res.status(404).send('Subscription not found.');
  }

  const payload = JSON.stringify({ title, body });

  try {
    await webpush.sendNotification(entry.subscription, payload);
    res.send('Notification sent.');
  } catch (err) {
    // If the subscription is invalid, remove it
    if (err.statusCode === 410) {
      delete subs[id];
      await saveSubscriptions(subs);
      return res.status(410).send('Subscription has been removed.');
    }
    console.error('Failed to send notification:', err.statusCode, err.body, err.message);
    res.status(500).send('Failed to send notification.');
  }
});
app.listen(PORT, () => {
  console.log(`homekit-notify running on http://localhost:${PORT}`);
});
