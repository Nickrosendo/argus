import React, { useState } from 'react';

interface SiteIconProps {
  domain: string;
  favicon?: string; // icon address recorded by the tracker, if any
}

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

const COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
];

/**
 * The browser's own copy of a site's icon. Chrome serves it to extensions that
 * hold the "favicon" permission, from its local cache, so nothing is fetched
 * from the site. Returns null where that is not available (for example Firefox).
 */
function getBrowserIconUrl(domain: string): string | null {
  try {
    const runtime = browserAPI.runtime as any;
    const permissions: string[] = (runtime.getManifest && runtime.getManifest().permissions) || [];
    if (permissions.indexOf('favicon') === -1) return null;

    return `${runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(`https://${domain}`)}&size=32`;
  } catch (error) {
    return null;
  }
}

/**
 * A site's icon. Tries the browser's cached icon, then the address the tracker
 * recorded, and falls back to the site's initial on a coloured tile.
 */
const SiteIcon: React.FC<SiteIconProps> = ({ domain, favicon }) => {
  const sources = [getBrowserIconUrl(domain), favicon].filter(Boolean) as string[];
  const [failed, setFailed] = useState(0);

  if (failed < sources.length) {
    return (
      <img
        src={sources[failed]}
        alt=""
        className="w-8 h-8 rounded site-icon-img"
        onError={() => setFailed(failed + 1)}
      />
    );
  }

  return (
    <div
      className={`w-8 h-8 rounded ${COLORS[domain.length % COLORS.length]} flex items-center justify-center text-white text-sm font-bold`}
      aria-hidden="true"
    >
      {domain.charAt(0).toUpperCase()}
    </div>
  );
};

export default SiteIcon;
