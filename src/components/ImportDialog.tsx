import { useEffect, useRef, useState } from "react";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFiles: (files: FileList) => Promise<void>;
  onImportText: (source: string) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function ImportDialog({
  isOpen,
  onClose,
  onImportFiles,
  onImportText,
}: ImportDialogProps) {
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      sourceRef.current?.focus();
      return () => returnFocusRef.current?.focus();
    } else {
      setSource("");
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

  async function handleTextImport() {
    setError(null);
    setIsSubmitting(true);
    try {
      await onImportText(source);
    } catch (importError) {
      setError(getErrorMessage(importError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), textarea:not([disabled])",
    );
    if (!controls?.length) return;

    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-model-title"
      style={overlayStyle}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div ref={dialogRef} style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 id="import-model-title" style={titleStyle}>Import Model</h2>
            <p style={subtitleStyle}>
              Paste or choose CTO, Concerto JSON AST, JSON Schema, or a JSON sample.
            </p>
          </div>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close import dialog">
            ×
          </button>
        </div>

        <div style={panelStyle}>
          <label htmlFor="import-source" style={fieldLabelStyle}>Model input</label>
          <textarea
            ref={sourceRef}
            id="import-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={'namespace org.example@1.0.0\n\nconcept Example {\n  o String name\n}'}
            spellCheck={false}
            style={textAreaStyle}
          />
          <div style={footerStyle}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ ...buttonStyle, background: "#4a5568" }}
              disabled={isSubmitting}
            >
              Choose files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".cto,.json,application/json"
              multiple
              onChange={handleFileChange}
              disabled={isSubmitting}
              data-testid="model-file-input"
              style={hiddenFileInputStyle}
            />
            <button type="button" onClick={handleTextImport} style={buttonStyle} disabled={isSubmitting}>
              Import
            </button>
          </div>
        </div>

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

const panelStyle: React.CSSProperties = {
  padding: 22,
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
  boxSizing: "border-box",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 14,
};

const buttonStyle: React.CSSProperties = {
  background: "#3182ce",
  color: "#e2e8f0",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const hiddenFileInputStyle: React.CSSProperties = {
  display: "none",
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
  whiteSpace: "pre-wrap",
};
