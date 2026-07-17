import { ConnectionGate } from "./components/ConnectionGate";
import { Dashboard } from "./components/Dashboard";

function App() {
  return (
    <ConnectionGate>
      <Dashboard />
    </ConnectionGate>
  );
}

export default App;
