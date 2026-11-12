# Security

Please don't report security problems in public issues.

Use GitHub's **private vulnerability reporting** (the *Security* tab → *Report a vulnerability*) on this repository. Include what you found, how to reproduce it, and what an attacker could do with it. We'll reply as soon as we can and credit you in the fix unless you'd rather stay anonymous.

Areas we care about most:

- **API keys**: they're encrypted with the OS keychain and must never reach the panel (renderer), logs or anyone but the chosen provider.
- **The REAPER bridge**: a file-based channel between Assist and REAPER. Commands are validated on both sides; nothing may run arbitrary code, delete media or touch files outside REAPER's own folders.
- **The local tool server** used by the CLI providers: loopback only, protected by a per-launch token.
- **Web access**: `readWebPage` (`src/ai/web.ts`) must only reach public https addresses (no private, local or redirected-to-private hosts), and page text must never be able to make the AI act or leak chat details.
- **Images and chat files**: decoded and re-encoded before they're stored or sent.
