# Concerto Playground

Live browser playground for [Concerto](https://concerto.accordproject.org) — the schema definition language from Accord Project. Write one `.cto` schema and see generated output across a dozen target languages instantly.

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
