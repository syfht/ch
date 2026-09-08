import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ChatApp } from "@/components/itsukime/ChatApp";
import { Onboarding } from "@/components/itsukime/Onboarding";
import { api, STORAGE_KEY, type ChatUser } from "@/lib/itsukime-api";

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ChatUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return setReady(true);
    api
      .me(saved)
      .then(({ user: u }) => {
        setToken(saved);
        setUser(u);
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="min-h-dvh bg-background" />;
  if (!token || !user)
    return (
      <Onboarding
        onReady={(t, u) => {
          localStorage.setItem(STORAGE_KEY, t);
          setToken(t);
          setUser(u);
        }}
      />
    );
  return (
    <ChatApp
      token={token}
      user={user}
      onLogout={() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
