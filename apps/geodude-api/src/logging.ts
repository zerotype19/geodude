// Logging utilities for the API
export function log(event: string, extra: Record<string, any> = {}) {
    const logData = {
        ts: Date.now(),
        event,
        ...extra
    };
    console.log(JSON.stringify(logData));
}
