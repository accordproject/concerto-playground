export function Header() {
  return (
    <header className="bg-[#1a1a2e] text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold">
          <span className="text-[#19C6C8]">Concerto</span> Playground
        </span>
        <span className="hidden sm:inline text-xs text-gray-400 border border-gray-600 rounded px-2 py-0.5">
          Accord Project
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="hidden md:inline text-gray-400 text-xs italic">
          One schema. Seven languages. No boilerplate.
        </span>
        <a
          href="https://concerto.accordproject.org/docs/intro"
          className="text-gray-400 hover:text-[#19C6C8] transition-colors text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </a>
        <a
          href="https://github.com/accordproject/concerto"
          className="text-gray-400 hover:text-[#19C6C8] transition-colors text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
