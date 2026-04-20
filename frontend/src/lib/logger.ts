import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

const isProd = import.meta.env.PROD;

const LOG_ENDPOINT = `${API_BASE_URL}/api/client-log`;

function formatArgs(args: unknown[]): string {
  return args.map(a => {
    if (typeof a === "string") return a;
    if (a instanceof Error)    return a.message;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(" ");
}

function relay(level: "warn" | "error", namespace: string, args: unknown[]): void {
  const token = useAuthStore.getState().token;
  if (!token) return;

  fetch(LOG_ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ level, namespace, message: formatArgs(args) }),
  }).catch(() => { /* swallow — never recurse */ });
}

type LogFn = (...args: unknown[]) => void;

interface Logger {
  debug: LogFn;
  info:  LogFn;
  warn:  LogFn;
  error: LogFn;
}

export function createLogger(namespace: string): Logger {
  const tag = `[${namespace}]`;
  return {
    debug: (...args) => { if (!isProd) console.debug(tag, ...args); },
    info:  (...args) => { if (!isProd) console.info(tag,  ...args); },
    warn:  (...args) => { console.warn(tag, ...args);  relay("warn",  namespace, args); },
    error: (...args) => { console.error(tag, ...args); relay("error", namespace, args); },
  };
}
