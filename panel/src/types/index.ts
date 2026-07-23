export interface RawPlayerInfo {
    uuid: string;
    name: string;
}

export interface PlayerInventoryItem {
    Slot?: number;
    slot?: number;
    Count?: number;
    count?: number;
    id: string;
    tag?: any;
    [key: string]: any;
}
