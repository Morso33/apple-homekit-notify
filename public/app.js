'use strict';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard API not available'));
}


function setWebhookCookie(url) {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `webhookUrl=${encodeURIComponent(url)}; max-age=${maxAge}; path=/; SameSite=Strict`;
}

function getWebhookCookie() {
  const match = document.cookie.match(/(?:^|;\s*)webhookUrl=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteWebhookCookie() {
  document.cookie = 'webhookUrl=; max-age=0; path=/; SameSite=Strict';
}


let subscribeBtn, statusMsg, resultSection, webhookUrlEl, copyBtn, labelInput, forgetBtn;

async function subscribe() {
  setStatus('Requesting permission…', 'text-yellow-400');
  subscribeBtn.disabled = true;

  // 1. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    setStatus('Permission denied. Please allow notifications and try again.', 'text-red-400');
    subscribeBtn.disabled = false;
    return;
  }

  // 2. Register (or get existing) service worker
  let registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  } catch (err) {
    setStatus('Service Worker registration failed: ' + err.message, 'text-red-400');
    subscribeBtn.disabled = false;
    return;
  }

  // 3. Fetch VAPID public key
  let vapidPublicKey;
  try {
    const keyRes = await fetch('/vapid-public-key');
    const keyData = await keyRes.json();
    vapidPublicKey = keyData.publicKey;
  } catch (err) {
    setStatus('Could not fetch VAPID key: ' + err.message, 'text-red-400');
    subscribeBtn.disabled = false;
    return;
  }

  // 4. Subscribe to push
  let pushSubscription;
  try {
    pushSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  } catch (err) {
    setStatus('Push subscription failed: ' + err.message, 'text-red-400');
    subscribeBtn.disabled = false;
    return;
  }

  // 5. Send subscription + label to server
  const label = labelInput.value.trim() || 'My HomeKit Automation';
  try {
    const res = await fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: pushSubscription.toJSON(), label }),
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const data = await res.json();
    setWebhookCookie(data.webhookUrl);
    showResult(data.webhookUrl);
  } catch (err) {
    setStatus('Failed to register with server: ' + err.message, 'text-red-400');
    subscribeBtn.disabled = false;
  }
}

function setStatus(msg, colorClass) {
  statusMsg.textContent = msg;
  statusMsg.className = `mt-4 text-sm font-medium text-center ${colorClass}`;
}

function showResult(url) {
  setStatus('✅ Subscribed successfully!', 'text-green-400');
  webhookUrlEl.value = url;
  resultSection.classList.remove('hidden');
  subscribeBtn.disabled = false;
}

function forgetWebhook() {
  deleteWebhookCookie();
  resultSection.classList.add('hidden');
  setStatus('', '');
  webhookUrlEl.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  subscribeBtn = document.getElementById('subscribeBtn');
  statusMsg = document.getElementById('statusMsg');
  resultSection = document.getElementById('resultSection');
  webhookUrlEl = document.getElementById('webhookUrl');
  copyBtn = document.getElementById('copyBtn');
  labelInput = document.getElementById('label');
  forgetBtn = document.getElementById('forgetBtn');

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    setStatus(
      '⚠️ Push notifications are not supported in this browser. Make sure you are not running the website in the browser on iOS, as it does not support push notifications. You must create a shortcut to the website on your home screen and open it from there.',
      'text-yellow-400'
    );
    subscribeBtn.disabled = true;
    return;
  }

  // Restore saved webhook URL from cookie on page load
  const savedUrl = getWebhookCookie();
  if (savedUrl) {
    showResult(savedUrl);
    subscribeBtn.disabled = true;
    subscribeBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
  }

  subscribeBtn.addEventListener('click', subscribe);

  copyBtn.addEventListener('click', async () => {
    try {
      await copyToClipboard(webhookUrlEl.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
    } catch {
      copyBtn.textContent = 'Failed';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
    }
  });

  forgetBtn.addEventListener('click', forgetWebhook);
});