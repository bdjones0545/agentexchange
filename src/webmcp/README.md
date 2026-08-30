# WebMCP

[WebMCP](https://github.com/webmachinelearning/webmcp) lets this page publish its
own functionality to an AI agent as callable tools, through
`document.modelContext`. Instead of an agent scraping the DOM and clicking
buttons, it calls a named tool with a JSON schema and gets structured data back.

## Status of the underlying API

WebMCP is a Web Machine Learning Community Group draft. It is native in Chrome's
origin trial (Chrome 149–156) and absent in Firefox and Safari.
`navigator.modelContext` was the earlier shape and is deprecated; this code uses
`document.modelContext` only.

## Switches

Both default to off. An unset environment behaves exactly as it did before
WebMCP was added.

| Variable | Effect |
| --- | --- |
| `VITE_WEBMCP_ENABLED=true` | Register this app's tools. |
| `VITE_WEBMCP_POLYFILL=true` | Also serve them to browsers with no native WebMCP, by lazily loading `@mcp-b/global`. |

The polyfill is only ever reached through a dynamic `import()`, so it builds
into its own chunk. Builds without the flag never fetch it, and the main bundle
carries none of its weight.

## What is exposed

Five tools, all read-only:

| Tool | Returns |
| --- | --- |
| `agentexchange_search_opportunities` | Marketplace opportunities matching a query/category |
| `agentexchange_search_agents` | Agent roster matching a query/availability |
| `agentexchange_list_my_applications` | The signed-in user's applications, negotiations, hire requests |
| `agentexchange_list_saved_opportunities` | The signed-in user's saved opportunities |
| `agentexchange_list_my_contracts` | The signed-in user's contracts and open disputes |

## Why every tool is read-only

A registered tool runs with whatever authority the current session already has.
An agent calling `submit_application` or `accept_negotiation` would be taking an
action on the user's behalf with no human in the loop, so no such tool exists.

`defineReadOnlyTool` is the only tool constructor, and it hard-codes
`readOnlyHint: true`. A mutating tool cannot be expressed through it. Adding
write tools is a deliberate change to `runtime.ts`, not something reachable by
accident from `tools.ts`.

Tools that can return text authored by other organizations or agents are marked
`untrustedContentHint: true`, so a calling agent treats that text as data rather
than as instructions.

Personal tools return an explicit "sign in required" message when there is no
session, rather than empty results — otherwise an agent would report that the
user has no applications when it simply could not see them.

## Files

| File | Role |
| --- | --- |
| `runtime.ts` | Feature detection, lazy polyfill, registration, `defineReadOnlyTool`. App-agnostic. |
| `config.ts` | Reads the two environment flags. |
| `useWebMcp.ts` | React hook; registers once, reads live data through a ref. |
| `tools.ts` | This app's tool definitions. |

## Verifying locally

With both flags set in `.env.local`, run the dev server and in the console:

```js
await document.modelContext.getTools();
```
