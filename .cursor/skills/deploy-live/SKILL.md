---
name: deploy-live
description: >-
  Builds, deploys all Firebase services to production, commits changes, and
  pushes to GitHub for the philtax project. Use when the user asks to deploy
  to live, ship to production, push to GitHub and deploy, release changes, or
  go live.
---

# Deploy Live (philtax)

End-to-end release workflow: validate → commit → push GitHub → deploy Firebase.

## Project constants

| Item | Value |
|------|-------|
| Firebase project | `philtax` |
| Live URLs | `https://philtax.web.app`, `https://philtax.firebaseapp.com` |
| Git branch | `main` (tracks `origin/main`) |
| Git remote | `origin` → `https://github.com/JCBilbao03/taxphil.git` |
| Deploy command | `npm run deploy` (build + full Firebase deploy) |

Firebase deploy targets (from `firebase.json`): **Hosting**, **Cloud Functions**, **Realtime Database rules**, **Firestore rules/indexes**, **Auth** config.

## Safety rules (mandatory)

- **Never** `git push --force` to `main`.
- **Never** skip hooks (`--no-verify`, `--no-gpg-sign`).
- **Never** commit `.env`, credentials, or secret files — warn the user if requested.
- **Never** update git config.
- If build, typecheck, or deploy fails → **stop**. Fix the issue; do not push broken code.
- If there are no changes to commit and nothing to deploy, report that and stop.

## Workflow

Copy this checklist and track progress:

```
Deploy progress:
- [ ] Step 1: Pre-flight checks
- [ ] Step 2: Commit changes
- [ ] Step 3: Push to GitHub
- [ ] Step 4: Deploy to Firebase
- [ ] Step 5: Verify and report
```

### Step 1: Pre-flight checks

Run in parallel:

```powershell
git status
git diff --stat
git log -3 --oneline
```

Then run sequentially:

```powershell
npx tsc --noEmit
npm run lint
```

If typecheck or lint fails, fix errors before continuing.

Review `git diff` for accidental secrets or debug code before committing.

### Step 2: Commit changes

Only commit when the user invoked this deploy skill (explicit release intent).

1. Stage relevant files (`git add` changed/untracked project files).
2. **Do not** stage `.env`, `*.local`, or credential files.
3. Draft a concise commit message from the diff (1–2 sentences, focus on *why*).

Commit (PowerShell here-string):

```powershell
git commit -m @"
Your commit message here.

"@
```

If commit fails due to a pre-commit hook, fix the issue and create a **new** commit — do not amend unless the user explicitly requested amend and the prior commit was unpushed.

### Step 3: Push to GitHub

```powershell
git push origin main
```

If push is rejected (remote ahead), pull with rebase first:

```powershell
git pull --rebase origin main
git push origin main
```

Do not force-push. If rebase conflicts occur, stop and ask the user.

### Step 4: Deploy to Firebase

```powershell
npm run deploy
```

This runs `tsc -b`, `vite build`, then:

```powershell
npx -y firebase-tools@latest deploy --project philtax
```

If deploy fails (auth, billing, rules validation):

1. Read the error output.
2. Fix the root cause if possible (e.g. rules syntax, functions build).
3. Commit the fix, push, and retry deploy.

For Firestore rules changes, remind the user that prototype rules should be reviewed before broad production use.

### Step 5: Verify and report

After successful deploy, report to the user:

1. **Commit** — hash and message
2. **GitHub** — branch and remote pushed
3. **Firebase** — services deployed (hosting, functions, database, firestore, auth)
4. **Live URL** — `https://philtax.web.app`

Optionally spot-check the live site or run a quick smoke test on critical paths (landing, login, dashboard).

## Common failures

| Error | Action |
|-------|--------|
| `Firebase login required` | Run `npx -y firebase-tools@latest login` and retry |
| `Permission denied` on Firestore/RTDB | Confirm Firebase project `philtax` and IAM access |
| Functions build error | `npm run build` inside `functions/`, fix TS errors |
| Hosting 404 on routes | Confirm SPA rewrite in `firebase.json` |
| Push rejected | `git pull --rebase origin main`, resolve conflicts, push again |

## Partial deploy (only if user asks)

Default is **full deploy**. For targeted deploys only when explicitly requested:

```powershell
npx -y firebase-tools@latest deploy --only hosting --project philtax
npx -y firebase-tools@latest deploy --only functions --project philtax
npx -y firebase-tools@latest deploy --only firestore --project philtax
npx -y firebase-tools@latest deploy --only database --project philtax
```

Always still push to GitHub unless the user says deploy-only with no push.
