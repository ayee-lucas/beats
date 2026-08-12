# Tilt configuration for local Kubernetes development.
# Usage: `tilt up` from the repository root.

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

# Ory Kratos is deployed via its upstream Helm chart (see k8s/helm/kratos-values.yaml).
# Run `make helm-repo` once before `tilt up` so the chart is available locally.
k8s_yaml(local('helm template kratos ory/kratos --namespace beats -f k8s/helm/kratos-values.yaml'))

# Ory Hydra is deployed via its upstream Helm chart (see k8s/helm/hydra-values.yaml).
k8s_yaml(local('helm template hydra ory/hydra --namespace beats -f k8s/helm/hydra-values.yaml'))

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
            'postgres',
            'postgres-init-dbs',
            'kratos',
            'hydra',
            'kratos-test-connection',
            'hydra-test-connection',
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
    resource_deps=['namespace'],
)

k8s_resource(
    'postgres-init-dbs',
    labels=['infrastructure'],
    resource_deps=['postgres'],
)

k8s_resource(
    'kratos-automigrate',
    labels=['infrastructure'],
    resource_deps=['namespace', 'postgres', 'postgres-init-dbs'],
)

k8s_resource(
    'hydra-automigrate',
    labels=['infrastructure'],
    resource_deps=['namespace', 'postgres', 'postgres-init-dbs'],
)

k8s_resource(
    'kratos',
    port_forwards=['4433:4433', '4434:4434'],
    labels=['infrastructure'],
    resource_deps=['namespace', 'postgres', 'postgres-init-dbs', 'kratos-automigrate'],
    objects=[
        'kratos:serviceaccount',
        'kratos-cleanup:serviceaccount',
        'kratos-job:serviceaccount',
        'kratos-identity-schema:configmap',
        'kratos-config:configmap',
        'kratos-migrate:configmap',
        'kratos:secret',
    ],
)

k8s_resource(
    'hydra',
    port_forwards=['4444:4444', '4445:4445'],
    labels=['infrastructure'],
    resource_deps=['namespace', 'postgres', 'postgres-init-dbs', 'hydra-automigrate'],
    objects=[
        'hydra:serviceaccount',
        'hydra-cronjob-janitor:serviceaccount',
        'hydra-job:serviceaccount',
        'hydra:configmap',
        'hydra-migrate:configmap',
        'hydra:secret',
    ],
)

# Auto-created resources for Helm chart sub-components. Keep them grouped with
# the main infrastructure resources. Migrations run first, then the main
# deployments, then the courier/statefulset, and finally Helm test pods.
k8s_resource(
    'kratos-courier',
    labels=['infrastructure'],
    resource_deps=['kratos'],
)

k8s_resource(
    'kratos-test-connection',
    labels=['infrastructure'],
    resource_deps=['kratos'],
)

k8s_resource(
    'hydra-test-connection',
    labels=['infrastructure'],
    resource_deps=['hydra'],
)

k8s_resource(
    objects=['beats:namespace'],
    new_name='namespace',
    labels=['infrastructure'],
)
