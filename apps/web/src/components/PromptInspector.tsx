import type { Analysis, PromptVersion } from "@wanpanel/shared";

interface PromptInspectorProps {
  promptVersion: PromptVersion;
  model: string;
  result: Analysis | null;
  promptSnapshots?: {
    system: string;
    userTemplate: string;
  } | undefined;
  snapshotState?: "loading" | "error" | undefined;
}

export function PromptInspector({
  promptVersion,
  model,
  result,
  promptSnapshots,
  snapshotState,
}: PromptInspectorProps) {
  return (
    <section className="prompt-inspector" aria-labelledby="prompt-inspector-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Saved generation context</p>
          <h2 id="prompt-inspector-title">Prompt Inspector</h2>
        </div>
        <div className="analysis-badges" aria-label="Prompt metadata">
          <span>{model}</span>
          <span>Prompt {promptVersion.toUpperCase()}</span>
        </div>
      </div>

      {snapshotState === "loading" && (
        <div className="notice" role="status">
          Loading stored prompt snapshots…
        </div>
      )}
      {snapshotState === "error" && (
        <div className="notice notice--warning">
          The analysis is available, but its stored prompt snapshots could not
          be loaded.
        </div>
      )}

      {promptSnapshots && (
        <div className="inspector-sections">
          <details>
            <summary>System Prompt snapshot</summary>
            <pre>{promptSnapshots.system}</pre>
          </details>
          <details>
            <summary>User Prompt template snapshot</summary>
            <p className="inspector-note">
              This is the stored template, not the fully rendered prompt.
            </p>
            <pre>{promptSnapshots.userTemplate}</pre>
          </details>
        </div>
      )}

      <div className="inspector-sections">
        <details>
          <summary>Structured JSON output</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      </div>
    </section>
  );
}
