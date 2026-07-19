import { useEffect } from "react";
import { ConnectionGate } from "./components/ConnectionGate";
import { Dashboard } from "./components/Dashboard";
import { ConfirmDialog } from "./components/dialogs/ConfirmDialog";
import { PromptDialog } from "./components/dialogs/PromptDialog";
import { ToastContainer } from "./components/ui/ToastContainer";
import { TitleBar } from "./components/TitleBar";

function App() {
  // TODO: FUTURE UPDATE (Internationalization / i18n)
  // i18n initialization will happen here or in main.tsx.
  // A translation provider (e.g., <I18nextProvider>) will wrap the components below.

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
        <ConnectionGate>
          <Dashboard />
        </ConnectionGate>
      </div>
      <ConfirmDialog />
      <PromptDialog />
      <ToastContainer />
    </div>
  );
}

export default App;
