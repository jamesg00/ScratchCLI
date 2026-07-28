import { describe, expect, it } from "vitest";
import { isEditorSlashCommand, parseTerminalCommand } from "./commands";

describe("terminal command parser", () => {
  it("parses the Pro theme and opacity", () => {
    expect(parseTerminalCommand("theme pro")).toEqual({
      kind: "theme",
      value: "pro",
    });
    expect(parseTerminalCommand("opacity .7")).toEqual({
      kind: "opacity",
      value: 0.7,
    });
    expect(parseTerminalCommand("opacity 70")).toEqual({
      kind: "opacity",
      value: 0.7,
    });
    expect(parseTerminalCommand("opacity 50%")).toEqual({
      kind: "opacity",
      value: 0.5,
    });
    expect(parseTerminalCommand("opacity on")).toEqual({
      kind: "opacityToggle",
      on: true,
    });
    expect(parseTerminalCommand("opacity off")).toEqual({
      kind: "opacityToggle",
      on: false,
    });
    expect(parseTerminalCommand("opacity 0")).toEqual({
      kind: "opacity",
      value: 0,
    });
  });

  it("supports CMD-style colors", () => {
    expect(parseTerminalCommand("color A")).toEqual({
      kind: "color",
      foreground: "#16c60c",
    });
    expect(parseTerminalCommand("color 1A")).toEqual({
      kind: "color",
      background: "#0037da",
      foreground: "#16c60c",
    });
  });

  it("rejects unsupported commands", () => {
    expect(parseTerminalCommand("xyzzy everything")).toEqual({
      kind: "error",
      message: "Unknown command: xyzzy. Type help for commands.",
    });
  });

  it("routes explicit local shell commands", () => {
    expect(parseTerminalCommand("/powershell Get-Process")).toEqual({
      kind: "shellRun",
      shell: "powershell",
      command: "Get-Process",
    });
    expect(parseTerminalCommand("/wsl ls -la")).toEqual({
      kind: "shellRun",
      shell: "wsl",
      command: "ls -la",
    });
  });

  it("lists fonts when no name is given", () => {
    expect(parseTerminalCommand("font")).toEqual({ kind: "font" });
    expect(parseTerminalCommand("fonts")).toEqual({ kind: "font" });
    expect(parseTerminalCommand("list fonts")).toEqual({ kind: "font" });
    expect(parseTerminalCommand("list fonts clear")).toEqual({
      kind: "fontClear",
    });
    expect(parseTerminalCommand("font clear")).toEqual({ kind: "fontClear" });
  });

  it("opens DSA coach via grok/coach/dsa", () => {
    expect(parseTerminalCommand("grok")).toEqual({ kind: "grok" });
    expect(parseTerminalCommand("coach")).toEqual({ kind: "grok" });
    expect(parseTerminalCommand("dsa")).toEqual({ kind: "grok" });
  });

  it("opens AI environment via env/aisettings/apikeys", () => {
    expect(parseTerminalCommand("env")).toEqual({ kind: "aiSettings" });
    expect(parseTerminalCommand("aisettings")).toEqual({ kind: "aiSettings" });
    expect(parseTerminalCommand("apikeys")).toEqual({ kind: "aiSettings" });
  });

  it("parses open note and open file", () => {
    expect(parseTerminalCommand("open note hello")).toEqual({
      kind: "openNote",
      query: "hello",
    });
    expect(parseTerminalCommand("/open C:\\tmp\\a.py")).toEqual({
      kind: "openFile",
      path: "C:\\tmp\\a.py",
    });
  });

  it("parses look and remove commands", () => {
    expect(parseTerminalCommand("look readme.txt")).toEqual({
      kind: "lookFile",
      path: "readme.txt",
    });
    expect(parseTerminalCommand("cat note ideas")).toEqual({
      kind: "lookNote",
      query: "ideas",
    });
    expect(parseTerminalCommand("remove note old")).toEqual({
      kind: "removeNote",
      query: "old",
    });
    expect(parseTerminalCommand("rm folder/name")).toEqual({
      kind: "removePath",
      path: "folder/name",
    });
  });

  it("parses language slash commands", () => {
    expect(parseTerminalCommand("/language python")).toEqual({
      kind: "language",
      value: "python",
    });
  });

  it("treats /runtime as an alias for /run", () => {
    expect(parseTerminalCommand("/run")).toEqual({ kind: "run" });
    expect(parseTerminalCommand("/runtime")).toEqual({ kind: "run" });
    expect(parseTerminalCommand("runtime")).toEqual({ kind: "run" });
  });

  it("only recognizes known editor slash commands by exact name", () => {
    expect(isEditorSlashCommand("/run")).toBe(true);
    expect(isEditorSlashCommand("/runtime")).toBe(true);
    expect(isEditorSlashCommand("/mkdir docs")).toBe(true);
    expect(isEditorSlashCommand("/language python")).toBe(true);
    expect(isEditorSlashCommand("/running")).toBe(false);
    expect(isEditorSlashCommand("/runtime/config")).toBe(false);
    expect(isEditorSlashCommand("run")).toBe(false);
  });

  it("parses mkdir touch and split", () => {
    expect(parseTerminalCommand("mkdir docs")).toEqual({
      kind: "mkdir",
      path: "docs",
    });
    expect(parseTerminalCommand("md nested\\folder")).toEqual({
      kind: "mkdir",
      path: "nested\\folder",
    });
    expect(parseTerminalCommand("touch a.py")).toEqual({
      kind: "touch",
      path: "a.py",
    });
    expect(parseTerminalCommand("touch note")).toEqual({
      kind: "touchNote",
    });
    expect(parseTerminalCommand("touch note Shopping")).toEqual({
      kind: "touchNote",
      title: "Shopping",
    });
    expect(parseTerminalCommand("split 2")).toEqual({
      kind: "split",
      count: 2,
    });
    expect(parseTerminalCommand("tab new")).toEqual({ kind: "tabNew" });
    expect(parseTerminalCommand("tab clone")).toEqual({ kind: "tabClone" });
    expect(parseTerminalCommand("clone")).toEqual({ kind: "tabClone" });
    expect(parseTerminalCommand("duplicate")).toEqual({ kind: "tabClone" });
    expect(parseTerminalCommand("grok")).toEqual({ kind: "grok" });
    expect(parseTerminalCommand("/grok")).toEqual({ kind: "grok" });
  });
});
