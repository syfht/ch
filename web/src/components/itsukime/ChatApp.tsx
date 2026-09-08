import { useCallback, useEffect, useRef, useState } from "react";
import { Hash, Menu, SendHorizontal, Users, X } from "lucide-react";
import { api, assetUrl, type ChatMessage, type ChatUser } from "@/lib/itsukime-api";

const timeLabel = (ts: number) =>
  new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function ChatApp({ token, user, onLogout }: { token: string; user: ChatUser; onLogout: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatUser[]>([]);
  const [draft, setDraft] = useState("");
  const [drawer, setDrawer] = useState<null | "channels" | "members">(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  const poll = useCallback(async () => {
    try {
      const { messages: fresh } = await api.messages(lastId.current);
      if (fresh.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const added = fresh.filter((m) => !seen.has(m.id));
          if (!added.length) return prev;
          lastId.current = Math.max(lastId.current, added[added.length - 1]?.id ?? 0);
          return [...prev, ...added];
        });
      }
      setError(null);
    } catch {
      setError("Reconnecting to the chat server…");
    }
  }, []);


  useEffect(() => {
    void poll();
    void api.users().then(({ users }) => setMembers(users)).catch(() => {});
    const id = setInterval(poll, 1500);
    const members = setInterval(
      () => api.users().then(({ users }) => setMembers(users)).catch(() => {}),
      15000,
    );
    return () => {
      clearInterval(id);
      clearInterval(members);
    };
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      await api.send(token, content);
      await poll();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Server rail + channels */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] transition-transform duration-200 md:static md:translate-x-0 ${
          drawer === "channels" ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex w-[72px] flex-col items-center gap-3 bg-rail py-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
            IT
          </div>
          <div className="h-px w-8 bg-border" />
        </div>
        <div className="flex flex-1 flex-col bg-sidebar">
          <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-4 shadow-sm">
            <span className="font-bold">Itsukime</span>
            <button className="md:hidden" onClick={() => setDrawer(null)} aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <p className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Text channels
            </p>
            <button className="flex w-full items-center gap-2 rounded-md bg-sidebar-accent px-2 py-2 text-left text-sm font-semibold text-sidebar-accent-foreground">
              <Hash className="size-4 text-primary" /> general
            </button>
          </div>
          <div className="flex items-center gap-2 border-t border-sidebar-border bg-rail px-3 py-2">
            <img src={assetUrl(user.avatar)} alt="" className="size-8 rounded-full object-cover" />
            <span className="flex-1 truncate text-sm font-semibold">{user.username}</span>
            <button onClick={onLogout} className="text-xs text-muted-foreground hover:text-primary">
              Leave
            </button>
          </div>
        </div>
      </aside>

      {drawer && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setDrawer(null)}
        />
      )}

      {/* Chat column */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
          <button className="md:hidden" onClick={() => setDrawer("channels")} aria-label="Open channels">
            <Menu className="size-5" />
          </button>
          <Hash className="size-5 text-primary" />
          <h1 className="font-bold">general</h1>
          <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">
            The one and only channel.
          </span>
          <button
            className="ml-auto text-muted-foreground hover:text-foreground lg:hidden"
            onClick={() => setDrawer("members")}
            aria-label="Show members"
          >
            <Users className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          {messages.length === 0 && (
            <div className="py-16 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/15">
                <Hash className="size-8 text-primary" />
              </div>
              <h2 className="mt-4 text-2xl font-black">Welcome to #general</h2>
              <p className="mt-1 text-sm text-muted-foreground">This is the start of the channel.</p>
            </div>
          )}
          <ul className="space-y-4">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped = !!prev && prev.user_id === m.user_id && m.created_at - prev.created_at < 300000;
              const highlightsEveryone = /@(everyone|here)\b/i.test(m.content);
              return (
                <li key={m.id} className={grouped ? "-mt-3 pl-12" : "flex gap-3"}>
                  {!grouped && (
                    <img src={assetUrl(m.avatar)} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                  )}
                  <div className="min-w-0">
                    {!grouped && (
                      <p className="flex items-baseline gap-2">
                        <span className="font-semibold text-primary">{m.username}</span>
                        <span className="text-[11px] text-muted-foreground">{timeLabel(m.created_at)}</span>
                      </p>
                    )}
                    <p
                      className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${
                        highlightsEveryone
                          ? "rounded-md bg-yellow-400/20 px-2 py-1 text-yellow-100 ring-1 ring-inset ring-yellow-300/30"
                          : ""
                      }`}
                    >
                      {m.content}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-4 pb-1 text-xs text-destructive">{error}</p>}

        <form onSubmit={send} className="flex shrink-0 items-end gap-2 px-3 pb-4 pt-1 sm:px-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message #general"
            maxLength={2000}
            className="flex-1 rounded-xl bg-input px-4 py-3 text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message"
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
          >
            <SendHorizontal className="size-5" />
          </button>
        </form>
      </section>

      {/* Members */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-60 border-l border-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0 ${
          drawer === "members" ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <p className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Members — {members.length}
        </p>
        <ul className="space-y-1 px-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
              <img src={assetUrl(m.avatar)} alt="" className="size-8 rounded-full object-cover" />
              <span className="truncate text-sm font-medium">{m.username}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
