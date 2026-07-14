'use client';

// Z.Design - Client providers wrapper (O13, 2026-07-04)
// Wraps the app in the next-auth SessionProvider so useSession() works in
// any client component (TopToolbar account menu, etc.).

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
