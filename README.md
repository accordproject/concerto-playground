<p align="center">
  <a href="https://concerto-playground.accordproject.org">
    <img src="public/logo.png" alt="Concerto Playground" width="120" />
  </a>
</p>

<h1 align="center">Concerto Playground</h1>

<p align="center">
  Live browser playground for <a href="https://concerto.accordproject.org">Concerto</a> —
  the schema definition language from Accord Project.
  <br />
  Write one <code>.cto</code> schema, see generated output across a dozen target languages instantly.
</p>

<p align="center">
  <a href="https://concerto-playground.accordproject.org"><strong>Open the playground »</strong></a>
</p>

<p align="center">
  <a href="https://github.com/accordproject/strategy-plays/actions/workflows/test.yml"><img src="https://github.com/accordproject/strategy-plays/actions/workflows/test.yml/badge.svg" alt="Tests" /></a>
  <a href="https://github.com/accordproject/strategy-plays/actions/workflows/e2e.yml"><img src="https://github.com/accordproject/strategy-plays/actions/workflows/e2e.yml/badge.svg" alt="E2E" /></a>
  <a href="https://github.com/accordproject/strategy-plays/actions/workflows/build-and-publish.yml"><img src="https://github.com/accordproject/strategy-plays/actions/workflows/build-and-publish.yml/badge.svg" alt="Build and Publish" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/accordproject/strategy-plays?color=bright-green" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@accordproject/concerto-core"><img src="https://img.shields.io/npm/v/@accordproject/concerto-core?label=concerto-core" alt="concerto-core version" /></a>
  <a href="https://www.npmjs.com/package/@accordproject/concerto-codegen"><img src="https://img.shields.io/npm/v/@accordproject/concerto-codegen?label=concerto-codegen" alt="concerto-codegen version" /></a>
  <a href="https://discord.gg/Zm99SKhhtA"><img src="https://img.shields.io/badge/Accord%20Project-Join%20Discord-blue" alt="Join the Accord Project Discord" /></a>
</p>

<p align="center">
  <a href="https://concerto-playground.accordproject.org">
    <img src="docs/screenshot.png" alt="Concerto Playground screenshot" width="900" />
  </a>
</p>

---

## What is Concerto?

Concerto is an object-oriented schema language developed by the [Accord Project](https://accordproject.org) (Linux Foundation, Apache-2.0). One `.cto` file compiles to multiple language targets:

- TypeScript interfaces
- JSON Schema (draft-07)
- Java POJOs
- Go structs
- C# classes
- Rust structs
- GraphQL schema
- Protobuf
- Avro schema
- OpenAPI component schemas
- OData CSDL
- XML Schema (XSD)

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy

### Vercel
```bash
npm run build
vercel deploy dist/
```

### Cloudflare Pages
```bash
npm run build
# Upload the dist/ directory to a Cloudflare Pages project
```

Target URL: `https://concerto-playground.accordproject.org`

## How it works

1. The Monaco editor on the left accepts one or more Concerto `.cto` schemas (one per namespace tab)
2. On change (debounced 500ms), the generator runs `@accordproject/concerto-codegen` in the browser
3. If live generation fails (e.g., unresolved external model imports), it falls back to pre-generated static output for the sample model — so the playground always shows meaningful content
4. Tabs on the right switch between output languages; a Copy button copies the current output
5. Three view modes — **Graph** (class diagram), **Code** (raw CTO + generated output), and **Form** (point-and-click editor)
6. The "Share URL" button encodes all open namespaces in the URL using LZ-string compression

## Shareable URLs

The URL hash contains the lz-string-compressed model. Paste a Concerto schema, click "Share URL", and the link opens the playground with that schema pre-loaded. Multi-namespace models are encoded as a JSON array in the hash.

## Testing

```bash
npm run test          # unit tests (Vitest)
npm run test:e2e      # end-to-end tests (Playwright, Chromium)
npm run test:e2e:ui   # Playwright UI mode
```

## Links

- [Accord Project](https://accordproject.org)
- [Concerto Documentation](https://concerto.accordproject.org/docs/intro)
- [concerto GitHub](https://github.com/accordproject/concerto)
- [concerto-codegen GitHub](https://github.com/accordproject/concerto-codegen)

## License

Apache-2.0 — Linux Foundation project
