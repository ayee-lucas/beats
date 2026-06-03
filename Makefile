# Generate Protobuf / gRPC Rust code (see buf.yaml, buf.gen.yaml).
# Requires buf: https://buf.build/docs/installation

.PHONY: proto help

proto:
	buf generate

help:
	@echo "Targets:"
	@echo "  proto  Generate Rust from proto/ into crates/proto-gen/gen (buf generate)"
