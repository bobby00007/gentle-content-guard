# AI Content Guardian

import git repo https://github.com/bobby00007/ai-content-guard

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gentle-content-guard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/be9978c0-c853-461d-a945-1a10e4073a0b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## AI analysis backend

Preset cards are offline demo fixtures. Uploaded text, images, and sampled video
frames require a server-side AI provider; the app will show a configuration error
instead of returning a made-up preset result when the provider is unavailable.

For Netlify, set one of these production environment variables:

- `OPENAI_API_KEY` (optional `OPENAI_MODEL`, default `gpt-4o-mini`)
- `LOVABLE_API_KEY` (optional `LOVABLE_MODEL`, default `openai/gpt-6-astra`)

Never expose either key in a `VITE_*` variable or commit it to the repository.
