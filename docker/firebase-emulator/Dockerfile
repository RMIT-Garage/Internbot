# Firebase Emulator image
# Provides: Auth (9099), Firestore (8080), Storage (9199), Functions (5001), UI (4000)
FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

# firebase-tools requires Java 21+ for the Firestore emulator. Bookworm only ships JDK 17 by default,
# so we install Temurin 21 from Adoptium. curl is used by docker-compose healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget gnupg curl && \
    wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg && \
    . /etc/os-release && \
    echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb ${VERSION_CODENAME} main" > /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && apt-get install -y --no-install-recommends temurin-21-jre && \
    rm -rf /var/lib/apt/lists/*

# Install Firebase CLI globally
RUN npm install -g firebase-tools@latest

WORKDIR /workspace

# Config + rules/indexes referenced by firebase.json (paths like firebase/*.rules)
COPY docker/firebase-emulator/firebase.json ./
COPY docker/firebase-emulator/firebase ./firebase

# Create the emulator data directory
RUN mkdir -p .emulator-data

EXPOSE 4000 5001 8080 9099 9199

# Emulator bind addresses: set in firebase.json (emulators.*.host). Newer firebase-tools rejects --host here.
# Use FIREBASE_PROJECT_ID instead of .firebaserc so Terraform-managed projects do not need Firebase CLI project aliases.
ENTRYPOINT ["sh", "-c", "firebase experiments:enable webframeworks && exec firebase emulators:start --project=${FIREBASE_PROJECT_ID:-demo-internbot} --only=auth,firestore,storage,functions --import=.emulator-data --export-on-exit=.emulator-data"]
