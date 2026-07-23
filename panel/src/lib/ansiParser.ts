// Map Minecraft/ANSI color codes to CSS colors
export const ANSI_COLORS: Record<string, string> = {
    '30': '#1e1e1e', '31': '#cc3333', '32': '#4e9a06', '33': '#c4a000',
    '34': '#3465a4', '35': '#9b59b6', '36': '#06989a', '37': '#d3d7cf',
    '90': '#555753', '91': '#ef5350', '92': '#8ae234', '93': '#fce94f',
    '94': '#729fcf', '95': '#ad7fa8', '96': '#34e2e2', '97': '#eeeeec',
};

export interface AnsiSpan {
    text: string;
    color?: string;
    bold?: boolean;
}

export function parseAnsi(line: string): AnsiSpan[] {
    const spans: AnsiSpan[] = [];
    // eslint-disable-next-line no-control-regex
    const regex = /\x1b\[([0-9;]*)m/g;
    let lastIndex = 0;
    let currentColor: string | undefined;
    let currentBold = false;

    let match;
    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            spans.push({ text: line.slice(lastIndex, match.index), color: currentColor, bold: currentBold });
        }
        const codes = match[1].split(';').filter(Boolean);
        for (const code of codes) {
            if (code === '0') { currentColor = undefined; currentBold = false; }
            else if (code === '1') { currentBold = true; }
            else if (ANSI_COLORS[code]) { currentColor = ANSI_COLORS[code]; }
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
        spans.push({ text: line.slice(lastIndex), color: currentColor, bold: currentBold });
    }
    if (spans.length === 0) {
        spans.push({ text: line });
    }
    return spans;
}

// Colorize Minecraft log levels in plain text (no ANSI)
export function colorizeLogLine(line: string): AnsiSpan[] {
    // If line contains ANSI escape codes, parse them
    // eslint-disable-next-line no-control-regex
    if (/\x1b\[/.test(line)) {
        return parseAnsi(line);
    }

    // Otherwise, colorize based on log level keywords
    if (/\bWARN\b/i.test(line)) {
        return [{ text: line, color: '#F0A331' }];
    }
    if (/\bERROR\b/i.test(line)) {
        return [{ text: line, color: '#FF496E' }];
    }
    if (/\bINFO\b/i.test(line)) {
        return [{ text: line, color: '#97A0A9' }];
    }

    return [{ text: line }];
}
