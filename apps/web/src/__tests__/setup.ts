import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Automatically cleanup React Testing Library state after each test
afterEach(() => {
  cleanup();
});
