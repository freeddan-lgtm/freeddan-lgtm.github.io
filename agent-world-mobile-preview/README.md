# Agent World · Claude Edition — phone-first preview

Static preview of the phone-responsive CE2 UI. **Not production.**

- **Working preview URL:** https://gitcdn.link/repo/freeddan-lgtm/agent-world-mobile-preview/main/index.html
  (HTML shell; assets load from jsDelivr with correct MIME types)
- Production (untouched): https://ce2-h7w3n9x5kq2m.vercel.app/
- Backend: same live Show Buddies API (`https://show-buddies.vercel.app`, CORS `*`)
- Repo: https://github.com/freeddan-lgtm/agent-world-mobile-preview

Caveat: rawcdn.githack.com currently 403s from some networks; jsDelivr alone serves `index.html` as `text/plain` so it cannot be the document URL. This preview uses gitcdn.link for HTML + jsDelivr for JS/JSON via `<base href>`.

No secrets, no wedge docs, no production deploy.
