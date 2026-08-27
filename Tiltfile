# Tilt configuration for local Kubernetes development.
# Usage: `tilt up` from the repository root.

load('ext://helm_resource', 'helm_resource', 'helm_repo')

# Ensure the kind cluster and its local image registry are reconciled before
# service images are built and deployed.
local_resource(
    'local-cluster',
    'sh scripts/dev/ensure-local-cluster.sh',
    labels=['infrastructure'],
)

# ------------------------------------------------------------------------------
# Services
# ------------------------------------------------------------------------------
# Add new services here as they are onboarded. Each service is expected to own
# its base Kubernetes manifests under services/<name>/k8s/ and be referenced by
# the local Kustomize overlay in k8s/overlays/local/kustomization.yaml.
services = ['library-api', 'profile-api']

# Local port-forward mapping per service. Use distinct host ports when adding
# additional services.
service_ports = {
    'library-api': '8080:8080',
    'profile-api': '8081:8080',
}

# Supporting objects to group under each service resource in Tilt.
service_objects = {
    'library-api': [
        'library-api-config:configmap',
        'library-api-secret:secret',
    ],
    'profile-api': [
        'profile-api-config:configmap',
        'profile-api-secret:secret',
    ],
}

# ------------------------------------------------------------------------------
# Deploy the local environment
# ------------------------------------------------------------------------------
# Create the namespace first so Helm-rendered charts have a target namespace.
k8s_yaml('k8s/base/namespace/namespace.yaml')

# The local overlay composes shared cluster resources and all service bases.
# Per-environment patches (replicas, resources, secrets) live in the overlay.
k8s_yaml(kustomize('k8s/overlays/local'))

# Register the ZITADEL Helm repository. The resource is referenced as
# `zitadel-helm-repo` so it does not collide with the release resource below.
helm_repo('zitadel-helm-repo', 'https://charts.zitadel.com', labels=['infrastructure'])

# ZITADEL is deployed via its upstream Helm chart (see k8s/helm/zitadel-values.yaml).
# The helm_resource extension handles chart hooks (init/setup jobs) correctly.
helm_resource(
    'zitadel',
    'zitadel/zitadel',
    release_name='zitadel',
    namespace='beats',
    flags=['--values=k8s/helm/zitadel-values.yaml'],
    resource_deps=[
        'local-cluster',
        'zitadel-helm-repo',
        'namespace',
        'postgres',
        'postgres-init-dbs',
    ],
    labels=['infrastructure'],
    port_forwards=['8082:8080'],
)

# ------------------------------------------------------------------------------
# Per-service Docker builds
# ------------------------------------------------------------------------------
for svc in services:
    docker_build(
        svc,
        '.',
        dockerfile='services/{}/Dockerfile'.format(svc),
        only=[
            'Cargo.toml',
            'Cargo.lock',
            'crates/',
            # All workspace members must be present for cargo to load the
            # virtual workspace, even when building a single service.
            'services/',
        ],
        ignore=[
            'services/{}/target'.format(svc),
            'target',
        ],
    )

    k8s_resource(
        svc,
        port_forwards=service_ports[svc],
        labels=['services'],
        resource_deps=[
            'local-cluster',
            'postgres',
            'postgres-init-dbs',
            'zitadel',
        ],
        objects=service_objects.get(svc, []),
    )

# Local infrastructure dependencies.
k8s_resource(
    'postgres',
    objects=[
        'postgres-data:persistentvolumeclaim',
        'postgres-config:configmap',
        'postgres-secret:secret',
    ],
    port_forwards='5432:5432',
    labels=['infrastructure'],
    resource_deps=['local-cluster', 'namespace'],
)

k8s_resource(
    'postgres-init-dbs',
    labels=['infrastructure'],
    resource_deps=['local-cluster', 'postgres'],
)


k8s_resource(
    objects=['beats:namespace'],
    new_name='namespace',
    labels=['infrastructure'],
    resource_deps=['local-cluster'],
)
