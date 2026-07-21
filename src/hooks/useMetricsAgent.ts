import { useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { useServerStatsStore } from '../store/serverStatsStore';

const AGENT_SCRIPT = `#!/bin/bash
DIR="$HOME/.minecraft_panel"
CSV="$DIR/metrics.csv"
mkdir -p "$DIR"

# Write header if missing
if [ ! -f "$CSV" ]; then
    echo "timestamp,cpu,ram_used,ram_total" > "$CSV"
fi

while true; do
    TS=$(date +%s)
    
    # Calculate CPU precisely over 1 second
    read cpu_user cpu_nice cpu_sys cpu_idle cpu_rest <<< $(head -1 /proc/stat | awk '{print $2, $3, $4, $5, $6+$7+$8+$9+$10}')
    sleep 1
    read cpu2_user cpu2_nice cpu2_sys cpu2_idle cpu2_rest <<< $(head -1 /proc/stat | awk '{print $2, $3, $4, $5, $6+$7+$8+$9+$10}')
    
    idle1=$((cpu_idle))
    idle2=$((cpu2_idle))
    total1=$((cpu_user + cpu_nice + cpu_sys + cpu_idle + cpu_rest))
    total2=$((cpu2_user + cpu2_nice + cpu2_sys + cpu2_idle + cpu2_rest))
    diff_idle=$((idle2 - idle1))
    diff_total=$((total2 - total1))
    
    if [ $diff_total -gt 0 ]; then
        cpu_pct=$(awk "BEGIN{printf \\"%.1f\\", 100.0 * (1.0 - $diff_idle / $diff_total)}")
    else
        cpu_pct="0.0"
    fi
    
    read mem_total mem_avail <<< $(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} /MemFree/{f=$2} /Buffers/{b=$2} /^Cached/{c=$2} END{if(a!="") print t, a; else print t, f+b+c}' /proc/meminfo)
    mem_total=\${mem_total:-1}
    mem_avail=\${mem_avail:-0}
    ram_used_mb=$(( (mem_total - mem_avail) / 1024 ))
    ram_total_mb=$(( mem_total / 1024 ))
    
    echo "$TS,$cpu_pct,$ram_used_mb,$ram_total_mb" >> "$CSV"
    
    # Keep only last 1440 lines (24 hours at 1 line per minute)
    tail -n 1440 "$CSV" > "$CSV.tmp" && mv "$CSV.tmp" "$CSV"
    
    # Sleep 59 since we already slept 1 for CPU calc
    sleep 59
done
`;

export function useMetricsAgent() {
    const { sshStatus } = useConnectionStore();

    useEffect(() => {
        if (sshStatus !== 'connected') return;

        const deployAgent = async () => {
            try {
                const dirStr = `~/.minecraft_panel`;
                const scriptPath = `${dirStr}/metrics_agent.sh`;
                
                // Create directory
                await tauriBridge.sshExecute(`mkdir -p ${dirStr}`);
                
                // Upload script using bash heredoc (EOF) so we don't rely on SFTP path resolution
                const writeCmd = `cat << 'EOF' > ${scriptPath}\n${AGENT_SCRIPT}\nEOF`;
                await tauriBridge.sshExecute(writeCmd);
                
                // Make executable
                await tauriBridge.sshExecute(`chmod +x ${scriptPath}`);

                // Check if already running
                const isRunning = await tauriBridge.sshExecute(`pgrep -f "metrics_agent.sh" || echo "STOPPED"`);
                
                if (isRunning.includes('STOPPED')) {
                    // Start in background using nohup
                    await tauriBridge.sshExecute(`nohup ${scriptPath} > /dev/null 2>&1 &`);
                    console.log('Metrics agent deployed and started.');
                } else {
                    console.log('Metrics agent is already running.');
                }
                
                // Ensure it's in crontab for @reboot
                const cronList = await tauriBridge.sshExecute(`crontab -l || echo ""`);
                if (!cronList.includes('metrics_agent.sh')) {
                    // We append to existing crontab
                    const escapedCron = cronList.replace(/"/g, '\\\\"') + `\\n@reboot ${scriptPath} > /dev/null 2>&1 &\\n`;
                    await tauriBridge.sshExecute(`echo "${escapedCron}" | crontab -`);
                    console.log('Added metrics agent to crontab @reboot');
                }
                
                // Fetch existing CSV history periodically
                const fetchCsv = async () => {
                    try {
                        const csvContent = await tauriBridge.sshExecute(`cat ${scriptPath.replace('.sh', '.csv')} || echo ""`);
                        const lines = csvContent.split('\n');
                        const history = [];
                        for (let i = 1; i < lines.length; i++) {
                            if (!lines[i].trim()) continue;
                            const [tsStr, cpuStr, ramStr] = lines[i].split(',');
                            const ts = parseInt(tsStr) * 1000;
                            if (isNaN(ts)) continue;
                            const time = new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                            history.push({
                                time,
                                ts,
                                cpu: parseFloat(cpuStr),
                                ram: parseInt(ramStr),
                                rx: 0,
                                tx: 0
                            });
                        }
                        if (history.length > 0) {
                            useServerStatsStore.getState().loadHistory(history);
                        }
                    } catch (e) {
                        console.log('No metrics history found yet', e);
                    }
                };

                // Initial fetch
                await fetchCsv();

                // Periodic fetch every 60s
                const interval = setInterval(fetchCsv, 60000);

                // Need to clean up on unmount or sshStatus change
                return () => clearInterval(interval);
            } catch (err) {
                console.error('Failed to deploy metrics agent:', err);
            }
        };

        const cleanupPromise = deployAgent();

        return () => {
            cleanupPromise.then(cleanup => {
                if (typeof cleanup === 'function') cleanup();
            });
        };
    }, [sshStatus]);
}
