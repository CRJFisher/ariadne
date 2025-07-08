import { test_scopes, ScopeDebug, debug_scope_graph } from '../../test_utils';
import { Project } from '../../index';

describe('JavaScript parsing', () => {
  test('variable declarations and scoping', () => {
    const source = `
      var globalVar = 'global';
      let blockScoped = 'block';
      const constant = 42;
      
      function testFunction() {
        var functionVar = 'function';
        let functionLet = 'function let';
        
        if (true) {
          var hoisted = 'hoisted';
          let blockLocal = 'block local';
          const blockConst = 'const';
          
          console.log(globalVar, functionVar, hoisted, blockLocal);
        }
        
        console.log(hoisted); // var is hoisted
        // console.log(blockLocal); // Would error - let is block scoped
      }
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'globalVar',
          kind: 'variable',
          context: 'var §globalVar§ = \'global\';',
          referenced_in: [
            'console.log(§globalVar§, functionVar, hoisted, blockLocal);'
          ],
        },
        {
          name: 'blockScoped',
          kind: 'variable',
          context: 'let §blockScoped§ = \'block\';',
          referenced_in: [],
        },
        {
          name: 'constant',
          kind: 'constant',
          context: 'const §constant§ = 42;',
          referenced_in: [],
        },
        {
          name: 'testFunction',
          kind: 'function',
          context: 'function §testFunction§() {',
          referenced_in: [],
        },
      ],
      imports: [],
      references: [],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('function declarations and expressions', () => {
    const source = `
      // Function declaration
      function namedFunction(param1, param2) {
        return param1 + param2;
      }
      
      // Function expression
      const funcExpression = function(a, b) {
        return a * b;
      };
      
      // Arrow function
      const arrowFunc = (x, y) => x - y;
      
      // Arrow with single param
      const singleParam = z => z * 2;
      
      // Generator function
      function* generator(n) {
        yield n;
        yield n + 1;
      }
      
      // Method in object
      const obj = {
        method(arg) {
          return arg;
        },
        arrow: (val) => val * 2
      };
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'namedFunction',
          kind: 'function',
          context: 'function §namedFunction§(param1, param2) {',
          referenced_in: [],
        },
        {
          name: 'funcExpression',
          kind: 'constant',
          context: 'const §funcExpression§ = function(a, b) {',
          referenced_in: [],
        },
        {
          name: 'arrowFunc',
          kind: 'constant',
          context: 'const §arrowFunc§ = (x, y) => x - y;',
          referenced_in: [],
        },
        {
          name: 'singleParam',
          kind: 'constant',
          context: 'const §singleParam§ = z => z * 2;',
          referenced_in: [],
        },
        {
          name: 'generator',
          kind: 'generator',
          context: 'function* §generator§(n) {',
          referenced_in: [],
        },
        {
          name: 'obj',
          kind: 'constant',
          context: 'const §obj§ = {',
          referenced_in: [],
        },
      ],
      imports: [],
      references: [],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('ES6 import/export statements', () => {
    const source = `
      // Default import
      import React from 'react';
      
      // Named imports
      import { useState, useEffect } from 'react';
      
      // Aliased imports
      import { Component as BaseComponent } from 'react';
      
      // Namespace import
      import * as utils from './utils';
      
      // Side effect import
      import './styles.css';
      
      // Using imports
      const App = () => {
        const [state, setState] = useState(0);
        useEffect(() => {
          utils.log('mounted');
        }, []);
        
        return React.createElement('div', null, state);
      };
      
      // Exports
      export default App;
      export { App as Application };
      export const VERSION = '1.0.0';
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'App',
          kind: 'constant',
          context: 'const §App§ = () => {',
          referenced_in: [
            'export default §App§;',
            'export { §App§ as Application };'
          ],
        },
        {
          name: 'VERSION',
          kind: 'constant',
          context: 'export const §VERSION§ = \'1.0.0\';',
          referenced_in: [],
        },
      ],
      imports: [
        {
          name: 'React',
          context: 'import §React§ from \'react\';',
          referenced_in: [
            'return §React§.createElement(\'div\', null, state);'
          ],
        },
        {
          name: 'useState',
          context: 'import { §useState§, useEffect } from \'react\';',
          referenced_in: [
            'const [state, setState] = §useState§(0);'
          ],
        },
        {
          name: 'useEffect',
          context: 'import { useState, §useEffect§ } from \'react\';',
          referenced_in: [
            '§useEffect§(() => {'
          ],
        },
        {
          name: 'BaseComponent',
          context: 'import { Component as §BaseComponent§ } from \'react\';',
          referenced_in: [],
        },
        {
          name: 'utils',
          context: 'import * as §utils§ from \'./utils\';',
          referenced_in: [
            '§utils§.log(\'mounted\');'
          ],
        },
      ],
      references: [],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('classes and inheritance', () => {
    const source = `
      class Animal {
        constructor(name) {
          this.name = name;
        }
        
        speak() {
          console.log(this.name + ' makes a sound');
        }
      }
      
      class Dog extends Animal {
        constructor(name, breed) {
          super(name);
          this.breed = breed;
        }
        
        speak() {
          super.speak();
          console.log(this.name + ' barks');
        }
        
        static createPuppy(name) {
          return new Dog(name, 'mixed');
        }
      }
      
      const myDog = new Dog('Rex', 'German Shepherd');
      myDog.speak();
      
      const puppy = Dog.createPuppy('Buddy');
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'Animal',
          kind: 'class',
          context: 'class §Animal§ {',
          referenced_in: [
            'class Dog extends §Animal§ {'
          ],
        },
        {
          name: 'Dog',
          kind: 'class',
          context: 'class §Dog§ extends Animal {',
          referenced_in: [
            'return new §Dog§(name, \'mixed\');',
            'const myDog = new §Dog§(\'Rex\', \'German Shepherd\');',
            'const puppy = §Dog§.createPuppy(\'Buddy\');'
          ],
        },
        {
          name: 'myDog',
          kind: 'constant',
          context: 'const §myDog§ = new Dog(\'Rex\', \'German Shepherd\');',
          referenced_in: [
            '§myDog§.speak();'
          ],
        },
        {
          name: 'puppy',
          kind: 'constant',
          context: 'const §puppy§ = Dog.createPuppy(\'Buddy\');',
          referenced_in: [],
        },
      ],
      imports: [],
      references: [],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('destructuring and spread', () => {
    const source = `
      // Array destructuring
      const [first, second, ...rest] = [1, 2, 3, 4, 5];
      
      // Object destructuring
      const { name, age, ...otherProps } = person;
      
      // Nested destructuring
      const { address: { street, city } } = user;
      
      // Destructuring with defaults
      const { theme = 'light', lang = 'en' } = settings;
      
      // Destructuring in function params
      function processUser({ id, name, email }) {
        console.log(id, name, email);
      }
      
      // Array spread
      const combined = [...arr1, ...arr2];
      
      // Object spread
      const extended = { ...base, extra: true };
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'first',
          kind: 'constant',
          context: 'const [§first§, second, ...rest] = [1, 2, 3, 4, 5];',
          referenced_in: [],
        },
        {
          name: 'second',
          kind: 'constant',
          context: 'const [first, §second§, ...rest] = [1, 2, 3, 4, 5];',
          referenced_in: [],
        },
        {
          name: 'rest',
          kind: 'constant',
          context: 'const [first, second, ...§rest§] = [1, 2, 3, 4, 5];',
          referenced_in: [],
        },
        {
          name: 'name',
          kind: 'constant',
          context: 'const { §name§, age, ...otherProps } = person;',
          referenced_in: [],
        },
        {
          name: 'age',
          kind: 'constant',
          context: 'const { name, §age§, ...otherProps } = person;',
          referenced_in: [],
        },
        {
          name: 'otherProps',
          kind: 'constant',
          context: 'const { name, age, ...§otherProps§ } = person;',
          referenced_in: [],
        },
        {
          name: 'street',
          kind: 'constant',
          context: 'const { address: { §street§, city } } = user;',
          referenced_in: [],
        },
        {
          name: 'city',
          kind: 'constant',
          context: 'const { address: { street, §city§ } } = user;',
          referenced_in: [],
        },
        {
          name: 'theme',
          kind: 'constant',
          context: 'const { §theme§ = \'light\', lang = \'en\' } = settings;',
          referenced_in: [],
        },
        {
          name: 'lang',
          kind: 'constant',
          context: 'const { theme = \'light\', §lang§ = \'en\' } = settings;',
          referenced_in: [],
        },
        {
          name: 'processUser',
          kind: 'function',
          context: 'function §processUser§({ id, name, email }) {',
          referenced_in: [],
        },
        {
          name: 'combined',
          kind: 'constant',
          context: 'const §combined§ = [...arr1, ...arr2];',
          referenced_in: [],
        },
        {
          name: 'extended',
          kind: 'constant',
          context: 'const §extended§ = { ...base, extra: true };',
          referenced_in: [],
        },
      ],
      imports: [],
      references: [
        {
          name: 'person',
          context: 'const { name, age, ...otherProps } = §person§;',
        },
        {
          name: 'user',
          context: 'const { address: { street, city } } = §user§;',
        },
        {
          name: 'settings',
          context: 'const { theme = \'light\', lang = \'en\' } = §settings§;',
        },
        {
          name: 'arr1',
          context: 'const combined = [...§arr1§, ...arr2];',
        },
        {
          name: 'arr2',
          context: 'const combined = [...arr1, ...§arr2§];',
        },
        {
          name: 'base',
          context: 'const extended = { ...§base§, extra: true };',
        },
      ],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('loops and control flow', () => {
    const source = `
      // for loop with var/let
      for (var i = 0; i < 10; i++) {
        console.log(i);
      }
      console.log(i); // i is accessible here (var)
      
      for (let j = 0; j < 10; j++) {
        console.log(j);
      }
      // console.log(j); // Error: j is not accessible (let)
      
      // for...in loop
      for (const key in object) {
        console.log(key, object[key]);
      }
      
      // for...of loop
      for (const item of array) {
        console.log(item);
      }
      
      // while loop
      let count = 0;
      while (count < 5) {
        count++;
      }
      
      // labeled statements
      outer: for (let x = 0; x < 3; x++) {
        inner: for (let y = 0; y < 3; y++) {
          if (x === 1 && y === 1) {
            break outer;
          }
          console.log(x, y);
        }
      }
      
      // try-catch
      try {
        riskyOperation();
      } catch (error) {
        console.error(error);
      }
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'i',
          kind: 'variable',
          context: 'for (var §i§ = 0; i < 10; i++) {',
          referenced_in: [
            'for (var i = 0; §i§ < 10; i++) {',
            'for (var i = 0; i < 10; §i§++) {',
            'console.log(§i§);',
            'console.log(§i§); // i is accessible here (var)'
          ],
        },
        {
          name: 'count',
          kind: 'variable',
          context: 'let §count§ = 0;',
          referenced_in: [
            'while (§count§ < 5) {',
            '§count§++;'
          ],
        },
        {
          name: 'outer',
          kind: 'label',
          context: '§outer§: for (let x = 0; x < 3; x++) {',
          referenced_in: [
            'break §outer§;'
          ],
        },
      ],
      imports: [],
      references: [
        {
          name: 'console',
          context: expect.any(String),
        },
        {
          name: 'object',
          context: 'for (const key in §object§) {',
        },
        {
          name: 'array',
          context: 'for (const item of §array§) {',
        },
        {
          name: 'riskyOperation',
          context: '§riskyOperation§();',
        },
      ],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('JSX elements', () => {
    const source = `
      import Button from '../../Button';
      import ChevronRightIcon from '../../../icons/ChevronRightIcon';
      
      const NavBarNoUser = () => {
        return (
          <span className="flex gap-2 justify-self-end">
            <Button size={'medium'} variant={'tertiary'}>
              Sign in
            </Button>
            <Button size={'medium'} variant={'secondary'}>
              Sign Up <ChevronRightIcon />
            </Button>
          </span>
        );
      };
      
      export default NavBarNoUser;
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'NavBarNoUser',
          kind: 'constant',
          context: 'const §NavBarNoUser§ = () => {',
          referenced_in: [
            'export default §NavBarNoUser§;'
          ],
        },
      ],
      imports: [
        {
          name: 'Button',
          context: 'import §Button§ from \'../../Button\';',
          referenced_in: [
            '<§Button§ size={\'medium\'} variant={\'tertiary\'}>',
            '</§Button§>',
            '<§Button§ size={\'medium\'} variant={\'secondary\'}>',
            '</§Button§>'
          ],
        },
        {
          name: 'ChevronRightIcon',
          context: 'import §ChevronRightIcon§ from \'../../../icons/ChevronRightIcon\';',
          referenced_in: [
            'Sign Up <§ChevronRightIcon§ />'
          ],
        },
      ],
      references: [],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('private class fields', () => {
    const source = `
      class MyClass {
        #privateField;
        static #privateStatic;
        
        constructor() {
          this.#privateField = 42;
        }
        
        getPrivate() {
          return this.#privateField;
        }
        
        static getStatic() {
          return MyClass.#privateStatic;
        }
      }
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'MyClass',
          kind: 'class',
          context: 'class §MyClass§ {',
          referenced_in: [
            'return §MyClass§.#privateStatic;'
          ],
        },
      ],
      imports: [],
      references: [],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('operator references', () => {
    const source = `
      var a = 2;
      var b = 3;
      var c = 4;
      
      // update expr
      a++;
      
      // unary
      -a;
      
      // binary
      a + b;
      
      // ternary
      c ? a : b;
      
      // spread
      const obj = {a, b, ...c};
      
      // index
      a[b];
      
      // member (b is not a reference here)
      a.b;
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'a',
          kind: 'variable',
          context: 'var §a§ = 2;',
          referenced_in: [
            '§a§++;',
            '-§a§;',
            '§a§ + b;',
            'c ? §a§ : b;',
            'const obj = {§a§, b, ...c};',
            '§a§[b];',
            '§a§.b;'
          ],
        },
        {
          name: 'b',
          kind: 'variable',
          context: 'var §b§ = 3;',
          referenced_in: [
            'a + §b§;',
            'c ? a : §b§;',
            'const obj = {a, §b§, ...c};',
            'a[§b§];'
          ],
        },
        {
          name: 'c',
          kind: 'variable',
          context: 'var §c§ = 4;',
          referenced_in: [
            '§c§ ? a : b;',
            'const obj = {a, b, ...§c§};'
          ],
        },
        {
          name: 'obj',
          kind: 'constant',
          context: 'const §obj§ = {a, b, ...c};',
          referenced_in: [],
        },
      ],
      imports: [],
      references: [],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });

  test('closures and hoisting', () => {
    const source = `
      // Function hoisting
      console.log(hoistedFunc()); // Works - function declarations are hoisted
      
      function hoistedFunc() {
        return 'I am hoisted';
      }
      
      // Variable hoisting
      console.log(varVariable); // undefined - var is hoisted but not initialized
      var varVariable = 'var value';
      
      // console.log(letVariable); // Error - let is not hoisted
      let letVariable = 'let value';
      
      // Closure example
      function createCounter() {
        let count = 0;
        
        return {
          increment() {
            count++;
            return count;
          },
          decrement() {
            count--;
            return count;
          },
          getCount() {
            return count;
          }
        };
      }
      
      const counter = createCounter();
      console.log(counter.increment());
      console.log(counter.getCount());
    `;

    const expected: ScopeDebug = {
      definitions: [
        {
          name: 'hoistedFunc',
          kind: 'function',
          context: 'function §hoistedFunc§() {',
          referenced_in: [
            'console.log(§hoistedFunc§()); // Works - function declarations are hoisted'
          ],
        },
        {
          name: 'varVariable',
          kind: 'variable',
          context: 'var §varVariable§ = \'var value\';',
          referenced_in: [
            'console.log(§varVariable§); // undefined - var is hoisted but not initialized'
          ],
        },
        {
          name: 'letVariable',
          kind: 'variable',
          context: 'let §letVariable§ = \'let value\';',
          referenced_in: [],
        },
        {
          name: 'createCounter',
          kind: 'function',
          context: 'function §createCounter§() {',
          referenced_in: [
            'const counter = §createCounter§();'
          ],
        },
        {
          name: 'counter',
          kind: 'constant',
          context: 'const §counter§ = createCounter();',
          referenced_in: [
            'console.log(§counter§.increment());',
            'console.log(§counter§.getCount());'
          ],
        },
      ],
      imports: [],
      references: [
        {
          name: 'console',
          context: expect.any(String),
        },
      ],
      child_scopes: [],
    };

    test_scopes('javascript', source, expected);
  });
});