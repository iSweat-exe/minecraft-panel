import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tauriBridge } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';

export interface PlayerInfo {
    uuid: string;
    name: string;
    isOp: boolean;
    isBanned: boolean;
    isWhitelisted: boolean;
}

export const fetchPlayersList = async (): Promise<PlayerInfo[]> => {
    const data = await tauriBridge.getPlayersList();
    return data as PlayerInfo[];
};

export const usePlayersQuery = () => {
    return useQuery({
        queryKey: ['players'],
        queryFn: fetchPlayersList,
        staleTime: 30000, // 30 seconds
    });
};

export const useExecuteCommandMutation = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (command: string) => {
            await tauriBridge.consoleSendCommand(command);
            logAction('Action sur un joueur', { commande: command });
        },
        onSuccess: () => {
            // Invalidate players list after a delay to allow server to process command
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['players'] });
            }, 500);
        }
    });
};
