import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import { initialize_logger, log_info, log_warn, log_error, log_debug } from "./logger";

vi.mock("fs");

describe("logger", () => {
  let console_error_spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    console_error_spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
    delete process.env.DEBUG_LOG_FILE;
    delete process.env.ARIADNE_LOG_LEVEL;
    initialize_logger();
    vi.clearAllMocks();
  });

  afterEach(() => {
    console_error_spy.mockRestore();
  });

  describe("initialize_logger", () => {
    it("does not write to file when DEBUG_LOG_FILE is unset", () => {
      initialize_logger();

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it("writes a session marker to the file when DEBUG_LOG_FILE is set", () => {
      process.env.DEBUG_LOG_FILE = "/tmp/test.log";

      initialize_logger();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/tmp/test.log",
        expect.stringContaining("Logger initialized")
      );
    });

    it("re-reads the environment on a subsequent explicit call", () => {
      log_debug("suppressed at default info level");
      expect(console_error_spy).not.toHaveBeenCalled();

      process.env.ARIADNE_LOG_LEVEL = "debug";
      initialize_logger();

      log_debug("now emitted");
      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringContaining("now emitted")
      );
    });
  });

  describe("log_info", () => {
    it("writes a formatted message to stderr", () => {
      log_info("test message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[INFO\] test message/)
      );
    });

    it("also writes to the file when DEBUG_LOG_FILE is set", () => {
      process.env.DEBUG_LOG_FILE = "/tmp/test.log";
      initialize_logger();
      vi.clearAllMocks();

      log_info("test message");

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/tmp/test.log",
        expect.stringMatching(/\[.*\] \[INFO\] test message\n/)
      );
    });
  });

  describe("log_warn", () => {
    it("writes a formatted warning to stderr", () => {
      log_warn("warning message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[WARN\] warning message/)
      );
    });
  });

  describe("log_error", () => {
    it("writes a formatted error to stderr", () => {
      log_error("error message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[ERROR\] error message/)
      );
    });

    it("emits errors even when the level suppresses everything else", () => {
      process.env.ARIADNE_LOG_LEVEL = "error";
      initialize_logger();
      vi.clearAllMocks();

      log_error("error message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[ERROR\] error message/)
      );
    });
  });

  describe("log_debug", () => {
    it("does not write to stderr at the default info level", () => {
      log_debug("debug message");

      expect(console_error_spy).not.toHaveBeenCalled();
    });

    it("does not write to the file when DEBUG_LOG_FILE is unset", () => {
      log_debug("debug message");

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it("writes to the file when DEBUG_LOG_FILE is set", () => {
      process.env.DEBUG_LOG_FILE = "/tmp/test.log";
      initialize_logger();
      vi.clearAllMocks();

      log_debug("debug message");

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/tmp/test.log",
        expect.stringMatching(/\[.*\] \[DEBUG\] debug message\n/)
      );
    });

    it("writes to stderr when ARIADNE_LOG_LEVEL=debug", () => {
      process.env.ARIADNE_LOG_LEVEL = "debug";
      initialize_logger();
      vi.clearAllMocks();

      log_debug("debug message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[DEBUG\] debug message/)
      );
    });
  });

  describe("ARIADNE_LOG_LEVEL", () => {
    it("suppresses info when the level is warn", () => {
      process.env.ARIADNE_LOG_LEVEL = "warn";
      initialize_logger();
      vi.clearAllMocks();

      log_info("info message");
      log_warn("warn message");

      expect(console_error_spy).toHaveBeenCalledTimes(1);
      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringContaining("warn message")
      );
    });

    it("suppresses warn when the level is error", () => {
      process.env.ARIADNE_LOG_LEVEL = "error";
      initialize_logger();
      vi.clearAllMocks();

      log_warn("warn message");
      log_error("error message");

      expect(console_error_spy).toHaveBeenCalledTimes(1);
      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringContaining("error message")
      );
    });

    it("parses the level case-insensitively", () => {
      process.env.ARIADNE_LOG_LEVEL = "DEBUG";
      initialize_logger();
      vi.clearAllMocks();

      log_debug("debug message");

      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringContaining("debug message")
      );
    });

    it("falls back to info for an unrecognized level", () => {
      process.env.ARIADNE_LOG_LEVEL = "verbose";
      initialize_logger();
      vi.clearAllMocks();

      log_info("info message");
      log_debug("debug message");

      expect(console_error_spy).toHaveBeenCalledTimes(1);
      expect(console_error_spy).toHaveBeenCalledWith(
        expect.stringContaining("info message")
      );
    });
  });
});
