import { useState } from "react";
import { HEADER_STRINGS } from "../constants/ui";

// Inline SVG icons — avoids adding react-icons / @ant-design/icons as deps

function GithubIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      width="1em"
      height="1em"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.113.793-.258.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function DiscordIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      width="1em"
      height="1em"
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

type HoveredItem = null | "home" | "github" | "discord";

export function Header() {
  const [hovered, setHovered] = useState<HoveredItem>(null);

  const itemClasses = (key: HoveredItem) =>
    [
      "h-16 flex items-center justify-center px-4 border-l border-white border-opacity-10 cursor-pointer transition-colors",
      hovered === key ? "bg-white bg-opacity-10" : "bg-transparent",
    ].join(" ");

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center shrink-0 px-4 sm:px-6"
      style={{ backgroundColor: "#1b2540" }}
    >
      {/* Logo + app name */}
      <a
        href="/"
        className={[
          "flex items-center gap-2 h-16 pr-4",
          hovered === "home" ? "opacity-90" : "opacity-100",
        ].join(" ")}
        onMouseEnter={() => setHovered("home")}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Wide logo on md+, icon-only on small */}
        <img
          src="/logo.png"
          alt={HEADER_STRINGS.logoAlt}
          className="hidden md:block h-6 max-w-[184px] object-contain"
        />
        <img
          src="/accord_logo.png"
          alt={HEADER_STRINGS.logoAlt}
          className="block md:hidden h-6 w-auto object-contain"
        />
        <span className="hidden lg:block text-white text-sm font-medium">
          {HEADER_STRINGS.appName}
        </span>
      </a>

      {/* Right-side links */}
      <div className="ml-auto flex items-center h-16">
        <a
          href="https://discord.com/invite/Zm99SKhhtA"
          target="_blank"
          rel="noopener noreferrer"
          className={itemClasses("discord") + " text-white no-underline"}
          onMouseEnter={() => setHovered("discord")}
          onMouseLeave={() => setHovered(null)}
          title={HEADER_STRINGS.discordTitle}
        >
          <DiscordIcon className="text-xl mr-0 sm:mr-1.5" />
          <span className="hidden sm:inline text-sm">{HEADER_STRINGS.discord}</span>
        </a>

        <a
          href="https://github.com/accordproject/concerto-playground"
          target="_blank"
          rel="noopener noreferrer"
          className={itemClasses("github") + " text-white no-underline"}
          onMouseEnter={() => setHovered("github")}
          onMouseLeave={() => setHovered(null)}
          title={HEADER_STRINGS.githubTitle}
        >
          <GithubIcon className="text-xl mr-0 sm:mr-1.5" />
          <span className="hidden sm:inline text-sm">{HEADER_STRINGS.github}</span>
        </a>
      </div>
    </header>
  );
}
