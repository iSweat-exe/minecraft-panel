use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct SystemMetrics {
    /// CPU usage percentage (0-100)
    pub cpu_percent: f64,
    /// RAM used in MB
    pub ram_used_mb: u64,
    /// RAM total in MB
    pub ram_total_mb: u64,
    /// Disk used in GB
    pub disk_used_gb: f64,
    /// Disk total in GB
    pub disk_total_gb: f64,
}

#[tauri::command]
pub async fn system_metrics(state: State<'_, SshState>) -> Result<SystemMetrics, AppError> {
    // Single command that outputs CPU%, RAM used/total, Disk used/total
    // Uses /proc/stat for CPU, /proc/meminfo for RAM, df for disk.
    // We do two CPU reads 200ms apart to get a meaningful percentage.
    let script = r#"bash -c '
read cpu1_user cpu1_nice cpu1_sys cpu1_idle cpu1_rest <<< $(head -1 /proc/stat | awk "{print \$2, \$3, \$4, \$5, \$6+\$7+\$8+\$9+\$10}")
sleep 0.2
read cpu2_user cpu2_nice cpu2_sys cpu2_idle cpu2_rest <<< $(head -1 /proc/stat | awk "{print \$2, \$3, \$4, \$5, \$6+\$7+\$8+\$9+\$10}")

idle1=$((cpu1_idle))
idle2=$((cpu2_idle))
total1=$((cpu1_user + cpu1_nice + cpu1_sys + cpu1_idle + cpu1_rest))
total2=$((cpu2_user + cpu2_nice + cpu2_sys + cpu2_idle + cpu2_rest))
diff_idle=$((idle2 - idle1))
diff_total=$((total2 - total1))
if [ $diff_total -gt 0 ]; then
  cpu_pct=$(awk "BEGIN{printf \"%.1f\", 100.0 * (1.0 - $diff_idle / $diff_total)}")
else
  cpu_pct="0.0"
fi

read mem_total mem_avail <<< $(awk "/MemTotal/{t=\$2} /MemAvailable/{a=\$2} END{print t, a}" /proc/meminfo)
ram_used_mb=$(( (mem_total - mem_avail) / 1024 ))
ram_total_mb=$(( mem_total / 1024 ))

read disk_used disk_total <<< $(df -BG /minecraft 2>/dev/null | tail -1 | awk "{gsub(\"G\",\"\"); print \$3, \$2}")

echo "${cpu_pct} ${ram_used_mb} ${ram_total_mb} ${disk_used} ${disk_total}"
'"#;

    let out = run_exec(&state, script).await?;
    let trimmed = out.trim();
    let parts: Vec<&str> = trimmed.split_whitespace().collect();

    if parts.len() >= 5 {
        Ok(SystemMetrics {
            cpu_percent: parts[0].parse().unwrap_or(0.0),
            ram_used_mb: parts[1].parse().unwrap_or(0),
            ram_total_mb: parts[2].parse().unwrap_or(0),
            disk_used_gb: parts[3].parse().unwrap_or(0.0),
            disk_total_gb: parts[4].parse().unwrap_or(0.0),
        })
    } else {
        Ok(SystemMetrics {
            cpu_percent: 0.0,
            ram_used_mb: 0,
            ram_total_mb: 0,
            disk_used_gb: 0.0,
            disk_total_gb: 0.0,
        })
    }
}
