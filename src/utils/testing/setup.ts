import { vi } from "vitest";

vi.mock("monaco-editor", () => ({
  editor: {
    create: vi.fn(),
    defineTheme: vi.fn(),
  },
  Range: vi.fn(),
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
  },
}));
