/**
 * Wrapper for Minecraft commands
 * Helps maintain a clean syntax without hardcoding strings in UI components.
 */

// Target can be a player name (e.g., "Notch") or a selector (e.g., "@a", "@p[distance=..10]").
export type Target = string;

/**
 * Sanitize inputs to prevent command injection via newlines.
 * 
 * WARNING: This is sufficient for RCON / server stdin (where 1 packet/line = 1 command),
 * but it does NOT protect against shell injections (e.g. `;`, `|`, `&`) if these 
 * commands are ever passed to `child_process.exec(..., { shell: true })`.
 */
const sanitize = (s: string) => s.replace(/[\r\n]/g, '').trim();

export const mc = {
    player: {
        kick: (name: Target, reason?: string) => {
            const r = reason ? sanitize(reason) : '';
            return `kick ${sanitize(name)}${r ? ` ${r}` : ''}`;
        },
        ban: (name: Target, reason?: string) => {
            const r = reason ? sanitize(reason) : '';
            return `ban ${sanitize(name)}${r ? ` ${r}` : ''}`;
        },
        pardon: (name: Target) => `pardon ${sanitize(name)}`,
        op: (name: Target) => `op ${sanitize(name)}`,
        deop: (name: Target) => `deop ${sanitize(name)}`,
        
        /** 
         * Apply any status effect
         * @param effect Internal effect name (e.g., 'minecraft:speed')
         * @param seconds Duration in seconds
         * @param amplifier Level of the effect (0 = level I)
         * @param hideParticles True to hide particles
         */
        effect: (name: Target, effect: string, seconds: number = 30, amplifier: number = 0, hideParticles: boolean = false) => 
            `effect give ${sanitize(name)} ${sanitize(effect)} ${Math.max(1, Math.trunc(seconds))} ${Math.max(0, Math.trunc(amplifier))}${hideParticles ? ' true' : ''}`,

        /** Clear one or all effects */
        clearEffects: (name: Target, effect?: string) => 
            `effect clear ${sanitize(name)}${effect ? ` ${sanitize(effect)}` : ''}`,

        /** 
         * Full heal using instant_health
         * @param amplifier Level of the effect (default 10 avoids overflow bugs)
         */
        heal: (name: Target, amplifier: number = 10) => 
            `effect give ${sanitize(name)} instant_health 1 ${Math.max(0, Math.trunc(amplifier))}`,
        
        /** 
         * Refills saturation (note: in vanilla Minecraft, saturation effect 
         * only applies if foodLevel is already > 0. It won't fill an empty bar).
         * @param amplifier Level of the effect (default 10)
         * @param duration Duration in seconds (default 1)
         */
        feed: (name: Target, amplifier: number = 10, duration: number = 1) => 
            `effect give ${sanitize(name)} saturation ${Math.max(1, Math.trunc(duration))} ${Math.max(0, Math.trunc(amplifier))}`,
        
        addXpLevels: (name: Target, levels: number = 1) => `xp add ${sanitize(name)} ${Math.max(0, Math.trunc(levels))} levels`,
    },
    data: {
        getHealth: (name: Target) => `data get entity ${sanitize(name)} Health`,
        getFoodLevel: (name: Target) => `data get entity ${sanitize(name)} foodLevel`,
        getXpLevel: (name: Target) => `data get entity ${sanitize(name)} XpLevel`,
        getInventory: (name: Target) => `data get entity ${sanitize(name)} Inventory`,
        getEnderItems: (name: Target) => `data get entity ${sanitize(name)} EnderItems`,
    },
    whitelist: {
        add: (name: Target) => `whitelist add ${sanitize(name)}`,
        remove: (name: Target) => `whitelist remove ${sanitize(name)}`,
        on: () => 'whitelist on',
        off: () => 'whitelist off',
        reload: () => 'whitelist reload',
    },
    server: {
        stop: () => 'stop',
        saveAll: () => 'save-all',
        say: (message: string) => `say ${sanitize(message)}`,
        timeSet: (time: 'day' | 'night' | 'noon' | 'midnight' | number) => {
            const val = typeof time === 'number' ? Math.max(0, Math.trunc(time)) : time;
            return `time set ${val}`;
        },
        weather: (type: 'clear' | 'rain' | 'thunder', duration?: number) => 
            `weather ${type}${duration !== undefined ? ` ${Math.max(0, Math.trunc(duration))}` : ''}`,
    }
} as const;
