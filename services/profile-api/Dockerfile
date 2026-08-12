# Multi-stage build for the profile-api service.
# Build context must be the workspace root so the proto-gen crate is available.

FROM rust:1.94-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json

# Cook dependencies separately to leverage Docker layer caching.
# profile-api and profile-migration are the workspace members we need binaries for.
RUN cargo chef cook --release --recipe-path recipe.json

COPY . .
RUN cargo build --release -p profile-api -p profile-migration

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/profile-server /usr/local/bin/profile-server
COPY --from=builder /app/target/release/profile-migration /usr/local/bin/profile-migration
COPY --from=builder /app/services/profile-api/config ./config

EXPOSE 8080

CMD ["profile-server"]
