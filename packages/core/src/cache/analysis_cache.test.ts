import { describe, it, expect, beforeEach } from 'vitest';
import { createAnalysisCache } from './analysis_cache';
import { FileAnalysis, Language, FilePath, SourceCode } from '@ariadnejs/types';

describe('AnalysisCache', () => {
  let cache: ReturnType<typeof createAnalysisCache>;

  beforeEach(() => {
    cache = createAnalysisCache({
      enabled: true,
      ttl: 1000, // 1 second for testing
      maxSize: 3
    });
  });

  describe('Basic caching', () => {
    it('should cache and retrieve analysis', () => {
      const mockAnalysis = {
        file_path: '/test/file.js' as FilePath,
        source_code: 'const x = 1;' as SourceCode,
        language: 'javascript' as Language,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        variables: [],
        errors: [],
        function_calls: [],
        method_calls: [],
        constructor_calls: [],
        type_info: new Map(),
        scopes: { nodes: new Map(), root_id: 'root' as any, language: 'javascript' as Language }
      } as FileAnalysis;

      const content = 'const x = 1;';
      
      // Cache the analysis
      cache.cacheAnalysis('/test/file.js', content, mockAnalysis);
      
      // Retrieve from cache
      const cached = cache.getCachedAnalysis('/test/file.js', content);
      expect(cached).toBeDefined();
      expect(cached?.file_path).toBe('/test/file.js');
    });

    it('should invalidate cache on content change', () => {
      const mockAnalysis = {
        file_path: '/test/file.js' as FilePath,
        source_code: 'const x = 1;' as SourceCode,
        language: 'javascript' as Language,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        variables: [],
        errors: [],
        function_calls: [],
        method_calls: [],
        constructor_calls: [],
        type_info: new Map(),
        scopes: { nodes: new Map(), root_id: 'root' as any, language: 'javascript' as Language }
      } as FileAnalysis;

      const content1 = 'const x = 1;';
      const content2 = 'const x = 2;'; // Different content
      
      // Cache with first content
      cache.cacheAnalysis('/test/file.js', content1, mockAnalysis);
      
      // Try to retrieve with different content
      const cached = cache.getCachedAnalysis('/test/file.js', content2);
      expect(cached).toBeUndefined(); // Should not match due to hash difference
    });

    it('should respect TTL', async () => {
      const mockAnalysis = {
        file_path: '/test/file.js' as FilePath,
        source_code: 'const x = 1;' as SourceCode,
        language: 'javascript' as Language,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        variables: [],
        errors: [],
        function_calls: [],
        method_calls: [],
        constructor_calls: [],
        type_info: new Map(),
        scopes: { nodes: new Map(), root_id: 'root' as any, language: 'javascript' as Language }
      } as FileAnalysis;

      const content = 'const x = 1;';
      
      // Cache the analysis
      cache.cacheAnalysis('/test/file.js', content, mockAnalysis);
      
      // Retrieve immediately - should work
      let cached = cache.getCachedAnalysis('/test/file.js', content);
      expect(cached).toBeDefined();
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired now
      cached = cache.getCachedAnalysis('/test/file.js', content);
      expect(cached).toBeUndefined();
    });

    it('should evict oldest entries when full', () => {
      const content = 'const x = 1;';
      
      // Fill cache to max size
      for (let i = 1; i <= 3; i++) {
        const mockAnalysis = {
          file_path: `/test/file${i}.js` as FilePath,
          source_code: 'const x = 1;' as SourceCode,
          language: 'javascript' as Language,
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          variables: [],
          errors: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          type_info: new Map(),
          scopes: { nodes: new Map(), root_id: 'root' as any, language: 'javascript' as Language }
        } as FileAnalysis;
        
        cache.cacheAnalysis(`/test/file${i}.js`, content, mockAnalysis);
      }
      
      // All should be cached
      expect(cache.getCachedAnalysis('/test/file1.js', content)).toBeDefined();
      expect(cache.getCachedAnalysis('/test/file2.js', content)).toBeDefined();
      expect(cache.getCachedAnalysis('/test/file3.js', content)).toBeDefined();
      
      // Add one more - should evict first
      const mockAnalysis4 = {
        file_path: '/test/file4.js' as FilePath,
        source_code: 'const x = 1;' as SourceCode,
        language: 'javascript' as Language,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        variables: [],
        errors: [],
        function_calls: [],
        method_calls: [],
        constructor_calls: [],
        type_info: new Map(),
        scopes: { nodes: new Map(), root_id: 'root' as any, language: 'javascript' as Language }
      } as FileAnalysis;
      
      cache.cacheAnalysis('/test/file4.js', content, mockAnalysis4);
      
      // First should be evicted
      expect(cache.getCachedAnalysis('/test/file1.js', content)).toBeUndefined();
      expect(cache.getCachedAnalysis('/test/file2.js', content)).toBeDefined();
      expect(cache.getCachedAnalysis('/test/file3.js', content)).toBeDefined();
      expect(cache.getCachedAnalysis('/test/file4.js', content)).toBeDefined();
    });
  });

  describe('Cache statistics', () => {
    it('should report cache stats', () => {
      const stats = cache.getStats();
      expect(stats.enabled).toBe(true);
      expect(stats.astCacheSize).toBe(0);
      expect(stats.analysisCacheSize).toBe(0);
      
      // Add some cached items
      const mockAnalysis = {
        file_path: '/test/file.js' as FilePath,
        source_code: 'const x = 1;' as SourceCode,
        language: 'javascript' as Language,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        variables: [],
        errors: [],
        function_calls: [],
        method_calls: [],
        constructor_calls: [],
        type_info: new Map(),
        scopes: { nodes: new Map(), root_id: 'root' as any, language: 'javascript' as Language }
      } as FileAnalysis;
      
      cache.cacheAnalysis('/test/file.js', 'const x = 1;', mockAnalysis);
      
      const newStats = cache.getStats();
      expect(newStats.analysisCacheSize).toBe(1);
    });
  });

  describe('Disabled cache', () => {
    it('should not cache when disabled', () => {
      const disabledCache = createAnalysisCache({
        enabled: false
      });
      
      const mockAnalysis = {
        file_path: '/test/file.js' as FilePath,
        source_code: 'const x = 1;' as SourceCode,
        language: 'javascript' as Language,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        variables: [],
        errors: [],
        function_calls: [],
        method_calls: [],
        constructor_calls: [],
        type_info: new Map(),
        scopes: { nodes: new Map(), root_id: 'root' as any, language: 'javascript' as Language }
      } as FileAnalysis;
      
      const content = 'const x = 1;';
      
      // Try to cache
      disabledCache.cacheAnalysis('/test/file.js', content, mockAnalysis);
      
      // Should not be cached
      const cached = disabledCache.getCachedAnalysis('/test/file.js', content);
      expect(cached).toBeUndefined();
      
      const stats = disabledCache.getStats();
      expect(stats.enabled).toBe(false);
      expect(stats.analysisCacheSize).toBe(0);
    });
  });
});