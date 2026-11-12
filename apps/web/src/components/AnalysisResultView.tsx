import type { Analysis, PromptVersion } from "@wanpanel/shared";

interface AnalysisResultViewProps {
  result: Analysis | null;
  model: string;
  promptVersion: PromptVersion;
  eyebrow?: string;
  status?: "completed" | "failed";
}

export function AnalysisResultView({
  result,
  model,
  promptVersion,
  eyebrow = "AI analysis",
  status,
}: AnalysisResultViewProps) {
  return (
    <section className="ai-result" aria-labelledby="analysis-title">
      <div className="ai-result__header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="analysis-title">{result?.title ?? "Analysis unavailable"}</h2>
        </div>
        <div className="analysis-badges" aria-label="Analysis metadata">
          <span>{model}</span>
          <span>Prompt {promptVersion.toUpperCase()}</span>
          {status && <span>{status}</span>}
        </div>
      </div>

      {result === null ? (
        <div className="notice notice--warning">
          This saved analysis does not contain a structured result.
        </div>
      ) : (
        <>
          <div className="analysis-section">
            <h3>Summary</h3>
            <p>{result.summary}</p>
          </div>

          <div className="analysis-section">
            <h3>Key findings</h3>
            {result.keyFindings.length === 0 ? (
              <p className="empty-value">No key findings returned.</p>
            ) : (
              <div className="finding-list">
                {result.keyFindings.map((item, index) => (
                  <article className="finding" key={`${index}-${item.finding}`}>
                    <h4>{item.finding}</h4>
                    <div className="finding__evidence">
                      <p className="finding__evidence-label">
                        Supporting evidence
                      </p>
                      <blockquote>{item.evidence}</blockquote>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <AnalysisList title="Entities" items={result.entities} />
          <AnalysisList
            title="Dates or numbers"
            items={result.datesOrNumbers}
          />
          <AnalysisList
            title="Missing information"
            items={result.missingInformation}
            variant="rows"
            emptyMessage="No significant information gaps reported."
          />
        </>
      )}
    </section>
  );
}

function AnalysisList({
  title,
  items,
  variant = "tags",
  emptyMessage = "None reported.",
}: {
  title: string;
  items: string[];
  variant?: "tags" | "rows";
  emptyMessage?: string;
}) {
  return (
    <div className="analysis-section">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="empty-value">{emptyMessage}</p>
      ) : (
        <ul className={variant === "rows" ? "detail-list" : "tag-list"}>
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
