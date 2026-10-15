# Releasing

Every change that users will notice needs a changeset:

```bash
pnpm changeset          # describe the change and pick patch, minor or major
```

Releases are made by GitHub: when changesets reach `main`, the Release workflow opens a
"Version packages" pull request, and merging it publishes to npm. No npm token is involved; each
package trusts `.github/workflows/release.yml` in `formknit/formknit` (npm trusted publishing).

A package added later must be published once by hand (`npm login`, then `pnpm release`) before
its trusted publisher can be set on npmjs.com.

All packages share one version number, so they are always compatible with each other.
