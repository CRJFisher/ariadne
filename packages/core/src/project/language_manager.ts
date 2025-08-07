import { LanguageConfig } from '../types';
import { typescript_config } from '../languages/typescript';
import { javascript_config } from '../languages/javascript';
import { python_config } from '../languages/python';
import { rust_config } from '../languages/rust';

/**
 * LanguageManager handles language configuration registration and lookup
 */
export class LanguageManager {
  private readonly languages: Map<string, LanguageConfig>;
  
  constructor() {
    this.languages = new Map();
    this.registerDefaultLanguages();
  }
  
  /**
   * Register default language configurations
   */
  private registerDefaultLanguages(): void {
    this.registerLanguage(typescript_config);
    this.registerLanguage(javascript_config);
    this.registerLanguage(python_config);
    this.registerLanguage(rust_config);
  }
  
  /**
   * Register a language configuration
   */
  registerLanguage(config: LanguageConfig): void {
    this.languages.set(config.name, config);
    // Also register by file extensions for easy lookup
    for (const ext of config.file_extensions) {
      this.languages.set(ext, config);
    }
  }
  
  /**
   * Get language configuration by name or extension
   */
  getLanguage(nameOrExt: string): LanguageConfig | undefined {
    return this.languages.get(nameOrExt);
  }
  
  /**
   * Get all registered languages as a readonly map
   */
  getLanguages(): ReadonlyMap<string, LanguageConfig> {
    return this.languages;
  }
  
  /**
   * Check if a language is registered
   */
  hasLanguage(nameOrExt: string): boolean {
    return this.languages.has(nameOrExt);
  }
  
  /**
   * Get all language names
   */
  getLanguageNames(): string[] {
    const names = new Set<string>();
    for (const [key, config] of this.languages) {
      if (key === config.name) {
        names.add(config.name);
      }
    }
    return Array.from(names);
  }
}