import { assetUrl } from './api';

const DEFAULT_FAVICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="16" fill="%232563eb"/%3E%3Cpath d="M20 18h24v28H20z" fill="none" stroke="white" stroke-width="4" rx="4"/%3E%3Cpath d="M28 10v10M36 10v10M28 44v10M36 44v10M10 28h10M10 36h10M44 28h10M44 36h10" stroke="white" stroke-width="4" stroke-linecap="round"/%3E%3C/svg%3E';

const ICON_PATHS: Record<string, string> = {
  Zap: '<path d="M36 6 14 36h17l-3 22 22-32H33l3-20Z" fill="white"/>',
  Activity: '<path d="M8 34h10l6-18 12 32 8-14h12" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  Box: '<path d="m32 7 22 12v26L32 57 10 45V19L32 7Z" fill="none" stroke="white" stroke-width="5"/><path d="M10 19 32 31l22-12M32 31v26" fill="none" stroke="white" stroke-width="5"/>',
  Layers: '<path d="m32 8 24 13-24 13L8 21 32 8Z" fill="none" stroke="white" stroke-width="5"/><path d="m56 32-24 13L8 32M56 43 32 56 8 43" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>',
  Cpu: '<rect x="18" y="18" width="28" height="28" rx="5" fill="none" stroke="white" stroke-width="5"/><path d="M26 6v10M38 6v10M26 48v10M38 48v10M6 26h10M6 38h10M48 26h10M48 38h10" stroke="white" stroke-width="5" stroke-linecap="round"/>',
  Globe: '<circle cx="32" cy="32" r="23" fill="none" stroke="white" stroke-width="5"/><path d="M9 32h46M32 9c8 8 8 38 0 46M32 9c-8 8-8 38 0 46" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>',
};

function getOrCreateFavicon() {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

export function applyBrowserBranding(systemName?: string, logoUrl?: string | null) {
  document.title = systemName?.trim() || 'AstroCore';
  getOrCreateFavicon().href = assetUrl(logoUrl) || DEFAULT_FAVICON;
}

export function applyBrowserBrandingWithIcon(systemName?: string, logoUrl?: string | null, iconName?: string) {
  document.title = systemName?.trim() || 'AstroCore';
  getOrCreateFavicon().href = assetUrl(logoUrl) || faviconForIcon(iconName);
}

function faviconForIcon(iconName?: string) {
  const path = ICON_PATHS[iconName || ''] || ICON_PATHS.Zap;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2563eb"/>${path}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
