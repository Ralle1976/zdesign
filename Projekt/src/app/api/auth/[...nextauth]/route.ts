// Z.Design - next-auth route handler (O13, 2026-07-04)
// Mounts the NextAuth.js API at /api/auth/*.

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
