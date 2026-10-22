# Preview & Deployment

> Goal: play the prototype on a phone without running a server and without ongoing costs.

## Options compared

| Option | Works with a **private** repo for free? | Account needed | Auto-deploy on push | Notes |
|---|---|---|---|---|
| GitHub Pages | ❌ Private repos need a paid GitHub plan | — | Yes | Would be the simplest if the repo were public |
| **Vercel (Hobby)** 💡 | ✅ | Vercel account (sign in with GitHub) | ✅ + a preview URL per branch/PR | Zero config for Vite. Hobby plan is free for non-commercial use. |
| Netlify (Free) | ✅ | Netlify account (sign in with GitHub) | ✅ + deploy previews | Equally good. 300 build minutes/month on the free plan. |
| Cloudflare Pages | ✅ | Cloudflare account | ✅ | Also fine |

**Recommendation: Vercel.** It needs no config files in the repo: Vite is auto-detected, the build command is `npm run build`, and the output is `dist/`. Every push to any branch gets its own preview URL, which suits "test this branch on my phone".

## One-time setup (owner, ~5 minutes, on phone or desktop)

1. Go to **vercel.com** and choose **Sign Up → Continue with GitHub**. Pick the free **Hobby** plan.
2. When Vercel asks for GitHub access, choose **Only select repositories** and pick `Ryngmarks/Idle-RPG-`.
3. **Add New → Project → Import** `Idle-RPG-`. Keep the detected settings (Framework: *Vite*, Build: `npm run build`, Output: `dist`). Press **Deploy**.
4. Vercel builds `master` as production. Every other branch, such as `m3-playable-ui`, gets its own **preview URL**. The URLs are shown in the Vercel dashboard and as a comment/check on each PR.
5. Optional: open the URL on the phone and choose **Add to Home Screen** for a full-screen app feel.

No secrets, servers or payment details are needed. Saves live in the phone browser's `localStorage`. Use **Meny → Exportera** to back up a save.

## What the build needs

```
npm ci            # .npmrc sets legacy-peer-deps=true (npm 10.9 workaround)
npm run build     # typecheck + vite build → dist/
```

The build uses relative asset paths (`base: './'`), so the same `dist/` also works on GitHub Pages or any static host.
