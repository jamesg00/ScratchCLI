import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import {
  disposePtySession,
  killPtySession,
  listenPtyData,
  listenPtyExit,
  resizePtySession,
  startPtySession,
  writePtySession,
} from "../../services/pty";
import type { ShellKind } from "../../types/shell";

type Props = {
  shell: ShellKind;
  command: string;
  cwd?: string;
  dark?: boolean;
  onExit: (code: number | null) => void;
  onError: (message: string) => void;
};

export type InteractivePtyHandle = {
  /** Kill the hosted process and return to ScratchCLI. */
  exitToCli: () => void;
};

function waitForHostSize(host: HTMLElement): Promise<void> {
  if (host.clientWidth >= 80 && host.clientHeight >= 80) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve();
    };
    const observer = new ResizeObserver(() => {
      if (host.clientWidth >= 80 && host.clientHeight >= 80) done();
    });
    observer.observe(host);
    const timer = window.setTimeout(done, 400);
  });
}

export const InteractivePty = forwardRef<InteractivePtyHandle, Props>(
  function InteractivePty(
    { shell, command, cwd, dark = true, onExit, onError },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const sessionRef = useRef<string | null>(null);
    const forceExitRef = useRef<(() => void) | null>(null);

    const handleExit = useEffectEvent((code: number | null) => {
      onExit(code);
    });
    const handleError = useEffectEvent((message: string) => {
      onError(message);
    });

    useImperativeHandle(ref, () => ({
      exitToCli: () => forceExitRef.current?.(),
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const term = new Terminal({
        convertEol: true,
        cursorBlink: false,
        allowTransparency: true,
        scrollback: 200,
        fontFamily: "var(--editor-font, var(--font-code), Consolas, monospace)",
        fontSize: 13,
        theme: dark
          ? {
              background: "#00000000",
              foreground: "#d7dde5",
              cursor: "#d7dde5",
              selectionBackground: "#ffffff33",
            }
          : {
              background: "#00000000",
              foreground: "#1c2430",
              cursor: "#1c2430",
              selectionBackground: "#00000022",
            },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);

      let webgl: WebglAddon | null = null;
      try {
        webgl = new WebglAddon();
        webgl.onContextLoss(() => {
          try {
            webgl?.dispose();
          } catch {
            /* ignore */
          }
          webgl = null;
        });
        term.loadAddon(webgl);
      } catch {
        webgl = null;
      }

      term.focus();
      termRef.current = term;
      fitRef.current = fit;

      let disposed = false;
      let exited = false;
      const unlisteners: Array<() => void> = [];
      const pendingOutput: Array<{ sessionId: string; data: string }> = [];
      const pendingInput: string[] = [];
      let writeQueue = "";
      let writeTimer = 0;

      const flushWriteQueue = () => {
        writeTimer = 0;
        if (!writeQueue) return;
        const chunk = writeQueue;
        writeQueue = "";
        term.write(chunk);
      };

      const queueWrite = (data: string) => {
        writeQueue += data;
        if (writeQueue.length > 512 * 1024) {
          writeQueue = writeQueue.slice(-256 * 1024);
        }
        if (!writeTimer) {
          // ~30fps cap keeps WSL flood TUIs usable.
          writeTimer = window.setTimeout(flushWriteQueue, 32);
        }
      };

      const exitOnce = (code: number | null) => {
        if (exited || disposed) return;
        exited = true;
        handleExit(code);
      };

      const forceExit = () => {
        const id = sessionRef.current;
        sessionRef.current = null;
        exitOnce(null);
        if (id) {
          void killPtySession(id).catch(() => undefined);
        }
      };
      forceExitRef.current = forceExit;

      const flushInput = () => {
        const id = sessionRef.current;
        if (!id || pendingInput.length === 0) return;
        const chunk = pendingInput.splice(0).join("");
        void writePtySession(id, chunk).catch((error) => {
          handleError(error instanceof Error ? error.message : String(error));
        });
      };

      const onQuitChord = (event: KeyboardEvent) => {
        if (!(event.key === "q" || event.key === "Q")) return;
        if (
          !(event.ctrlKey && event.shiftKey) ||
          event.altKey ||
          event.metaKey
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        forceExit();
      };
      window.addEventListener("keydown", onQuitChord, true);
      unlisteners.push(() =>
        window.removeEventListener("keydown", onQuitChord, true),
      );

      unlisteners.push(
        term.onData((data) => {
          const id = sessionRef.current;
          if (!id) {
            pendingInput.push(data);
            return;
          }
          void writePtySession(id, data).catch((error) => {
            handleError(error instanceof Error ? error.message : String(error));
          });
        }).dispose,
      );

      const boot = async () => {
        try {
          await waitForHostSize(host);
          if (disposed) return;
          fit.fit();

          const dataUnlisten = await listenPtyData((event) => {
            if (disposed) return;
            const id = sessionRef.current;
            if (!id) {
              pendingOutput.push(event);
              return;
            }
            if (event.sessionId !== id) return;
            queueWrite(event.data);
          });
          unlisteners.push(dataUnlisten);

          const exitUnlisten = await listenPtyExit((event) => {
            const id = sessionRef.current;
            if (event.sessionId !== id && id != null) return;
            sessionRef.current = null;
            void disposePtySession(event.sessionId).catch(() => undefined);
            exitOnce(event.code);
          });
          unlisteners.push(exitUnlisten);

          term.writeln(
            "\x1b[90m[ScratchCLI] Exit / Ctrl+Shift+Q returns to CLI\x1b[0m",
          );

          const cols = Math.max(term.cols || 0, 80);
          const rows = Math.max(term.rows || 0, 24);
          const { sessionId } = await startPtySession({
            shell,
            command,
            cols,
            rows,
            cwd,
          });
          if (disposed) {
            await killPtySession(sessionId).catch(() => undefined);
            return;
          }
          sessionRef.current = sessionId;
          term.writeln(
            `\x1b[90m[ScratchCLI] hosting ${shell}> ${command}\x1b[0m`,
          );

          for (const event of pendingOutput) {
            if (event.sessionId === sessionId) queueWrite(event.data);
          }
          pendingOutput.length = 0;
          flushInput();

          let resizeTimer = 0;
          let lastCols = term.cols;
          let lastRows = term.rows;
          const onResize = () => {
            fit.fit();
            const id = sessionRef.current;
            if (!id) return;
            if (term.cols === lastCols && term.rows === lastRows) return;
            lastCols = term.cols;
            lastRows = term.rows;
            void resizePtySession(id, term.cols, term.rows).catch(
              () => undefined,
            );
          };
          const scheduleResize = () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(onResize, 160);
          };
          window.addEventListener("resize", scheduleResize);
          unlisteners.push(() => {
            window.removeEventListener("resize", scheduleResize);
            window.clearTimeout(resizeTimer);
          });

          const ro = new ResizeObserver(() => scheduleResize());
          ro.observe(host);
          unlisteners.push(() => ro.disconnect());

          requestAnimationFrame(onResize);
        } catch (error) {
          handleError(error instanceof Error ? error.message : String(error));
        }
      };

      void boot();

      return () => {
        disposed = true;
        forceExitRef.current = null;
        if (writeTimer) window.clearTimeout(writeTimer);
        for (const stop of unlisteners) stop();
        const id = sessionRef.current;
        sessionRef.current = null;
        if (id) {
          void killPtySession(id).catch(() => undefined);
        }
        try {
          webgl?.dispose();
        } catch {
          /* ignore */
        }
        term.dispose();
        termRef.current = null;
        fitRef.current = null;
      };
    }, [shell, command, cwd, dark]);

    return (
      <div
        className="pty-host"
        ref={hostRef}
        style={{ "--pty-fg": "var(--custom-fg)" } as CSSProperties}
        tabIndex={0}
        onMouseDown={() => termRef.current?.focus()}
      />
    );
  },
);
