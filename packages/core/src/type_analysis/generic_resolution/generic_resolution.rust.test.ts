/**
 * Comprehensive tests for Rust-specific generic resolution features
 */

import { describe, it, expect } from 'vitest';
import {
  resolve_rust_associated_type,
  resolve_rust_impl_trait,
  resolve_rust_dyn_trait,
  resolve_rust_reference,
  resolve_rust_tuple,
  strip_rust_lifetimes,
  has_lifetime_parameters,
  extract_rust_lifetimes
} from './generic_resolution.rust';
import { create_generic_context } from './generic_resolution';

describe('Rust Generic Resolution', () => {
  describe('Associated Types', () => {
    it('should resolve simple associated type', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Iterator');
      
      const result = resolve_rust_associated_type('T::Item', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Iterator::Item');
      expect(result?.confidence).toBe('exact');
    });

    it('should resolve nested associated types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'HashMap<String, Value>');
      
      const result = resolve_rust_associated_type('T::IntoIter::Item', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('HashMap<String, Value>::IntoIter::Item');
    });

    it('should resolve associated type with generic parameters', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'Vec<U>');
      context.type_arguments.set('U', 'String');
      
      const result = resolve_rust_associated_type('T::Item', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Vec<String>::Item');
    });

    it('should handle unbound type parameter', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_rust_associated_type('T::Item', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('T::Item');
      expect(result?.confidence).toBe('partial');
    });

    it('should return null for non-associated types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_rust_associated_type('Vec<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Impl Trait Types', () => {
    it('should resolve impl trait with simple trait', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Display');
      
      const result = resolve_rust_impl_trait('impl T', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('impl Display');
    });

    it('should resolve impl trait with trait bounds', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Clone + Send');
      
      const result = resolve_rust_impl_trait('impl T', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('impl Clone + Send');
    });

    it('should resolve impl trait with generic trait', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'Iterator');
      context.type_arguments.set('U', 'String');
      
      const result = resolve_rust_impl_trait('impl T<Item = U>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('impl Iterator<Item = String>');
    });

    it('should resolve impl trait in return position', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Future<Output = ()>');
      
      const result = resolve_rust_impl_trait('impl T', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('impl Future<Output = ()>');
    });

    it('should return null for non-impl-trait types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_rust_impl_trait('Vec<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Dyn Trait Types', () => {
    it('should resolve dyn trait with simple trait', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Display');
      
      const result = resolve_rust_dyn_trait('dyn T', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('dyn Display');
    });

    it('should resolve dyn trait with trait bounds', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Clone + Send + Sync');
      
      const result = resolve_rust_dyn_trait('dyn T', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('dyn Clone + Send + Sync');
    });

    it('should resolve dyn trait with lifetime', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Display');
      
      const result = resolve_rust_dyn_trait("dyn T + 'static", context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe("dyn Display + 'static");
    });

    it('should resolve dyn trait in Box', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Error');
      
      const result = resolve_rust_dyn_trait('Box<dyn T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Box<dyn Error>');
    });

    it('should return null for non-dyn-trait types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_rust_dyn_trait('Vec<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Reference Types', () => {
    it('should resolve mutable reference', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'String');
      
      const result = resolve_rust_reference('&mut T', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('&mut String');
    });

    it('should resolve immutable reference', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Vec<i32>');
      
      const result = resolve_rust_reference('&T', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('&Vec<i32>');
    });

    it('should resolve reference with lifetime', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'str');
      
      const result = resolve_rust_reference("&'a T", context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe("&'a str");
    });

    it('should resolve mutable reference with lifetime', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Vec<u8>');
      
      const result = resolve_rust_reference("&'static mut T", context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe("&'static mut Vec<u8>");
    });

    it('should return null for non-reference types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_rust_reference('Vec<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Tuple Types', () => {
    it('should resolve simple tuple', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'i32');
      context.type_arguments.set('U', 'String');
      
      const result = resolve_rust_tuple('(T, U)', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('(i32, String)');
    });

    it('should resolve single element tuple', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'f64');
      
      const result = resolve_rust_tuple('(T,)', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('(f64,)');
    });

    it('should resolve nested tuple', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'i32');
      context.type_arguments.set('U', '(String, bool)');
      
      const result = resolve_rust_tuple('(T, U)', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('(i32, (String, bool))');
    });

    it('should resolve empty tuple (unit type)', () => {
      const context = create_generic_context([]);
      
      const result = resolve_rust_tuple('()', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('()');
    });

    it('should return null for non-tuple types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_rust_tuple('Vec<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Lifetime Management', () => {
    it('should detect lifetime parameters', () => {
      expect(has_lifetime_parameters("&'a str")).toBe(true);
      expect(has_lifetime_parameters("&'static mut Vec<T>")).toBe(true);
      expect(has_lifetime_parameters("Cow<'_, str>")).toBe(true);
      expect(has_lifetime_parameters("fn<'a>(&'a str) -> &'a str")).toBe(true);
    });

    it('should detect no lifetime parameters', () => {
      expect(has_lifetime_parameters("String")).toBe(false);
      expect(has_lifetime_parameters("Vec<T>")).toBe(false);
      expect(has_lifetime_parameters("&str")).toBe(false);
      expect(has_lifetime_parameters("Option<i32>")).toBe(false);
    });

    it('should strip simple lifetimes', () => {
      expect(strip_rust_lifetimes("&'a str")).toBe("&str");
      expect(strip_rust_lifetimes("&'static mut Vec<T>")).toBe("&mut Vec<T>");
      expect(strip_rust_lifetimes("Cow<'_, str>")).toBe("Cow<str>");
    });

    it('should strip multiple lifetimes', () => {
      expect(strip_rust_lifetimes("fn<'a, 'b>(&'a str, &'b str) -> &'a str"))
        .toBe("fn(&str, &str) -> &str");
    });

    it('should handle lifetime elision', () => {
      expect(strip_rust_lifetimes("&str")).toBe("&str");
      expect(strip_rust_lifetimes("Vec<&str>")).toBe("Vec<&str>");
    });

    it('should extract lifetime parameters', () => {
      expect(extract_rust_lifetimes("&'a str")).toEqual(["'a"]);
      expect(extract_rust_lifetimes("&'static mut Vec<T>")).toEqual(["'static"]);
      expect(extract_rust_lifetimes("Cow<'_, str>")).toEqual(["'_"]);
      expect(extract_rust_lifetimes("fn<'a, 'b>(&'a str, &'b str)")).toEqual(["'a", "'b", "'a", "'b"]);
    });

    it('should extract no lifetimes when none present', () => {
      expect(extract_rust_lifetimes("String")).toEqual([]);
      expect(extract_rust_lifetimes("Vec<T>")).toEqual([]);
      expect(extract_rust_lifetimes("&str")).toEqual([]);
    });
  });


  describe('Edge Cases', () => {
    it('should handle empty context gracefully', () => {
      const context = create_generic_context([]);
      
      const result = resolve_rust_associated_type('T::Item', context);
      expect(result?.resolved_type).toBe('T::Item');
      expect(result?.confidence).toBe('partial');
    });

    it('should handle complex nested generics', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'HashMap<String, Vec<Option<Result<i32, Error>>>>');
      
      const result = resolve_rust_impl_trait('impl T', context);
      expect(result?.resolved_type).toBe('impl HashMap<String, Vec<Option<Result<i32, Error>>>>');
    });

    it('should handle malformed type expressions gracefully', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      expect(resolve_rust_associated_type('T::')).toBeNull();
      expect(resolve_rust_impl_trait('impl')).toBeNull();
      expect(resolve_rust_dyn_trait('dyn')).toBeNull();
      expect(resolve_rust_reference('&')).toBeNull();
      expect(resolve_rust_tuple('(T')).toBeNull();
    });

    it('should handle very long type names', () => {
      const longType = 'VeryLongTypeName'.repeat(10);
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', longType);
      
      const result = resolve_rust_reference('&T', context);
      expect(result?.resolved_type).toBe(`&${longType}`);
    });

    it('should handle special lifetime names', () => {
      expect(has_lifetime_parameters("&'_ str")).toBe(true);
      expect(has_lifetime_parameters("&'static str")).toBe(true);
      expect(strip_rust_lifetimes("&'_ str")).toBe("&str");
      expect(extract_rust_lifetimes("&'_ str")).toEqual(["'_"]);
    });

    it('should handle Unicode in type names', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'データ型');
      
      const result = resolve_rust_reference('&T', context);
      expect(result?.resolved_type).toBe('&データ型');
    });
  });
});