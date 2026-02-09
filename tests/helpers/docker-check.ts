import { execFile } from "node:child_process";

/**
 * Check whether Docker is available on the current system.
 * Returns true if `docker info` exits with code 0.
 */
export function isDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("docker", ["info"], (error) => {
      resolve(error === null);
    });
  });
}
