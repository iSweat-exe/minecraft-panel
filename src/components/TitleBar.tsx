import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="h-8 shrink-0 select-none flex justify-between items-center bg-surface border-b border-border text-muted-foreground"
    >
      <div 
        data-tauri-drag-region 
        className="flex items-center pl-3 text-[13px] font-medium pointer-events-none text-zinc-300 w-full h-full"
      >
        Minecraft Panel
      </div>
      <div 
        className="flex h-full shrink-0"
      >
        <button
          className="inline-flex justify-center items-center w-11 h-full hover:bg-surface-hover transition-colors"
          onClick={() => appWindow.minimize()}
        >
          <Minus size={16} />
        </button>
        <button
          className="inline-flex justify-center items-center w-11 h-full hover:bg-surface-hover transition-colors"
          onClick={() => appWindow.toggleMaximize()}
        >
          <Square size={13} />
        </button>
        <button
          className="inline-flex justify-center items-center w-11 h-full hover:bg-danger hover:text-danger-foreground transition-colors group"
          onClick={() => appWindow.close()}
          title="Fermer"
        >
          <X size={16} className="transition-transform duration-300 group-hover:rotate-180" />
        </button>
      </div>
    </div>
  );
}
