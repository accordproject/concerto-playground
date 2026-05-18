# Concerto Playground

Live browser playground for [Concerto](https://concerto.accordproject.org) — the schema definition language from Accord Project. Write one `.cto` schema and see generated TypeScript, JSON Schema, Python (Pydantic), Java, Go, and OpenAPI output instantly.

## What is Concerto?

Concerto is an object-oriented schema language developed by the [Accord Project](https://accordproject.org) (Linux Foundation, Apache-2.0). One `.cto` file compiles to multiple language targets:

- TypeScript interfaces
- JSON Schema (draft-07)
- Python Pydantic models
- Java POJOs
- Go structs
- OpenAPI component schemas

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

1. The Monaco editor on the left accepts a Concerto `.cto` schema
2. On change (debounced 500ms), the generator tries to run `@accordproject/concerto-codegen` in the browser via Vite + Node.js polyfills
3. If live generation fails (e.g., unresolved external model imports), it falls back to pre-generated static output for the sample model — so the playground always shows meaningful content
4. Tabs on the right show the generated output for each target language
5. The "Share URL" button encodes the current schema in the URL using LZ-string compression

## Shareable URLs

The URL hash contains the lz-string-compressed schema. Paste any Concerto schema, click "Share URL", and the link opens the playground with that schema pre-loaded.

## Links

- [Accord Project](https://accordproject.org)
- [Concerto Documentation](https://concerto.accordproject.org/docs/intro)
- [concerto GitHub](https://github.com/accordproject/concerto)
- [concerto-codegen GitHub](https://github.com/accordproject/concerto-codegen)

## License

Apache-2.0 — Linux Foundation project
