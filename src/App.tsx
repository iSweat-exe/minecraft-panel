import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useAutoUpdater } from "./hooks/useAutoUpdater";
import { ConnectionGate } from "./components/ConnectionGate";
import { AppLayout } from "./components/AppLayout";
import { ConfirmDialog } from "./components/dialogs/ConfirmDialog";
import { PromptDialog } from "./components/dialogs/PromptDialog";
import { ToastContainer } from "./components/ui/ToastContainer";
import { TitleBar } from "./components/TitleBar";

import { OverviewPanel } from './components/OverviewPanel';
import { OptionsPanel } from './components/OptionsPanel';
import { PlayersPanel } from './components/PlayersPanel';
import { ConsolePanel } from './components/ConsolePanel';
import { SftpPanel } from './components/SftpPanel';
import { WorldsPanel } from './components/WorldsPanel';
import { BackupsPanel } from './components/BackupsPanel';
import { ModsPanel } from './components/ModsPanel';
import { AccessPanel } from './components/AccessPanel';
import { AutomationsPanel } from './components/AutomationsPanel';

function App() {
  useAutoUpdater();

  useEffect(() => {
    // Prevent browser from opening dropped files and reloading the app
    const preventDefault = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <TitleBar />
      <div className="flex-1 overflow-hidden relative">
        <HashRouter>
          <ConnectionGate>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={
                  <div className="flex flex-col gap-4 h-full">
                    {/* Assuming we just use local navigation for files from overview, but since we have routes now, it would be better to use navigate('/files') inside OverviewPanel */}
                    <OverviewPanel />
                  </div>
                } />
                <Route path="options" element={<OptionsPanel />} />
                <Route path="console" element={<div className="h-full"><ConsolePanel /></div>} />
                <Route path="players" element={<PlayersPanel />} />
                <Route path="files" element={<SftpPanel />} />
                <Route path="mods" element={<ModsPanel />} />
                <Route path="worlds" element={<WorldsPanel />} />
                <Route path="backups" element={<BackupsPanel />} />
                <Route path="access" element={<AccessPanel />} />
                <Route path="automations" element={<AutomationsPanel />} />
                <Route path="*" element={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Section en cours de développement</div>} />
              </Route>
            </Routes>
          </ConnectionGate>
        </HashRouter>
      </div>
      <ConfirmDialog />
      <PromptDialog />
      <ToastContainer />
    </div>
  );
}

export default App;
