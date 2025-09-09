import { describe, it, expect } from 'vitest';
import { extract_docstring_type, normalize_python_type } from './parameter_type_inference.python';
import { get_language_parser } from '../../scope_queries/loader';
import { ParameterInferenceContext } from './parameter_type_inference';

describe('Python bespoke parameter type inference', () => {
  describe('extract_docstring_type', () => {
    it('should extract type from Google-style docstring', () => {
      const code = `
def test(name, age, active):
    """Test function.
    
    Args:
        name (str): The name
        age (int): The age  
        active (bool): Is active
    """
    pass
      `;
      
      const parser = get_language_parser('python');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_definition')[0];
      
      const type_name = extract_docstring_type('name', func_node, context);
      const type_age = extract_docstring_type('age', func_node, context);
      const type_active = extract_docstring_type('active', func_node, context);
      
      expect(type_name).toBe('str');
      expect(type_age).toBe('int');
      expect(type_active).toBe('bool');
    });
    
    it('should extract type from NumPy-style docstring', () => {
      const code = `
def test(x, y):
    """
    Parameters
    ----------
    x : array_like
        Input array
    y : float
        Scale factor
    """
    pass
      `;
      
      const parser = get_language_parser('python');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_definition')[0];
      
      const type_x = extract_docstring_type('x', func_node, context);
      const type_y = extract_docstring_type('y', func_node, context);
      
      expect(type_x).toBe('array_like');
      expect(type_y).toBe('float');
    });
    
    it('should extract type from Sphinx-style docstring', () => {
      const code = `
def test(value, count):
    """
    :param str value: The value to process
    :param int count: Number of iterations
    :return: Processed result
    """
    pass
      `;
      
      const parser = get_language_parser('python');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_definition')[0];
      
      const type_value = extract_docstring_type('value', func_node, context);
      const type_count = extract_docstring_type('count', func_node, context);
      
      expect(type_value).toBe('str');
      expect(type_count).toBe('int');
    });
    
    it('should return undefined for missing docstring', () => {
      const code = `def test(x): pass`;
      
      const parser = get_language_parser('python');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_definition')[0];
      const result = extract_docstring_type('x', func_node, context);
      
      expect(result).toBeUndefined();
    });
    
    it('should return undefined for parameter not in docstring', () => {
      const code = `
def test(x, y):
    """
    Args:
        x (int): The x value
    """
    pass
      `;
      
      const parser = get_language_parser('python');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_definition')[0];
      const result = extract_docstring_type('y', func_node, context);
      
      expect(result).toBeUndefined();
    });
    
    it('should handle complex types in docstrings', () => {
      const code = `
def test(data, mapping, items):
    """
    Args:
        data (List[str]): List of strings
        mapping (Dict[str, int]): String to int mapping
        items (Optional[Tuple[int, ...]]): Optional tuple of ints
    """
    pass
      `;
      
      const parser = get_language_parser('python');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_definition')[0];
      
      const type_data = extract_docstring_type('data', func_node, context);
      const type_mapping = extract_docstring_type('mapping', func_node, context);
      const type_items = extract_docstring_type('items', func_node, context);
      
      expect(type_data).toBe('List[str]');
      expect(type_mapping).toBe('Dict[str, int]');
      expect(type_items).toBe('Optional[Tuple[int, ...]]');
    });
  });
  
  describe('normalize_python_type', () => {
    it('should normalize basic Python types', () => {
      expect(normalize_python_type('str')).toBe('str');
      expect(normalize_python_type('int')).toBe('int');
      expect(normalize_python_type('float')).toBe('float');
      expect(normalize_python_type('bool')).toBe('bool');
      expect(normalize_python_type('bytes')).toBe('bytes');
      expect(normalize_python_type('None')).toBe('None');
    });
    
    it('should normalize container types', () => {
      expect(normalize_python_type('list')).toBe('list');
      expect(normalize_python_type('tuple')).toBe('tuple');
      expect(normalize_python_type('dict')).toBe('dict');
      expect(normalize_python_type('set')).toBe('set');
      expect(normalize_python_type('frozenset')).toBe('frozenset');
    });
    
    it('should normalize generic types with capital letters', () => {
      expect(normalize_python_type('List[str]')).toBe('list[str]');
      expect(normalize_python_type('Dict[str, int]')).toBe('dict[str, int]');
      expect(normalize_python_type('Tuple[int, ...]')).toBe('tuple[int, ...]');
      expect(normalize_python_type('Set[float]')).toBe('set[float]');
    });
    
    it('should handle Optional types', () => {
      expect(normalize_python_type('Optional[str]')).toBe('str | None');
      expect(normalize_python_type('Optional[List[int]]')).toBe('list[int] | None');
      expect(normalize_python_type('Optional[Dict[str, Any]]')).toBe('dict[str, Any] | None');
    });
    
    it('should handle Union types', () => {
      expect(normalize_python_type('Union[str, int]')).toBe('str | int');
      expect(normalize_python_type('Union[str, int, None]')).toBe('str | int | None');
      expect(normalize_python_type('Union[List[str], Tuple[int, ...]]')).toBe('list[str] | tuple[int, ...]');
    });
    
    it('should remove typing module prefix', () => {
      expect(normalize_python_type('typing.List[str]')).toBe('list[str]');
      expect(normalize_python_type('typing.Dict[str, int]')).toBe('dict[str, int]');
      expect(normalize_python_type('typing.Optional[str]')).toBe('str | None');
      expect(normalize_python_type('typing.Any')).toBe('Any');
    });
    
    it('should preserve custom types', () => {
      expect(normalize_python_type('MyClass')).toBe('MyClass');
      expect(normalize_python_type('module.MyClass')).toBe('module.MyClass');
      expect(normalize_python_type('package.module.MyClass')).toBe('package.module.MyClass');
    });
    
    it('should handle nested generics', () => {
      expect(normalize_python_type('List[List[str]]')).toBe('list[list[str]]');
      expect(normalize_python_type('Dict[str, List[int]]')).toBe('dict[str, list[int]]');
      expect(normalize_python_type('Optional[Dict[str, List[int]]]')).toBe('dict[str, list[int]] | None');
    });
    
    it('should handle Callable types', () => {
      expect(normalize_python_type('Callable[[int, str], bool]')).toBe('Callable[[int, str], bool]');
      expect(normalize_python_type('typing.Callable[[], None]')).toBe('Callable[[], None]');
    });
    
    it('should handle Literal types', () => {
      expect(normalize_python_type('Literal["foo"]')).toBe('Literal["foo"]');
      expect(normalize_python_type('Literal[1, 2, 3]')).toBe('Literal[1, 2, 3]');
    });
  });
});