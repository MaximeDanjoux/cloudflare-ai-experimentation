# Deploy path

Local auth, then a Workers AI binding, then `wrangler dev`, then `wrangler deploy`.

## Login

Run `wrangler login` on the machine that will deploy. That OAuth session stays local. Do not commit a token, `.dev.vars`, or `.env`.

## Binding

`wrangler.toml` binds Workers AI:

```toml
[ai]
binding = "AI"
```

The Worker reads it as `env.AI`. Both model calls use Workers AI Llama 3.3:

`@cf/meta/llama-3.3-70b-instruct-fp8-fast`

That is the integrity JSON pass and the risk-summary reply. Do not point either call at another provider in v1.

The same file also binds the Workflow and the session Durable Object. Those bindings are required for v1. They do not replace the `[ai]` block.

## Iterate

Run `wrangler dev` for the Worker. Use the local URL for `POST /session/:id/message` and `POST /session/:id/clear`.

Run the Pages UI with `wrangler pages dev` while changing the chat. The page talks to the Worker. It does not call Workers AI on its own.

## Ship

Deploy the Worker with `wrangler deploy`.

Deploy the Pages project with `wrangler pages deploy`.

Voice is not part of this path. See [v1-ship-scope.md](./v1-ship-scope.md).
