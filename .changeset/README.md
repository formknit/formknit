# Releasing

Every change that users will notice needs a changeset:

```bash
pnpm changeset          # describe the change and pick patch, minor or major
```

To release:

```bash
pnpm changeset version  # bumps versions and writes the changelogs
pnpm release            # builds and publishes to npm (needs `npm login` first)
```

All packages share one version number, so they are always compatible with each other.
