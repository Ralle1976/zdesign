'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Types ───────────────────────────────────────────────────────────

export interface CollabUser {
  userId: string;
  userName: string;
  cursorX: number;
  cursorY: number;
  selectedElementId?: string;
  color: string;
}

export interface ChatMessage {
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
}

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  color?: string;
}

export interface SelectionInfo {
  userId: string;
  elementId: string;
  color?: string;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useCollaboration(
  projectId: string | null,
  userId: string,
  userName: string
) {
  const socketRef = useRef<Socket | null>(null);
  // Track whether we've already warned about the collab service being down, so
  // we don't spam the console on every reconnect attempt (reconnectionAttempts: 10).
  const connectErrorLoggedRef = useRef(false);
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [cursorsRaw, setCursorsRaw] = useState<Map<string, CursorPosition>>(
    new Map()
  );
  const [selectionsRaw, setSelectionsRaw] = useState<Map<string, SelectionInfo>>(
    new Map()
  );
  const [isConnected, setIsConnected] = useState(false);
  const currentProjectRef = useRef<string | null>(null);

  // Derive cursors/selections filtered to only current room's users
  const userIdsSet = useMemo(() => new Set(users.map((u) => u.userId)), [users]);
  const cursors = useMemo(() => {
    const filtered = new Map<string, CursorPosition>();
    cursorsRaw.forEach((v, k) => {
      if (userIdsSet.has(k)) filtered.set(k, v);
    });
    return filtered;
  }, [cursorsRaw, userIdsSet]);
  const selections = useMemo(() => {
    const filtered = new Map<string, SelectionInfo>();
    selectionsRaw.forEach((v, k) => {
      if (userIdsSet.has(k)) filtered.set(k, v);
    });
    return filtered;
  }, [selectionsRaw, userIdsSet]);

  // ── Connect / Disconnect ───────────────────────────────────────

  useEffect(() => {
    // Connect via the Caddy gateway — NEVER use localhost or port in URL
    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('[collab] Connected to collaboration service');
      setIsConnected(true);

      // Auto-join room if projectId is already set
      const pid = currentProjectRef.current;
      if (pid) {
        socketInstance.emit('join-project', {
          projectId: pid,
          userId,
          userName,
        });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[collab] Disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      // The collab service (port 3003) is optional for local single-user use.
      // Log a single, non-scary warning instead of error-spamming every retry.
      if (!connectErrorLoggedRef.current) {
        connectErrorLoggedRef.current = true;
        console.warn(
          '[collab] Real-time service unavailable — collaboration disabled, core features still work.',
          error.message,
        );
      }
    });

    // ── Room events ──────────────────────────────────────────────

    socketInstance.on(
      'project-state',
      (data: { users: CollabUser[]; designTree: unknown }) => {
        // Server sends the full user list for the room, replaces our local list
        setUsers(data.users);
      }
    );

    socketInstance.on(
      'user-joined',
      (data: { userId: string; userName: string; color: string }) => {
        setUsers((prev) => {
          // Avoid duplicates
          if (prev.find((u) => u.userId === data.userId)) return prev;
          return [
            ...prev,
            {
              userId: data.userId,
              userName: data.userName,
              cursorX: 0,
              cursorY: 0,
              color: data.color,
            },
          ];
        });
      }
    );

    socketInstance.on(
      'user-left',
      (data: { userId: string; socketId: string }) => {
        setUsers((prev) => prev.filter((u) => u.userId !== data.userId));
        // Remove cursor and selection for this user
        setCursorsRaw((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
        setSelectionsRaw((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      }
    );

    // ── Cursor updates ───────────────────────────────────────────

    socketInstance.on(
      'cursor-update',
      (data: { userId: string; x: number; y: number; color?: string }) => {
        setCursorsRaw((prev) => {
          const next = new Map(prev);
          next.set(data.userId, {
            userId: data.userId,
            x: data.x,
            y: data.y,
            color: data.color,
          });
          return next;
        });
      }
    );

    // ── Selection updates ────────────────────────────────────────

    socketInstance.on(
      'selection-update',
      (data: { userId: string; elementId: string; color?: string }) => {
        setSelectionsRaw((prev) => {
          const next = new Map(prev);
          next.set(data.userId, {
            userId: data.userId,
            elementId: data.elementId,
            color: data.color,
          });
          return next;
        });
      }
    );

    return () => {
      const pid = currentProjectRef.current;
      if (pid) {
        socketInstance.emit('leave-project', { projectId: pid });
      }
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [userId, userName]);

  // ── Join / Leave project room when projectId changes ───────────

  useEffect(() => {
    const socket = socketRef.current;
    const prevProjectId = currentProjectRef.current;

    // Leave previous room
    if (prevProjectId && prevProjectId !== projectId && socket?.connected) {
      socket.emit('leave-project', { projectId: prevProjectId });
    }

    // Join new room (server will send project-state which resets users)
    if (projectId && socket?.connected) {
      socket.emit('join-project', {
        projectId,
        userId,
        userName,
      });
    }

    currentProjectRef.current = projectId;
  }, [projectId, userId, userName]);

  // ── Emit helpers ───────────────────────────────────────────────

  const emitCursorMove = useCallback(
    (x: number, y: number) => {
      if (!socketRef.current?.connected || !projectId) return;
      socketRef.current.emit('cursor-move', {
        projectId,
        userId,
        x,
        y,
      });
    },
    [projectId, userId]
  );

  const emitElementSelected = useCallback(
    (elementId: string) => {
      if (!socketRef.current?.connected || !projectId) return;
      socketRef.current.emit('element-selected', {
        projectId,
        userId,
        elementId,
      });
    },
    [projectId, userId]
  );

  const emitDesignUpdate = useCallback(
    (designTree: unknown) => {
      if (!socketRef.current?.connected || !projectId) return;
      socketRef.current.emit('design-update', {
        projectId,
        userId,
        designTree,
      });
    },
    [projectId, userId]
  );

  const emitCommentAdded = useCallback(
    (annotation: unknown) => {
      if (!socketRef.current?.connected || !projectId) return;
      socketRef.current.emit('comment-added', {
        projectId,
        userId,
        annotation,
      });
    },
    [projectId, userId]
  );

  const emitCommentResolved = useCallback(
    (commentId: string) => {
      if (!socketRef.current?.connected || !projectId) return;
      socketRef.current.emit('comment-resolved', {
        projectId,
        userId,
        commentId,
      });
    },
    [projectId, userId]
  );

  const emitChatMessage = useCallback(
    (content: string) => {
      if (!socketRef.current?.connected || !projectId) return;
      socketRef.current.emit('chat-message', {
        projectId,
        userId,
        userName,
        content,
      });
    },
    [projectId, userId, userName]
  );

  // ── Listen for design changes and chat messages ────────────────
  // These are returned as event handlers the consumer can attach

  const onDesignChanged = useCallback(
    (callback: (data: { userId: string; designTree: unknown }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on('design-changed', callback);
      return () => {
        socket.off('design-changed', callback);
      };
    },
    []
  );

  const onNewComment = useCallback(
    (callback: (data: { userId: string; annotation: unknown; timestamp: number }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on('new-comment', callback);
      return () => {
        socket.off('new-comment', callback);
      };
    },
    []
  );

  const onCommentUpdate = useCallback(
    (callback: (data: { userId: string; commentId: string; resolved: boolean; timestamp: number }) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on('comment-update', callback);
      return () => {
        socket.off('comment-update', callback);
      };
    },
    []
  );

  const onNewChatMessage = useCallback(
    (callback: (data: ChatMessage) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on('new-chat-message', callback);
      return () => {
        socket.off('new-chat-message', callback);
      };
    },
    []
  );

  return {
    isConnected,
    users,
    cursors,
    selections,
    emitCursorMove,
    emitElementSelected,
    emitDesignUpdate,
    emitCommentAdded,
    emitCommentResolved,
    emitChatMessage,
    onDesignChanged,
    onNewComment,
    onCommentUpdate,
    onNewChatMessage,
  };
}
