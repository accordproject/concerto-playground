import { useEffect, useState } from "react";

type ImportMode = "files" | "json";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFiles: (files: FileList) => Promise<void>;
  onImportJson: (source: string) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function ImportDialog({
  isOpen,
  onClose,
  onImportFiles,
  onImportJson,
}: ImportDialogProps) {
  const [mode, setMode] = useState<ImportMode>("files");
  const [jsonSource, setJsonSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMode("files");
      setJsonSource("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onImportFiles(files);
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setIsSubmitting(false);
      event.target.value = "";
    }
  }

  async function handleJsonFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    try {
      setJsonSource(await file.text());
    } catch (readError) {
      setError(getErrorMessage(readError));
    } finally {
      event.target.value = "";
    }
  }

  async function handleJsonImport() {
    if (!jsonSource.trim()) {
      setError("Paste or load a JSON Schema or JSON sample first.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onImportJson(jsonSource);
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-model-title"
      style={overlayStyle}
      onClick={onClose}
    >
      <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 id="import-model-title" style={titleStyle}>Import Model</h2>
            <p style={subtitleStyle}>
              Load existing `.cto` or JSON AST files, or infer CTO from JSON Schema and JSON samples.
            </p>
          </div>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close import dialog">
            ×
          </button>
        </div>

        <div style={tabListStyle}>
          <button
            onClick={() => setMode("files")}
            style={{
              ...tabButtonStyle,
              background: mode === "files" ? "#3182ce" : "#2d3748",
            }}
          >
            CTO / AST Files
          </button>
          <button
            onClick={() => setMode("json")}
            style={{
              ...tabButtonStyle,
              background: mode === "json" ? "#3182ce" : "#2d3748",
            }}
          >
            JSON / JSON Schema
          </button>
        </div>

        {mode === "files" ? (
          <div style={panelStyle}>
            <p style={bodyTextStyle}>
              Import one or more `.cto` files or Concerto JSON AST `.json` files into the current session.
            </p>
            <label style={fileFieldStyle}>
              <span style={fieldLabelStyle}>Choose `.cto` or JSON AST files</span>
              <input
                type="file"
                accept=".cto,.json"
                multiple
                onChange={handleFileChange}
                disabled={isSubmitting}
                data-testid="model-file-input"
              />
            </label>
          </div>
        ) : (
          <div style={panelStyle}>
            <p style={bodyTextStyle}>
              Paste a JSON Schema document or a representative JSON object or array, then import the inferred CTO.
            </p>
            <label style={fileFieldStyle}>
              <span style={fieldLabelStyle}>Load JSON from file</span>
              <input
                type="file"
                accept=".json,.schema.json,application/json"
                onChange={handleJsonFileChange}
                disabled={isSubmitting}
                data-testid="json-file-input"
              />
            </label>
            <label htmlFor="json-import-source" style={fieldLabelStyle}>
              JSON input
            </label>
            <textarea
              id="json-import-source"
              value={jsonSource}
              onChange={(event) => setJsonSource(event.target.value)}
              placeholder='{"firstName":"Alice"}'
              spellCheck={false}
              style={textAreaStyle}
            />
            <div style={footerStyle}>
              <button onClick={handleJsonImport} style={primaryButtonStyle} disabled={isSubmitting}>
                Import JSON
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={errorStyle}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 70,
  padding: 24,
};

const dialogStyle: React.CSSProperties = {
  width: "min(760px, 100%)",
  background: "#171d2b",
  border: "1px solid #2d3748",
  borderRadius: 14,
  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
  color: "#e2e8f0",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  padding: "20px 22px 12px",
  borderBottom: "1px solid #2d3748",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#a0aec0",
  fontSize: 13,
  lineHeight: 1.5,
};

const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#a0aec0",
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
};

const tabListStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "14px 22px 0",
};

const tabButtonStyle: React.CSSProperties = {
  border: "none",
  color: "#e2e8f0",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const panelStyle: React.CSSProperties = {
  padding: 22,
};

const bodyTextStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "#a0aec0",
  fontSize: 13,
  lineHeight: 1.6,
};

const fileFieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginBottom: 16,
  color: "#e2e8f0",
  fontSize: 13,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#cbd5e0",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 240,
  resize: "vertical",
  borderRadius: 10,
  border: "1px solid #4a5568",
  background: "#1a202c",
  color: "#e2e8f0",
  padding: 14,
  fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  fontSize: 13,
  lineHeight: 1.6,
  outline: "none",
  boxSizing: "border-box",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#3182ce",
  color: "#e2e8f0",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  margin: "0 22px 22px",
  padding: "10px 12px",
  borderRadius: 8,
  background: "rgba(229, 62, 62, 0.12)",
  border: "1px solid rgba(252, 129, 129, 0.4)",
  color: "#fc8181",
  fontSize: 12,
  lineHeight: 1.5,
};
