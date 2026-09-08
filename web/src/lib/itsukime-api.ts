export const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined)?.replace(/\/$/, "") ?? "";

export type ChatUser = { id: string; username: string; avatar: string };
export type ChatMessage = {
  id: number;
  user_id: string;
  username: string;
  avatar: string;
  content: string;
  created_at: number;
};

export const assetUrl = (p: string) => (p.startsWith("http") ? p : `${API_BASE}${p}`);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong.");
  return data as T;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const api = {
  avatars: () => request<{ avatars: string[] }>("/api/avatars"),
  checkUsername: (username: string) =>
    request<{ available: boolean }>(`/api/username-available?username=${encodeURIComponent(username)}`),
  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.append("avatar", file);
    return request<{ avatar: string }>("/api/upload-avatar", { method: "POST", body });
  },
  register: (username: string, avatar: string) =>
    request<{ token: string; user: ChatUser }>("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, avatar }),
    }),
  me: (token: string) => request<{ user: ChatUser }>("/api/me", { headers: auth(token) }),
  users: () => request<{ users: ChatUser[] }>("/api/users"),
  messages: (after = 0) => request<{ messages: ChatMessage[] }>(`/api/messages?after=${after}`),
  send: (token: string, content: string) =>
    request<{ message: ChatMessage }>("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify({ content }),
    }),
};

export const STORAGE_KEY = "itsukime.token";
