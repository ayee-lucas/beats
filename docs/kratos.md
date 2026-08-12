# Ory Kratos

[Ory Kratos](https://www.ory.sh/kratos/) provides identity and user management
for the beats stack. It runs in the local Kubernetes cluster alongside the
existing services.

## Local setup

Kratos is deployed through the official [Ory Helm chart](https://github.com/ory/k8s/blob/master/docs/helm/kratos.md)
using values in [`k8s/helm/kratos-values.yaml`](../k8s/helm/kratos-values.yaml).

1. Add the Ory Helm repository (one-time):

   ```sh
   make helm-repo
   ```

2. Start the local environment:

   ```sh
   make tilt
   ```

   Kratos will be available after Postgres and the database init job finish.

## Ports

Tilt forwards the following ports from the `kratos` pod:

- **Public API**: `localhost:4433`
- **Admin API**: `localhost:4434`

## Database

Kratos reuses the shared Postgres instance deployed by `k8s/base/postgres`. The
`postgres-init-dbs` job creates a `kratos` database alongside `library` and
`profile`.

## Configuration

- Values file: [`k8s/helm/kratos-values.yaml`](../k8s/helm/kratos-values.yaml)
- Identity schema ConfigMap: [`k8s/base/kratos`](../k8s/base/kratos)
- Identity schema: email + password with email as the identifier
- Auto-migration is enabled
- Development mode is enabled

## Email flows

Verification and recovery emails are **disabled** in local development. The
courier is configured with a dummy SMTP URI so Kratos can start without a real
mail server. To enable email flows, provide a real SMTP connection URI in the
values file and add the `verification` and `recovery` self-service flows.

## Security note

The values file contains hard-coded secrets for local development only. Do not
use these values in production.
