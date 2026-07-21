import type { PlayerInfo } from '../../api/players';
import { usePlayerConfig } from './usePlayerConfig';
import { usePlayerSync } from './usePlayerSync';

export function usePlayerDetails(player: PlayerInfo) {
    const config = usePlayerConfig(player.uuid);
    const syncState = usePlayerSync(player.name, config);

    return syncState;
}
