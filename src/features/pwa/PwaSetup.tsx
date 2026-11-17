'use client';

import { useEffect } from 'react';
import { setupPwa } from './install';

/** Registers the service worker (production only) and listens for install prompts. */
export function PwaSetup() {
  useEffect(() => setupPwa(), []);
  return null;
}
