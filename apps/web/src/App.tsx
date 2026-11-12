import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  AnalysisDetail,
  AnalysisHistoryItem,
  AnalysisHistoryPagination,
  AnalysisResponse,
  ExtractionResponse,
  HealthResponse,
  PromptVersion,
} from "@wanpanel/shared";
import {
  createAnalysis,
  getAnalysisDetail,
  getAnalysisHistory,
} from "./api/analyses";
import { ApiRequestError } from "./api/errors";
import { createExtraction } from "./api/extractions";
import { getHealth } from "./api/health";
import { AnalysisResultView } from "./components/AnalysisResultView";
import { PromptInspector } from "./components/PromptInspector";

const HISTORY_PAGE_SIZE = 6;

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

type HistoryState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "success";
      items: AnalysisHistoryItem[];
      pagination: AnalysisHistoryPagination;
    }
  | { kind: "error"; message: string };

type HistoryDetailState =
  | { kind: "idle" }
  | { kind: "loading"; id: string }
  | { kind: "success"; id: string; data: AnalysisDetail }
  | { kind: "error"; id: string; message: string };

type LiveInspectorState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: AnalysisDetail }
  | { kind: "error" };

export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const [view, setView] = useState<"analyze" | "history">("analyze");
  const [url, setUrl] = useState("");
  const [extraction, setExtraction] = useState<ExtractionState>({ kind: "idle" });
  const [analysis, setAnalysis] = useState<AnalysisState>({ kind: "idle" });
  const [promptVersion, setPromptVersion] = useState<PromptVersion>("v2");
  const [liveInspector, setLiveInspector] = useState<LiveInspectorState>({
    kind: "idle",
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [history, setHistory] = useState<HistoryState>({ kind: "idle" });
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<HistoryDetailState>({
    kind: "idle",
  });
  const historyDetailController = useRef<AbortController | null>(null);
  const historyDetailSequence = useRef(0);
  const liveInspectorController = useRef<AbortController | null>(null);
  const liveInspectorSequence = useRef(0);

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

  useEffect(() => {
    if (view !== "history" || selectedHistoryId !== null) return;

    const controller = new AbortController();
    setHistory({ kind: "loading" });

    getAnalysisHistory(historyPage, HISTORY_PAGE_SIZE, controller.signal)
      .then(({ items, pagination }) => {
        if (!controller.signal.aborted) {
          setHistory({ kind: "success", items, pagination });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHistory({
            kind: "error",
            message: errorMessage(
              error,
              "The analysis history could not be loaded.",
            ),
          });
        }
      });

    return () => controller.abort();
  }, [historyPage, historyRefresh, selectedHistoryId, view]);

  useEffect(
    () => () => {
      historyDetailController.current?.abort();
      liveInspectorController.current?.abort();
    },
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancelLiveInspector();
    setExtraction({ kind: "loading" });
    setAnalysis({ kind: "idle" });

    try {
      const data = await createExtraction(url.trim());
      setExtraction({ kind: "success", data });
    } catch (error) {
      setExtraction({
        kind: "error",
        message: errorMessage(error, "The webpage could not be extracted."),
      });
    }
  }

  async function handleAnalyze(extractionId: string) {
    cancelLiveInspector();
    setAnalysis({ kind: "loading" });

    try {
      const data = await createAnalysis(extractionId, promptVersion);
      setAnalysis({ kind: "success", data });
      void loadLiveInspector(data.id);
    } catch (error) {
      setAnalysis({
        kind: "error",
        message: errorMessage(error, "The webpage could not be analyzed."),
      });
    }
  }

  async function loadLiveInspector(analysisId: string) {
    const controller = new AbortController();
    liveInspectorController.current = controller;
    const sequence = ++liveInspectorSequence.current;
    setLiveInspector({ kind: "loading" });

    try {
      const data = await getAnalysisDetail(analysisId, controller.signal);
      if (!controller.signal.aborted && sequence === liveInspectorSequence.current) {
        setLiveInspector({ kind: "success", data });
      }
    } catch {
      if (!controller.signal.aborted && sequence === liveInspectorSequence.current) {
        setLiveInspector({ kind: "error" });
      }
    }
  }

  function cancelLiveInspector() {
    liveInspectorController.current?.abort();
    liveInspectorController.current = null;
    liveInspectorSequence.current += 1;
    setLiveInspector({ kind: "idle" });
  }

  async function selectHistoryRecord(analysisId: string) {
    historyDetailController.current?.abort();
    const controller = new AbortController();
    historyDetailController.current = controller;
    const sequence = ++historyDetailSequence.current;
    setSelectedHistoryId(analysisId);
    setHistoryDetail({ kind: "loading", id: analysisId });

    try {
      const data = await getAnalysisDetail(analysisId, controller.signal);
      if (
        !controller.signal.aborted &&
        sequence === historyDetailSequence.current
      ) {
        setHistoryDetail({ kind: "success", id: analysisId, data });
      }
    } catch (error) {
      if (
        !controller.signal.aborted &&
        sequence === historyDetailSequence.current
      ) {
        setHistoryDetail({
          kind: "error",
          id: analysisId,
          message: errorMessage(error, "The saved analysis could not be loaded."),
        });
      }
    }
  }

  function returnToHistory() {
    historyDetailController.current?.abort();
    historyDetailController.current = null;
    historyDetailSequence.current += 1;
    setSelectedHistoryId(null);
    setHistoryDetail({ kind: "idle" });
  }

  function startNewAnalysis() {
    returnToHistory();
    cancelLiveInspector();
    setView("analyze");
    setUrl("");
    setExtraction({ kind: "idle" });
    setAnalysis({ kind: "idle" });
    setPromptVersion("v2");
  }

  function changePromptVersion(value: PromptVersion) {
    cancelLiveInspector();
    setPromptVersion(value);
    setAnalysis({ kind: "idle" });
  }

  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <div className="header-row">
          <div>
            <p className="eyebrow">WanPanel AI Team</p>
            <h1 id="page-title">Web Content Analyzer</h1>
            <p className="intro">
              Extract, analyze, and revisit evidence-supported webpage insights.
            </p>
          </div>

          <div className={`status status--${health.kind}`} role="status">
            <span className="status__dot" aria-hidden="true" />
            {health.kind === "loading" && "Connecting..."}
            {health.kind === "connected" && "API connected"}
            {health.kind === "error" && "API unavailable"}
          </div>
        </div>

        <div className="view-tabs" role="tablist" aria-label="Application view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "analyze"}
            className={view === "analyze" ? "is-active" : undefined}
            onClick={() => setView("analyze")}
          >
            Analyze
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "history"}
            className={view === "history" ? "is-active" : undefined}
            onClick={() => setView("history")}
          >
            History
          </button>
        </div>

        {view === "analyze" ? (
          <AnalyzeView
            url={url}
            setUrl={setUrl}
            extraction={extraction}
            analysis={analysis}
            promptVersion={promptVersion}
            setPromptVersion={changePromptVersion}
            liveInspector={liveInspector}
            onSubmit={handleSubmit}
            onAnalyze={handleAnalyze}
          />
        ) : selectedHistoryId === null ? (
          <HistoryList
            state={history}
            onSelect={selectHistoryRecord}
            onRetry={() => setHistoryRefresh((value) => value + 1)}
            onPageChange={setHistoryPage}
            onStartNew={startNewAnalysis}
          />
        ) : (
          <HistoryDetail
            state={historyDetail}
            onBack={returnToHistory}
            onStartNew={startNewAnalysis}
            onRetry={() => void selectHistoryRecord(selectedHistoryId)}
          />
        )}
      </section>
    </main>
  );
}

interface AnalyzeViewProps {
  url: string;
  setUrl: (value: string) => void;
  extraction: ExtractionState;
  analysis: AnalysisState;
  promptVersion: PromptVersion;
  setPromptVersion: (value: PromptVersion) => void;
  liveInspector: LiveInspectorState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAnalyze: (extractionId: string) => void;
}

function AnalyzeView({
  url,
  setUrl,
  extraction,
  analysis,
  promptVersion,
  setPromptVersion,
  liveInspector,
  onSubmit,
  onAnalyze,
}: AnalyzeViewProps) {
  return (
    <div role="tabpanel">
      <form className="extract-form" onSubmit={onSubmit}>
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
              <a href={extraction.data.sourceUrl} target="_blank" rel="noreferrer">
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
            <label htmlFor="prompt-version">Prompt version</label>
            <select
              id="prompt-version"
              value={promptVersion}
              onChange={(event) => {
                setPromptVersion(event.target.value as PromptVersion);
              }}
              disabled={analysis.kind === "loading"}
            >
              <option value="v1">V1 Baseline</option>
              <option value="v2">V2 Stable</option>
            </select>
            <button
              type="button"
              onClick={() => onAnalyze(extraction.data.id)}
              disabled={analysis.kind === "loading"}
            >
              {analysis.kind === "loading"
                ? "Analyzing with AI..."
                : "Analyze with AI"}
            </button>
          </div>
          <h3 className="preview-title">Source Preview</h3>
          <pre className="content-preview">{extraction.data.extractedText}</pre>
        </section>
      )}

      {analysis.kind === "loading" && (
        <div className="notice" role="status">
          Generating and validating the structured analysis. This can take up to
          a minute.
        </div>
      )}
      {analysis.kind === "error" && (
        <div className="notice notice--error" role="alert">
          {analysis.message}
        </div>
      )}
      {analysis.kind === "success" && (
        <>
          <AnalysisResultView
            result={analysis.data.result}
            model={analysis.data.model}
            promptVersion={analysis.data.promptVersion}
          />
          <PromptInspector
            promptVersion={analysis.data.promptVersion}
            model={analysis.data.model}
            result={analysis.data.result}
            promptSnapshots={
              liveInspector.kind === "success"
                ? liveInspector.data.promptSnapshots
                : undefined
            }
            snapshotState={
              liveInspector.kind === "loading" || liveInspector.kind === "error"
                ? liveInspector.kind
                : undefined
            }
          />
        </>
      )}
    </div>
  );
}

interface HistoryListProps {
  state: HistoryState;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onStartNew: () => void;
}

function HistoryList({
  state,
  onSelect,
  onRetry,
  onPageChange,
  onStartNew,
}: HistoryListProps) {
  return (
    <section className="history-section" role="tabpanel" aria-labelledby="history-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PostgreSQL history</p>
          <h2 id="history-title">Saved analyses</h2>
          <p>Reopen a previous result without extracting or analyzing again.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onStartNew}>
          Start new analysis
        </button>
      </div>

      {state.kind === "idle" || state.kind === "loading" ? (
        <div className="notice" role="status">
          Loading saved analyses…
        </div>
      ) : state.kind === "error" ? (
        <div className="notice notice--error" role="alert">
          <span>{state.message}</span>
          <button type="button" className="inline-button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : state.items.length === 0 ? (
        <div className="history-empty">
          <h3>No saved analyses yet</h3>
          <p>Extract a webpage and run an analysis to create the first record.</p>
          <button type="button" className="secondary-button" onClick={onStartNew}>
            Analyze a webpage
          </button>
        </div>
      ) : (
        <>
          <div className="history-list">
            {state.items.map((item) => (
              <button
                type="button"
                className="history-card"
                key={item.id}
                onClick={() => onSelect(item.id)}
              >
                <span className="history-card__content">
                  <strong>{item.pageTitle ?? "Untitled webpage"}</strong>
                  <span className="history-card__url">{item.sourceUrl}</span>
                  <span className="history-card__date">
                    {formatTimestamp(item.createdAt)}
                  </span>
                </span>
                <span className="history-card__meta">
                  <span>Prompt {item.promptVersion.toUpperCase()}</span>
                  <span>{item.model}</span>
                </span>
              </button>
            ))}
          </div>
          <nav className="pagination" aria-label="Analysis history pages">
            <button
              type="button"
              onClick={() => onPageChange(state.pagination.page - 1)}
              disabled={state.pagination.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {state.pagination.page} of {state.pagination.totalPages} ·{" "}
              {state.pagination.total} records
            </span>
            <button
              type="button"
              onClick={() => onPageChange(state.pagination.page + 1)}
              disabled={state.pagination.page >= state.pagination.totalPages}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

interface HistoryDetailProps {
  state: HistoryDetailState;
  onBack: () => void;
  onStartNew: () => void;
  onRetry: () => void;
}

function HistoryDetail({
  state,
  onBack,
  onStartNew,
  onRetry,
}: HistoryDetailProps) {
  return (
    <section className="history-detail" role="tabpanel">
      <div className="detail-actions">
        <button type="button" className="text-button" onClick={onBack}>
          ← Back to History
        </button>
        <button type="button" className="secondary-button" onClick={onStartNew}>
          Start new analysis
        </button>
      </div>

      {state.kind === "idle" || state.kind === "loading" ? (
        <div className="notice" role="status">
          Loading saved analysis…
        </div>
      ) : state.kind === "error" ? (
        <div className="notice notice--error" role="alert">
          <span>{state.message}</span>
          <button type="button" className="inline-button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="result historical-source" aria-labelledby="saved-source-title">
            <div className="result__heading">
              <div>
                <p className="eyebrow">Saved source</p>
                <h2 id="saved-source-title">
                  {state.data.extraction.pageTitle ?? "Untitled webpage"}
                </h2>
                <a
                  href={state.data.extraction.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {state.data.extraction.sourceUrl}
                </a>
              </div>
              <div className="result__meta">
                {state.data.extraction.characterCount.toLocaleString()} characters
                {state.data.extraction.wasTruncated && " · truncated"}
              </div>
            </div>
            <p className="saved-at">
              Saved {formatTimestamp(state.data.createdAt)}
            </p>
            <h3 className="preview-title">Source Preview</h3>
            <pre className="content-preview">
              {state.data.extraction.extractedText}
            </pre>
          </section>

          <AnalysisResultView
            result={state.data.result}
            model={state.data.model}
            promptVersion={state.data.promptVersion}
            eyebrow="Historical analysis"
            status={state.data.status}
          />
          <PromptInspector
            promptVersion={state.data.promptVersion}
            model={state.data.model}
            result={state.data.result}
            promptSnapshots={state.data.promptSnapshots}
          />
        </>
      )}
    </section>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError || error instanceof Error
    ? error.message
    : fallback;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
