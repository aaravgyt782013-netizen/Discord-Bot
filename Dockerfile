FROM node:24-bookworm

WORKDIR /usr/src/app

# Native dependencies required by Canvas and other image/audio modules.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install from package.json so the production manifest is the source of truth.
# The repository's legacy lockfile predates the LightCore manifest and would
# otherwise make npm ci reject the intentionally updated dependency set.
COPY package*.json ./
RUN npm install --omit=dev && npm rebuild canvas --build-from-source

COPY . .

CMD ["npm", "start"]
