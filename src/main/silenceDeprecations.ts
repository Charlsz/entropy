/**
 * Electron's asar fs wrapper still constructs `fs.Stats` (Node DEP0180).
 * Patch before other main-process work so the console stays clean.
 */
const emitWarning = process.emitWarning.bind(process);

process.emitWarning = ((warning: unknown, ...args: unknown[]) => {
  const code =
    typeof warning === "object" && warning && "code" in warning
      ? String((warning as { code?: string }).code)
      : typeof args[0] === "string"
        ? args[0]
        : typeof args[1] === "object" && args[1] && "code" in (args[1] as object)
          ? String((args[1] as { code?: string }).code)
          : "";
  const message =
    typeof warning === "string"
      ? warning
      : warning instanceof Error
        ? warning.message
        : typeof warning === "object" && warning && "message" in warning
          ? String((warning as { message?: string }).message)
          : "";

  if (code === "DEP0180" || /fs\.Stats constructor/i.test(message)) {
    return;
  }

  return (emitWarning as (...params: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;
