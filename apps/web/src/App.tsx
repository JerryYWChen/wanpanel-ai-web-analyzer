import { type FormEvent, useEffect, useState } from "react";
import type {
  AnalysisResponse,
  ExtractionResponse,
  HealthResponse,
} from "@wanpanel/shared";
import { createAnalysis } from "./api/analyses";
import { ApiRequestError } from "./api/errors";
import { createExtraction } from "./api/extractions";
import { getHealth } from "./api/health";

type HealthState =
  | { kind: "loading" }
  | { kind: "connected"; data: HealthResponse }
  | { kind: "error"; message: string };

type ExtractionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: ExtractionResponse }
  | { kind: "error"; message: string };

type AnalysisState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: AnalysisResponse }
  | { kind: "error"; message: string };

export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const [url, setUrl] = useState("");
  const [extraction, setExtraction] = useState<ExtractionState>({ kind: "idle" });
  const [analysis, setAnalysis] = useState<AnalysisState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();

    getHealth(controller.signal)
      .then((data) => setHealth({ kind: "connected", data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHealth({
            kind: "error",
            message:
              error instanceof Error ? error.message : "Unknown health error.",
          });
        }
      });

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExtraction({ kind: "loading" });
    setAnalysis({ kind: "idle" });

    try {
      const data = await createExtraction(url.trim());
      setExtraction({ kind: "success", data });
    } catch (error) {
      setExtraction({
        kind: "error",
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : "The webpage could not be extracted.",
      });
    }
  }

  async function handleAnalyze(extractionId: string) {
    setAnalysis({ kind: "loading" });

    try {
      const data = await createAnalysis(extractionId);
      setAnalysis({ kind: "success", data });
    } catch (error) {
      setAnalysis({
        kind: "error",
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : "The webpage could not be analyzed.",
      });
    }
  }

  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <div className="header-row">
          <div>
            <p className="eyebrow">WanPanel AI Team</p>
            <h1 id="page-title">Web Content Analyzer</h1>
            <p className="intro">
              Extract the readable content from a public HTML webpage.
            </p>
          </div>

          <div className={`status status--${health.kind}`} role="status">
            <span className="status__dot" aria-hidden="true" />
            {health.kind === "loading" && "Connecting..."}
            {health.kind === "connected" && "API connected"}
            {health.kind === "error" && "API unavailable"}
          </div>
        </div>

        <form className="extract-form" onSubmit={handleSubmit}>
          <label htmlFor="source-url">Public webpage URL</label>
          <div className="input-row">
            <input
              id="source-url"
              name="url"
              type="url"
              placeholder="https://example.com/article"
              required
              maxLength={2048}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={extraction.kind === "loading"}
            />
            <button type="submit" disabled={extraction.kind === "loading"}>
              {extraction.kind === "loading" ? "Extracting..." : "Extract"}
            </button>
          </div>
        </form>

        {extraction.kind === "loading" && (
          <div className="notice" role="status">
            Fetching and cleaning the webpage. This may take a few seconds.
          </div>
        )}

        {extraction.kind === "error" && (
          <div className="notice notice--error" role="alert">
            {extraction.message}
          </div>
        )}

        {extraction.kind === "success" && (
          <section className="result" aria-labelledby="result-title">
            <div className="result__heading">
              <div>
                <p className="eyebrow">Extraction complete</p>
                <h2 id="result-title">
                  {extraction.data.pageTitle ?? "Untitled webpage"}
                </h2>
                <a
                  href={extraction.data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {extraction.data.sourceUrl}
                </a>
              </div>
              <div className="result__meta">
                {extraction.data.characterCount.toLocaleString()} characters
                {extraction.data.wasTruncated && " · truncated"}
              </div>
            </div>
            {extraction.data.wasTruncated && (
              <div className="notice notice--warning">
                The source exceeded the configured limit and was truncated at a
                paragraph boundary.
              </div>
            )}
            <div className="analysis-action">
              <button
                type="button"
                onClick={() => handleAnalyze(extraction.data.id)}
                disabled={analysis.kind === "loading"}
              >
                {analysis.kind === "loading"
                  ? "Analyzing with AI..."
                  : "Analyze with AI"}
              </button>
              <span>Uses Prompt V1</span>
            </div>
            <pre className="content-preview">{extraction.data.extractedText}</pre>
          </section>
        )}

        {analysis.kind === "loading" && (
          <div className="notice" role="status">
            Generating and validating the structured analysis. This can take up
            to a minute.
          </div>
        )}

        {analysis.kind === "error" && (
          <div className="notice notice--error" role="alert">
            {analysis.message}
          </div>
        )}

        {analysis.kind === "success" && (
          <section className="ai-result" aria-labelledby="analysis-title">
            <div className="ai-result__header">
              <div>
                <p className="eyebrow">AI analysis</p>
                <h2 id="analysis-title">{analysis.data.result.title}</h2>
              </div>
              <div className="analysis-badges">
                <span>{analysis.data.model}</span>
                <span>Prompt V1</span>
              </div>
            </div>

            <div className="analysis-section">
              <h3>Summary</h3>
              <p>{analysis.data.result.summary}</p>
            </div>

            <div className="analysis-section">
              <h3>Key findings</h3>
              {analysis.data.result.keyFindings.length === 0 ? (
                <p className="empty-value">No key findings returned.</p>
              ) : (
                <div className="finding-list">
                  {analysis.data.result.keyFindings.map((item, index) => (
                    <article className="finding" key={`${index}-${item.finding}`}>
                      <h4>{item.finding}</h4>
                      <blockquote>{item.evidence}</blockquote>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <AnalysisList
              title="Entities"
              items={analysis.data.result.entities}
            />
            <AnalysisList
              title="Dates or numbers"
              items={analysis.data.result.datesOrNumbers}
            />
            <AnalysisList
              title="Missing information"
              items={analysis.data.result.missingInformation}
            />
          </section>
        )}
      </section>
    </main>
  );
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="analysis-section">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="empty-value">None reported.</p>
      ) : (
        <ul className="tag-list">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
