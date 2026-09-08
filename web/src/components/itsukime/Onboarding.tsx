import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { api, assetUrl, type ChatUser } from "@/lib/itsukime-api";

export function Onboarding({ onReady }: { onReady: (token: string, user: ChatUser) => void }) {
  const [avatars, setAvatars] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string>("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .avatars()
      .then(({ avatars: list }) => {
        setAvatars(list);
        setAvatar((a) => a || list[0] || "");
      })
      .catch(() => setError("Can't reach the chat server. Start it and refresh."));
  }, []);

  async function pickFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { avatar: uploaded } = await api.uploadAvatar(file);
      setAvatars((prev) => (prev.includes(uploaded) ? prev : [uploaded, ...prev]));
      setAvatar(uploaded);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await api.register(username.trim(), avatar);
      onReady(token, user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-rail px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_-20px_oklch(0.58_0.22_27_/_0.45)] sm:p-8">
        <h1 className="text-center text-3xl font-black tracking-tight">
          Itsu<span className="text-primary">kime</span>
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Pick a name and a face to join #general.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <img
              src={avatar ? assetUrl(avatar) : undefined}
              alt="Selected profile picture"
              className="size-24 rounded-full border-2 border-primary bg-secondary object-cover"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <Upload className="size-3.5" /> Upload your own
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Or choose a default
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {avatars.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`size-12 overflow-hidden rounded-full border-2 transition ${
                    avatar === a ? "border-primary scale-105" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={assetUrl(a)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="username" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. akira"
              maxLength={20}
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-base outline-none transition focus:border-primary"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              3-20 characters. Letters, numbers, dots, dashes and underscores.
            </p>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy || !username.trim() || !avatar}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Enter Itsukime
          </button>
        </form>
      </div>
    </main>
  );
}
