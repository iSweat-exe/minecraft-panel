import { useEffect } from "react";
import { ConnectionGate } from "./components/ConnectionGate";
import { Dashboard } from "./components/Dashboard";
import { ConfirmDialog } from "./components/dialogs/ConfirmDialog";
import { PromptDialog } from "./components/dialogs/PromptDialog";
import { ToastContainer } from "./components/ui/ToastContainer";

function App() {
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
    <>
      <ConnectionGate>
        <Dashboard />
      </ConnectionGate>
      <ConfirmDialog />
      <PromptDialog />
      <ToastContainer />
    </>
  );
}

export default App;
