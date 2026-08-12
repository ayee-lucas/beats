# ZITADEL

[ZITADEL](https://zitadel.com/) provides identity and access management for
the beats stack, replacing the previous Ory Kratos and Hydra deployment. It
runs in the local Kubernetes cluster alongside the existing services.

## Local setup

ZITADEL is deployed through the official [ZITADEL Helm
chart](https://github.com/zitadel/zitadel-charts) using values in
[`k8s/helm/zitadel-values.yaml`](../k8s/helm/zitadel-values.yaml).

1. Add the ZITADEL Helm repository (one-time):

   ```sh
   make helm-repo
   ```

2. Start the local environment:

   ```sh
   make tilt
   ```

   ZITADEL will be available after Postgres, the database init job, and the
   ZITADEL init/setup jobs finish.

## Ports

Tilt forwards the following port from the `zitadel` service:

- **Console / REST / gRPC / OIDC**: `localhost:8082`

## Database

ZITADEL reuses the shared Postgres instance deployed by `k8s/base/postgres`. The
chart is pointed at the Postgres maintenance database
(`postgres://postgres:postgres@postgres:5432/postgres`) and ZITADEL creates its
own database during initialization.

The `postgres-init-dbs` job only creates databases for the application
services (`library` and `profile`).

## Configuration

- Values file: [`k8s/helm/zitadel-values.yaml`](../k8s/helm/zitadel-values.yaml)
- The separate Next.js Login UI is disabled; ZITADEL uses its built-in login
  UI.
- Auto-initialization is enabled and creates a human admin user.

## Initial admin user

The local values file bootstrap an admin user for the first ZITADEL instance:

- **Username**: `admin`
- **Email**: `admin@localhost`
- **Password**: `Password1!`

Log in at `http://localhost:8082/ui/console`.

## Security note

The values file contains a fixed masterkey, plaintext database credentials, and
a weak admin password for local development only. Do not use these values in
production.
