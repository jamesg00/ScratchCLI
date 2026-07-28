import { CLI_BRAND_ASCII } from "./cliBrand";

export function CliBrandBanner() {
  return (
    <div className="cli-brand" aria-label="ScratchCLI">
      <pre className="cli-brand-ascii">{CLI_BRAND_ASCII}</pre>
    </div>
  );
}
