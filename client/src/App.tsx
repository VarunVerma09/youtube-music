import { useState } from "react";
import { Lobby } from "./pages/Lobby";
import { WatchRoom } from "./pages/WatchRoom";
import type { SessionInfo } from "./types";
import "./App.css";

function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);

  const handleLeave = () => {
    setSession(null);
    window.history.replaceState({}, "", window.location.pathname);
  };

  if (session) {
    return <WatchRoom session={session} onLeave={handleLeave} />;
  }

  return <Lobby onJoined={setSession} />;
}

export default App;
