import { io, type Socket } from "socket.io-client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMyGroups } from "./api";
import { isMockApiActive } from "./mockApi";

const URL =
  import.meta.env.VITE_WS_URL ??
  (import.meta.env.DEV ? "http://localhost:4000" : window.location.origin);
const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

let socket: Socket | null = null;
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setSocketTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

export async function getSocket(): Promise<Socket> {
  if (isMockApiActive()) {
    throw new Error("mock_api_active");
  }
  if (socket?.connected) return socket;
  const token = hasClerk && tokenGetter ? await tokenGetter() : "dev";
  socket = io(URL, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Subscribes to Socket.IO presence rooms for all user groups and live-invalidates
 * TanStack Query caches when presence events fire. Mount once in Layout.
 */
export function usePresenceSocket() {
  const groups = useMyGroups();
  const qc = useQueryClient();

  // Stable string to avoid re-registering on every render
  const groupIdKey = groups.data?.map((g) => g.id).join(",") ?? "";

  useEffect(() => {
    if (!groupIdKey || isMockApiActive()) return;
    const groupIds = groupIdKey.split(",");

    let mounted = true;
    let sock: Socket;

    getSocket().then((s) => {
      if (!mounted) return;
      sock = s;

      // Subscribe to each group's presence room
      for (const gid of groupIds) {
        s.emit("subscribe:group", gid);
      }

      s.on("presence", () => {
        // Invalidate both presence and active session so UI updates instantly
        qc.invalidateQueries({ queryKey: ["presence"] });
        qc.invalidateQueries({ queryKey: ["session", "active"] });
      });
    }).catch(() => {
      // Preview mode and offline local dev deliberately skip realtime.
    });

    return () => {
      mounted = false;
      if (sock) {
        for (const gid of groupIds) {
          sock.emit("unsubscribe:group", gid);
        }
        sock.off("presence");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdKey]);
}
