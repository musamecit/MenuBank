/**
 * Global crash handler. Catches uncaught JS errors and unhandled promise rejections.
 * Use subscribeCrash() in the root component to show the crash screen.
 */

type CrashListener = (error: Error) => void;

let crashError: Error | null = null;
const listeners: CrashListener[] = [];

export function setCrashError(err: Error): void {
  crashError = err;
  listeners.forEach((l) => l(err));
}

export function subscribeCrash(listener: CrashListener): () => void {
  listeners.push(listener);
  if (crashError) listener(crashError);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function getCrashError(): Error | null {
  return crashError;
}

function installGlobalHandlers(): void {
  try {
    const ErrorUtils = (global as unknown as {
      ErrorUtils?: {
        setGlobalHandler: (h: (e: Error, f?: boolean) => void) => void;
        getGlobalHandler?: () => (e: Error, f?: boolean) => void;
      };
    }).ErrorUtils;
    if (ErrorUtils?.setGlobalHandler) {
      const original = ErrorUtils.getGlobalHandler?.();
      ErrorUtils.setGlobalHandler((error: Error) => {
        setCrashError(error);
        if (__DEV__ && original) original(error);
      });
    }

    const g = global as unknown as { onunhandledrejection?: (e: { reason: unknown }) => void };
    const origRejection = g.onunhandledrejection;
    g.onunhandledrejection = (e: { reason: unknown }) => {
      const err =
        e?.reason instanceof Error ? e.reason : new Error(String(e?.reason ?? 'Unhandled promise rejection'));
      setCrashError(err);
      if (__DEV__ && origRejection) origRejection(e);
    };
  } catch (_) {
    // Avoid crashing while installing crash handler
  }
}

installGlobalHandlers();
