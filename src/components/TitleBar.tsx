import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      onPointerDown={() => appWindow.startDragging()}
      className="h-8 shrink-0 select-none flex justify-between items-center bg-zinc-900 border-b border-zinc-800 text-zinc-400"
    >
      <div 
        data-tauri-drag-region 
        className="flex items-center pl-3 text-[13px] font-medium pointer-events-none text-zinc-300 w-full h-full"
      >
        Minecraft Panel
      </div>
      <div 
        className="flex h-full shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className="inline-flex justify-center items-center w-11 h-full hover:bg-zinc-800 transition-colors"
          onClick={() => appWindow.minimize()}
        >
          <Minus size={16} />
        </button>
        <button
          className="inline-flex justify-center items-center w-11 h-full hover:bg-zinc-800 transition-colors"
          onClick={() => appWindow.toggleMaximize()}
        >
          <Square size={13} />
        </button>
        <button
          className="inline-flex justify-center items-center w-11 h-full hover:bg-red-600 hover:text-white transition-colors"
          onClick={() => appWindow.close()}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
