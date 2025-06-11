# Use an official Node.js runtime as a parent image
# Using a specific LTS version is generally recommended, e.g., node:18-alpine or node:20-alpine
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock if you use yarn)
COPY package*.json ./

# Install app dependencies
# Using --frozen-lockfile (npm) or --frozen-lockfile (yarn) is good practice for CI/production builds
RUN npm install --frozen-lockfile

# Bundle app source
COPY . .

# Set environment variables that might be needed at build time
# For example, if your build process needs an API key (though typically runtime keys are handled differently)
# ENV NEXT_PUBLIC_SOME_KEY="some_value"

# Build the Next.js app
RUN npm run build

# Expose the port the app runs on (Next.js default is 3000)
EXPOSE 3000

# Define the command to run the app
# This will run `next start` using the production server
CMD ["npm", "start"]
