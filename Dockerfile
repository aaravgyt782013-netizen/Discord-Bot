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

# Install directly from the LightCore production manifest.
# Do not copy the repository's legacy package-lock.json into the build stage;
# it predates the current manifest and can leave required dependencies such as
# chalk missing from the resulting image.
COPY package.json ./
RUN npm install --omit=dev && npm rebuild canvas --build-from-source

COPY . .

CMD ["npm", "start"]
