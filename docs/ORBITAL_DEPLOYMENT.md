# Repository and deployment ownership

The authorized repository is `jiangjinzhou01-ctrl/expert-disco`. Its Pages configuration is branch-based (`main`, root). The available integration cannot change repository administration settings. Uploading an Actions artifact alone does not change that setting; publishing source `index.html` would expose `/src/main.tsx` and recreate a blank page.

Reviewed source, assets, tests and evidence live on `threshold-v02`. `main` retains normal Git history and receives compiled production files only. No forced push or repository replacement is used.

After completing tests and committing source/evidence:

```sh
git push origin HEAD:threshold-v02
npm run deploy:pages
```

The deployment script is intentionally scoped to this authorized origin. It requires a clean source tree, builds `dist`, creates a temporary detached worktree from current `origin/main`, commits the static output and `.nojekyll`, and performs a normal push. A concurrent remote update causes rejection rather than being overwritten. `DEPLOYMENT.json` in the published site identifies the source commit.

Then wait for the repository's actual `pages-build-deployment` workflow and verify the live site in a fresh browser. Validate WebGL2, chapter readiness, critical resources and the absence of the development mutation adapter. A successful Git push alone is not evidence that the website works.

To roll back, use the last known static deployment commit as the content of a new commit on `main`; preserve history. The source branch remains available regardless of the published version.
