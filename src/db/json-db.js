import fs from "fs/promises";
import path from "path";
import os from "os";

const appDir = path.join(os.homedir(), ".threadline");

/**
 * StrategyDB
 * Manages JSON storage for the StrategyStore structure defined in src/scraper/type.ts.
 */
export class StrategyDB {
  constructor(filename = "strategies.json") {
    this.dbPath = path.join(appDir, filename);
    this.data = null; // Represents StrategyStore structure
  }

  async init() {
    try {
      await fs.mkdir(appDir, { recursive: true });
      try {
        const fileContent = await fs.readFile(this.dbPath, "utf-8");
        this.data = JSON.parse(fileContent);
      } catch (err) {
        if (err.code === "ENOENT") {
          this.data = {};
          await this.save();
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(`Failed to initialize Strategy DB at ${this.dbPath}:`, err);
    }
  }

  async save() {
    try {
      await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error(`Failed to save Strategy DB at ${this.dbPath}:`, err);
    }
  }

  async getStrategy(platformName, task) {
    if (!this.data) await this.init();
    return this.data[platformName]?.[task] || null;
  }

  async setStrategy(strategy) {
    if (!this.data) await this.init();
    const platformName = strategy.platform.name;
    const task = strategy.task;

    if (!this.data[platformName]) {
      this.data[platformName] = {};
    }
    this.data[platformName][task] = strategy;
    await this.save();
  }

  async deleteStrategy(platformName, task) {
    if (!this.data) await this.init();
    if (this.data[platformName] && this.data[platformName][task]) {
      delete this.data[platformName][task];
      // Clean up empty platform objects
      if (Object.keys(this.data[platformName]).length === 0) {
        delete this.data[platformName];
      }
      await this.save();
      return true;
    }
    return false;
  }

  async getAllStrategies() {
    if (!this.data) await this.init();
    return this.data;
  }

  async clear() {
    if (!this.data) await this.init();
    this.data = {};
    await this.save();
  }
}
