# Testing Rules

## Structure
- **One test file per feature area.** Split by domain (logged-out, next, trending, ai-suggestions, settings), not by "logged in" vs "logged out".
- **Server lifecycle outside tests.** `const server = setupServer()` + `before`/`after` at describe-level. Never call `server.listen()` or `server.close()` inside a test. Use `server.use()` inside tests for handlers.
- **`onUnhandledRequest: "error"`** always. No `"bypass"`.

## MSW Handlers
- **Handler helpers live in `test/clients/`.** Each API gets its own file (`simkl.js`, `gemini.js`, `openai.js`, `claude.js`). Tests import and call them.
- **Handler functions are named by their action** (e.g. `completeChat`, `syncShows`), not by provider name. The file name already identifies the provider.
- **Handler functions receive only what varies** (response data, expected IDs) and hardcode the rest (URL, response wrapping).
- **Assert inside MSW handlers** that the app sends correct headers, query params, and request bodies. Don't just return data — verify the request is well-formed.
- **Only include handlers that are actually consumed.** Don't add handlers for endpoints the test doesn't hit. `onUnhandledRequest: "error"` catches missing ones.
- **Minimal arrange.** Every `setup*` call and fixture field must be reached by the code path the test exercises. No preemptive stubs, no "just in case" fields, no extras carried over from copy-paste. If it's not needed, delete it.

## Queries & Assertions
- **Use `findBy*` / `getBy*` from Testing Library**, not a custom `waitFor`. That's what `findBy*` exists for.
- **No custom timeouts.** Don't pass `{ timeout: ... }` to queries.
- **Prefer `*ByRole`** over `*ByText` when the element has an accessible role (buttons, images, headings, links).
- **No `assert.ok(getBy*(...))`.** `getBy*` already throws if not found — just call it.

## Test Isolation
- **No shared/global variables in tests.** Each test must be self-contained. Only describe-level: server lifecycle. Only file-level: imports.
- **No shared test data constants.** Inline data in each test or pass it to handler helpers.
- **Parameterize with `for` loops** over inline arrays (Node test runner has no `it.each`). No `if` branches inside tests.
- **Happy path first.** Order tests with success cases before error/edge cases.
