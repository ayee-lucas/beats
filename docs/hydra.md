# Ory Hydra

[Ory Hydra](https://www.ory.sh/hydra/) provides OAuth2 and OpenID Connect
server capabilities for the beats stack. It runs in the local Kubernetes
cluster alongside the existing services.

## Local setup

Hydra is deployed through the official [Ory Helm chart](https://github.com/ory/k8s/blob/master/docs/helm/hydra.md)
using values in [`k8s/helm/hydra-values.yaml`](../k8s/helm/hydra-values.yaml).

1. Add the Ory Helm repository (one-time):

   ```sh
   make helm-repo
   ```

2. Start the local environment:

   ```sh
   make tilt
   ```

   Hydra will be available after Postgres and the database init job finish.

## Ports

Tilt forwards the following ports from the `hydra` pod:

- **Public OAuth2 / OIDC**: `localhost:4444`
- **Admin**: `localhost:4445`

## Database

Hydra reuses the shared Postgres instance deployed by `k8s/base/postgres`. The
`postgres-init-dbs` job creates a `hydra` database alongside `library`,
`profile`, and `kratos`.

## Configuration

- Values file: [`k8s/helm/hydra-values.yaml`](../k8s/helm/hydra-values.yaml)
- Auto-migration is enabled
- Dev mode is enabled to allow plain HTTP locally
- Hydra Maester is disabled for the initial local stack

## Login / consent / logout

The values file uses placeholder URLs (`http://localhost:4455/...`) for the
login, consent, and logout endpoints. A real login/consent app is not wired up
locally yet; OAuth2 authorization-code flows will not complete until those
endpoints are implemented.

## Security note

The values file contains hard-coded secrets and enables dev mode for local
development only. Do not use these values in production.
