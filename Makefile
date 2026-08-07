# Protobuf / Connect codegen (see buf.yaml, buf.gen.yaml).
# Requires: buf (https://buf.build/docs/installation) and local plugins on PATH.
#
# Plugin versions (keep aligned with Cargo buffa / connectrpc 0.8.x):
#   protoc-gen-buffa              0.8.1
#   protoc-gen-buffa-packaging    0.4.0
#   protoc-gen-connect-rust       0.8.0  (cargo install --locked connectrpc-codegen)
# Runtime crates: buffa / buffa-types / connectrpc 0.8.1
#
# After changing .proto files: `make proto`, commit crates/proto-gen/gen/, rebuild.

.PHONY: proto help

proto:
	buf generate

help:
	@echo "Targets:"
	@echo "  proto  Generate Rust from proto/ into crates/proto-gen/gen (buffa + connect-rust)"
	@echo ""
	@echo "Plugins (PATH): protoc-gen-buffa 0.8.1, protoc-gen-buffa-packaging 0.4.0,"
	@echo "                protoc-gen-connect-rust 0.8.0 — match connectrpc/buffa 0.8.x crates"
