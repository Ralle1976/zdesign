'use client';

import { memo } from 'react';
import type { CollabUser } from '@/hooks/useCollaboration';

// ─── Types ───────────────────────────────────────────────────────────

export interface PresenceBarProps {
  /** All collaborators currently in the room, including the current user. */
  users: CollabUser[];
  /** The userId of the locally signed-in user (highlighted in the stack). */
  currentUserId: string;
  /** Live connection state from useCollaboration().isConnected. */
  isConnected: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────

/** Maximum avatars rendered before collapsing into a "+N" badge. */
const MAX_VISIBLE_AVATARS = 5;

// ─── Helpers ─────────────────────────────────────────────────────────

/** Returns the uppercase first letter of a name, falling back to "?". */
function getInitial(userName: string): string {
  const trimmed = userName?.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Orders users so the current user is first, all others follow in stable
 * (insertion) order. This keeps the user's own avatar anchored on the left.
 */
function orderUsers(users: CollabUser[], currentUserId: string): CollabUser[] {
  const current = users.filter((u) => u.userId === currentUserId);
  const others = users.filter((u) => u.userId !== currentUserId);
  return [...current, ...others];
}

// ─── Sub-components ──────────────────────────────────────────────────

interface AvatarProps {
  user: CollabUser;
  isCurrentUser: boolean;
}

const Avatar = memo(function Avatar({ user, isCurrentUser }: AvatarProps) {
  return (
    <div
      role="img"
      aria-label={user.userName}
      title={user.userName}
      style={{ backgroundColor: user.color }}
      className={[
        'relative flex size-7 shrink-0 items-center justify-center',
        'rounded-full text-[11px] font-semibold text-white',
        'ring-1 ring-inset ring-white/40 dark:ring-black/30',
        'select-none',
        isCurrentUser
          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
          : '',
      ].join(' ')}
    >
      <span className="drop-shadow-sm">{getInitial(user.userName)}</span>
    </div>
  );
});

interface OverflowBadgeProps {
  count: number;
}

const OverflowBadge = memo(function OverflowBadge({ count }: OverflowBadgeProps) {
  return (
    <div
      title={`+${count} weitere`}
      aria-label={`+${count} weitere Nutzer`}
      className={[
        'flex size-7 shrink-0 items-center justify-center',
        'rounded-full bg-muted text-[11px] font-semibold text-muted-foreground',
        'ring-1 ring-inset ring-white/40 dark:ring-black/30',
        'border border-border select-none',
      ].join(' ')}
    >
      +{count}
    </div>
  );
});

interface ConnectionDotProps {
  isConnected: boolean;
}

const ConnectionDot = memo(function ConnectionDot({ isConnected }: ConnectionDotProps) {
  return (
    <div className="flex items-center gap-1.5 pl-2">
      <span
        aria-label={isConnected ? 'Live' : 'Offline'}
        className={[
          'size-2 shrink-0 rounded-full',
          isConnected
            ? 'bg-emerald-500'
            : 'bg-muted-foreground/50',
        ].join(' ')}
      />
      <span className="text-[11px] font-medium text-muted-foreground">
        {isConnected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
});

// ─── Main component ──────────────────────────────────────────────────

function PresenceBarImpl({
  users,
  currentUserId,
  isConnected,
}: PresenceBarProps): React.JSX.Element | null {
  // Empty room → render nothing.
  if (users.length === 0) return null;

  const ordered = orderUsers(users, currentUserId);
  const visible = ordered.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = ordered.length - visible.length;

  return (
    <div
      role="group"
      aria-label="Aktive Mitarbeitende"
      className={[
        'flex items-center gap-2 rounded-full',
        'border bg-background/80 px-2 py-1',
        'text-foreground backdrop-blur',
      ].join(' ')}
    >
      {/* Avatar stack — overlapping style like Figma / Google Docs */}
      <div className="flex items-center -space-x-1.5">
        {visible.map((user) => (
          <Avatar
            key={user.userId}
            user={user}
            isCurrentUser={user.userId === currentUserId}
          />
        ))}
        {overflow > 0 && <OverflowBadge count={overflow} />}
      </div>

      {/* Separator + connection status */}
      <div className="h-4 w-px bg-border" />
      <ConnectionDot isConnected={isConnected} />
    </div>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────

export const PresenceBar = memo(PresenceBarImpl);
export default PresenceBar;
