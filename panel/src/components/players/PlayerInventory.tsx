import React, { useState, useMemo } from 'react';

const ItemIcon = ({ id }: { id: string }) => {
    const cleanId = id.replace('minecraft:', '');
    const titleCaseId = cleanId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
    const [step, setStep] = useState(0);

    if (step >= 4) {
        return (
            <span className="text-[10px] text-zinc-300 font-mono overflow-hidden text-center leading-tight line-clamp-2 break-all" title={id}>
                {cleanId}
            </span>
        );
    }

    let src = '';
    if (step === 0) src = `https://minecraft.wiki/w/Special:FilePath/Invicon_${titleCaseId}.png`;
    else if (step === 1) src = `https://minecraft.wiki/w/Special:FilePath/${titleCaseId}.png`;
    else if (step === 2) src = `https://assets.mcasset.cloud/26.2/assets/minecraft/textures/item/${cleanId}.png`;
    else if (step === 3) src = `https://assets.mcasset.cloud/26.2/assets/minecraft/textures/block/${cleanId}.png`;

    return (
        <img 
            src={src}
            alt={cleanId}
            className="w-full h-full p-1.5 object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
            style={{ imageRendering: 'pixelated' }}
            onError={() => setStep(s => s + 1)}
        />
    );
};

import { PlayerInventoryItem } from '../../types';

export const InventoryGrid = ({ items, cols, totalSlots, slotMap }: { items: PlayerInventoryItem[], cols: number, totalSlots: number, slotMap?: (i: number) => number }) => {
    const getSlot = (item: PlayerInventoryItem): number => {
        const val = item.Slot ?? item.slot;
        if (val === undefined || val === null) return -1;
        return Number(typeof val === 'object' && 'value' in val ? (val as any).value : val.valueOf());
    };

    const getCount = (item: PlayerInventoryItem): number => {
        const val = item.Count ?? item.count;
        if (val === undefined || val === null) return 1;
        const num = Number(typeof val === 'object' && 'value' in val ? (val as any).value : val.valueOf());
        return isNaN(num) ? 1 : num;
    };

    const getId = (item: PlayerInventoryItem): string => {
        const val = item.id;
        if (!val) return '';
        return String(typeof val === 'object' && 'value' in val ? (val as any).value : val.valueOf());
    };
    
    // Memoize the item lookup map to avoid O(N*M) lookups during render
    const itemBySlot = useMemo(() => {
        const map = new Map<number, PlayerInventoryItem>();
        for (const item of items) {
            map.set(getSlot(item), item);
        }
        return map;
    }, [items]);

    return (
        <div 
            className="grid gap-1 bg-zinc-950 p-2 rounded-lg border border-zinc-800"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: totalSlots }).map((_, i) => {
                const actualSlot = slotMap ? slotMap(i) : i;
                const item = itemBySlot.get(actualSlot);
                
                return (
                    <div 
                        key={i} 
                        className="aspect-square bg-zinc-800/50 rounded border border-zinc-700/50 relative group flex items-center justify-center hover:bg-zinc-700 transition-colors"
                    >
                        {item && (
                            <>
                                <ItemIcon id={getId(item)} />
                                
                                {getCount(item) > 1 && (
                                    <span className="absolute bottom-0 right-1 text-[18px] font-minecraft text-white drop-shadow-[1px_1px_0_rgba(0,0,0,1)]">
                                        {getCount(item)}
                                    </span>
                                )}

                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                                    <div className="font-semibold text-indigo-300">{getId(item)}</div>
                                    <div>Quantité: {getCount(item)}</div>
                                    {item.tag && <div className="text-zinc-500 mt-1 italic text-[10px]">Possède des tags (NBT)</div>}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

interface PlayerInventoryProps {
    inventory: PlayerInventoryItem[];
    enderItems: PlayerInventoryItem[];
}

export const PlayerInventory: React.FC<PlayerInventoryProps> = ({ inventory, enderItems }) => {
    return (
        <>
            <div>
                <div className="flex items-center gap-2 text-zinc-300 mb-3">
                    <h3 className="font-semibold text-sm">Inventaire & Armure</h3>
                </div>
                
                <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                        <InventoryGrid 
                            items={inventory} 
                            cols={9} 
                            totalSlots={27} 
                            slotMap={(i) => i + 9} 
                        />
                        <div className="pt-2">
                            <InventoryGrid 
                                items={inventory} 
                                cols={9} 
                                totalSlots={9} 
                                slotMap={(i) => i} 
                            />
                        </div>
                    </div>

                    <div className="w-16 space-y-2 flex flex-col justify-between">
                        <InventoryGrid 
                            items={inventory} 
                            cols={1} 
                            totalSlots={4} 
                            slotMap={(i) => 103 - i} 
                        />
                        <div className="pt-2">
                            <InventoryGrid 
                                items={inventory} 
                                cols={1} 
                                totalSlots={1} 
                                slotMap={() => -106} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 text-zinc-300 mb-3">
                    <h3 className="font-semibold text-sm">Ender Chest</h3>
                </div>
                <div className="w-full max-w-[calc(100%-5rem)]">
                    <InventoryGrid 
                        items={enderItems} 
                        cols={9} 
                        totalSlots={27} 
                        slotMap={(i) => i} 
                    />
                </div>
            </div>
        </>
    );
};
