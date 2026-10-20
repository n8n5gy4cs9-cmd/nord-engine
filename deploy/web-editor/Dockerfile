# Nord Engine editor server — build from the repository root:
#   docker build -f deploy/web-editor/Dockerfile -t nord-editor-server .
# Stage 1 compiles the wasm editor, the server and the `nord` CLI; stage 2 is a small runtime image (Node is there for export
# options that need it: minify, single-file, event-sheet compile). Not verified in CI yet (see docs/KNOWN_ISSUES.md).
FROM rust:1-bookworm AS build
RUN rustup target add wasm32-unknown-unknown \
 && apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
# the wasm-bindgen CLI must match the version in Cargo.lock
RUN V=$(grep -A1 'name = "wasm-bindgen"$' Cargo.lock | sed -n 's/version = "\(.*\)"/\1/p') \
 && cargo install wasm-bindgen-cli --version "$V" --locked
RUN ./tools/build-web-editor.sh \
 && cargo build --release -p nord-editor-server -p nord-cli

FROM node:22-bookworm-slim
RUN useradd --system --create-home --uid 10001 nord
WORKDIR /opt/nord
COPY --from=build /src/target/release/nord-editor-server /src/target/release/nord /usr/local/bin/
COPY --from=build /src/dist/web-editor ./web
# engine files export jobs read (runtime, vendored libs, templates, tools)
COPY --from=build /src/runtime ./engine/runtime
COPY --from=build /src/vendor ./engine/vendor
COPY --from=build /src/templates ./engine/templates
COPY --from=build /src/tools/export-bundle.mjs /src/tools/compile-sheets.mjs ./engine/tools/
USER nord
ENV NORD_ROOT=/opt/nord/engine
VOLUME /data
EXPOSE 8787
# --listen 0.0.0.0 is fine inside the container: publish the port on 127.0.0.1 only and put TLS in front (see docker-compose.yml)
ENTRYPOINT ["nord-editor-server", "--listen", "0.0.0.0:8787", "--workspace", "/data", "--web", "/opt/nord/web", "--engine", "/opt/nord/engine", "--secure-cookies"]
