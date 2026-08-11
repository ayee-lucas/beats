# Tilt configuration for local Kubernetes development.
# Usage: `tilt up` from the repository root.

# ------------------------------------------------------------------------------
# Services
# ------------------------------------------------------------------------------
# Add new services here as they are onboarded. Each service is expected to own
# its base Kubernetes manifests under services/<name>/k8s/ and be referenced by
# the local Kustomize overlay in k8s/overlays/local/kustomization.yaml.
services = ['library-api']

# Local port-forward mapping per service. Use distinct host ports when adding
# additional services.
service_ports = {
    'library-api': '8080:8080',
}

# Supporting objects to group under each service resource in Tilt.
service_objects = {
    'library-api': [
        'library-api-config:configmap',
        'library-api-secret:secret',
    ],
}

# ------------------------------------------------------------------------------
# Deploy the local environment
# ------------------------------------------------------------------------------
# The local overlay composes shared cluster resources (namespace, etc.) and all
# service bases. Per-environment patches (replicas, resources, secrets) live in
# the overlay itself.
k8s_yaml(kustomize('k8s/overlays/local'))

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
            'services/{}/'.format(svc),
        ],
        ignore=[
            'services/{}/target'.format(svc),
            'target',
        ],
    )

    k8s_resource(
        svc,
        port_forwards=service_ports[svc],
        labels=[svc],
        resource_deps=['postgres'],
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
    objects=['beats:namespace'],
    new_name='namespace',
    labels=['infrastructure'],
)
