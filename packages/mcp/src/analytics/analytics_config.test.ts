import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { is_analytics_enabled, resolve_analytics_dir } from "./analytics_config";

describe("analytics_config", () => {
  let tmp_dir: string;

  beforeEach(() => {
    tmp_dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ariadne-analytics-config-test-"),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  });

  describe("resolve_analytics_dir", () => {
    const original_env = process.env;

    beforeEach(() => {
      process.env = { ...original_env };
      delete process.env.ARIADNE_ANALYTICS_DIR;
    });

    afterEach(() => {
      process.env = original_env;
    });

    it("returns the explicit dir argument when given", () => {
      process.env.ARIADNE_ANALYTICS_DIR = "/env/dir";
      expect(resolve_analytics_dir("/explicit/dir")).toEqual("/explicit/dir");
    });

    it("falls back to ARIADNE_ANALYTICS_DIR env var", () => {
      process.env.ARIADNE_ANALYTICS_DIR = "/env/dir";
      expect(resolve_analytics_dir()).toEqual("/env/dir");
    });

    it("defaults to ~/.ariadne/analytics", () => {
      process.env.HOME = "/home/tester";
      expect(resolve_analytics_dir()).toEqual(
        path.join("/home/tester", ".ariadne", "analytics"),
      );
    });
  });

  describe("is_analytics_enabled", () => {
    const original_env = process.env;

    beforeEach(() => {
      process.env = { ...original_env };
      delete process.env.ARIADNE_ANALYTICS;
    });

    afterEach(() => {
      process.env = original_env;
    });

    it("returns true when ARIADNE_ANALYTICS=1 env var is set", () => {
      process.env.ARIADNE_ANALYTICS = "1";
      expect(is_analytics_enabled()).toEqual(true);
    });

    it("returns true when config file has analytics: true", () => {
      const config_dir = path.join(tmp_dir, ".ariadne");
      fs.mkdirSync(config_dir, { recursive: true });
      fs.writeFileSync(
        path.join(config_dir, "config.json"),
        JSON.stringify({ analytics: true }),
      );
      process.env.HOME = tmp_dir;

      expect(is_analytics_enabled()).toEqual(true);
    });

    it("returns false when neither env var nor config is set", () => {
      process.env.HOME = tmp_dir;
      expect(is_analytics_enabled()).toEqual(false);
    });

    it("returns false when config file does not exist", () => {
      process.env.HOME = tmp_dir;
      expect(is_analytics_enabled()).toEqual(false);
    });

    it("returns false when config file is malformed JSON", () => {
      const config_dir = path.join(tmp_dir, ".ariadne");
      fs.mkdirSync(config_dir, { recursive: true });
      fs.writeFileSync(
        path.join(config_dir, "config.json"),
        "not valid json{{",
      );
      process.env.HOME = tmp_dir;

      expect(is_analytics_enabled()).toEqual(false);
    });
  });
});
