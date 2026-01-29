/**
 * Tests for logger module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import { initialize_logger, log_info, log_warn, log_error, log_debug } from "./logger";

vi.mock("fs");

describe("logger", () => {
  let console_error_spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    console_error_spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
    // Reset environment variable
    delete process.env.DEBUG_LOG_FILE;
  });

  afterEach(() => {
    console_error_spy.mockRestore();
  });

  describe("initialize_logger", () => {
    it("should not write to file when DEBUG_LOG_FILE not set", () => {
      initialize_logger();

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it("should write initialization message when DEBUG_LOG_FILE is set", () => {
      process.env.DEBUG_LOG_FILE = "/tmp/test.log";

      initialize_logger();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/tmp/test.log",
        expect.stringContaining("Logger initialized")
      );
    });
  });

  describe("log_info", () => {
    it("should write formatted message to stderr", () => {
      log_info("test message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[INFO\] test message/)
      );
    });

    it("should also write to file when DEBUG_LOG_FILE is set", () => {
      process.env.DEBUG_LOG_FILE = "/tmp/test.log";
      initialize_logger();
      vi.clearAllMocks();

      log_info("test message");

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/tmp/test.log",
        expect.stringContaining("test message")
      );
    });
  });

  describe("log_warn", () => {
    it("should write formatted warning to stderr", () => {
      log_warn("warning message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] warning message/)
      );
    });
  });

  describe("log_error", () => {
    it("should write formatted error to stderr", () => {
      log_error("error message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[ERROR\] error message/)
      );
    });
  });

  describe("log_debug", () => {
    it("should not write to stderr", () => {
      log_debug("debug message");

      expect(console_error_spy).not.toHaveBeenCalled();
    });

    it("should not write to file when DEBUG_LOG_FILE is not set", () => {
      // Re-initialize to reset internal log_file_path state
      initialize_logger();
      vi.clearAllMocks();

      log_debug("debug message");

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it("should write to file when DEBUG_LOG_FILE is set", () => {
      process.env.DEBUG_LOG_FILE = "/tmp/test.log";
      initialize_logger();
      vi.clearAllMocks();

      log_debug("debug message");

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/tmp/test.log",
        expect.stringMatching(/\[.*\] \[DEBUG\] debug message\n/)
      );
    });
  });
});
