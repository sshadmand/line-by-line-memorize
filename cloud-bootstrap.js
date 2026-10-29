import { cloudConfig } from './cloud-config.js?v=cloud-autosave-1';

export function cloudEnabledForLocation(config, location) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname)
    || config.enabledInProduction === true;
}

export async function startCloudScripts({ win = window, doc = win.document, config = cloudConfig, createClient } = {}) {
  if (!win.lineByLineApp || !cloudEnabledForLocation(config, win.location)) return null;
  // Keep the account module, SDK, and all session handling out of disabled hosts.
  // Versioned imports avoid running a pre-gate module from the browser cache.
  const { setupCloudScripts } = await import('./cloud-scripts.js?v=cloud-autosave-1');
  return setupCloudScripts({ app: win.lineByLineApp, doc, win, config, createClient });
}

if (typeof window !== 'undefined') startCloudScripts();
