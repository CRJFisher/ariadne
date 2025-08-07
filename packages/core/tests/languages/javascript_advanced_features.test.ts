import { test_scopes, ScopeDebug } from '../test_utils';
import { describe, test } from 'vitest';

describe('JavaScript Advanced Features Parsing', () => {
  test.skip('variable declarations and scoping', () => {
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
      child_scopes: [
        // testFunction declaration scope
        {
          definitions: [],
          imports: [],
          references: [],
          child_scopes: [
            // function body scope
            {
              definitions: [
                {
                  name: 'functionVar',
                  kind: 'variable',
                  context: 'var §functionVar§ = \'function\';',
                  referenced_in: [
                    'console.log(globalVar, §functionVar§, hoisted, blockLocal);'
                  ],
                },
                {
                  name: 'functionLet',
                  kind: 'variable',
                  context: 'let §functionLet§ = \'function let\';',
                  referenced_in: [],
                },
              ],
              imports: [],
              references: [
                { name: 'console', context: '§console§.log(hoisted); // var is hoisted' },
                { name: 'log', context: 'console.§log§(hoisted); // var is hoisted' },
                { name: 'hoisted', context: 'console.log(§hoisted§); // var is hoisted' },
              ],
              child_scopes: [
                // if block scope
                {
                  definitions: [
                    {
                      name: 'hoisted',
                      kind: 'variable',
                      context: 'var §hoisted§ = \'hoisted\';',
                      referenced_in: [
                        'console.log(globalVar, functionVar, §hoisted§, blockLocal);'
                      ],
                    },
                    {
                      name: 'blockLocal',
                      kind: 'variable',
                      context: 'let §blockLocal§ = \'block local\';',
                      referenced_in: [
                        'console.log(globalVar, functionVar, hoisted, §blockLocal§);'
                      ],
                    },
                    {
                      name: 'blockConst',
                      kind: 'constant',
                      context: 'const §blockConst§ = \'const\';',
                      referenced_in: [],
                    },
                  ],
                  imports: [],
                  references: [
                    { name: 'console', context: '§console§.log(globalVar, functionVar, hoisted, blockLocal);' },
                    { name: 'log', context: 'console.§log§(globalVar, functionVar, hoisted, blockLocal);' },
                  ],
                  child_scopes: [],
                },
              ],
            },
          ],
        },
      ],
    };

    test_scopes('javascript', source, expected);
  });

  test.skip('ES6 import/export statements', () => {
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
      ],
      references: [],
      child_scopes: [
        {
          definitions: [],
          imports: [],
          references: [],
          child_scopes: [
            {
              definitions: [
                {
                  name: 'state',
                  kind: 'constant',
                  context: 'const [§state§, setState] = useState(0);',
                  referenced_in: [
                    'return React.createElement(\'div\', null, §state§);'
                  ],
                },
                {
                  name: 'setState',
                  kind: 'constant',
                  context: 'const [state, §setState§] = useState(0);',
                  referenced_in: [],
                },
              ],
              imports: [],
              references: [],
              child_scopes: [
                {
                  definitions: [],
                  imports: [],
                  references: [],
                  child_scopes: [
                    {
                      definitions: [],
                      imports: [],
                      references: [],
                      child_scopes: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    test_scopes('javascript', source, expected);
  });

  test.skip('destructuring and spread', () => {
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
          name: 'rest',
          kind: 'variable',
          context: 'const [first, second, ...§rest§] = [1, 2, 3, 4, 5];',
          referenced_in: [],
        },
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
          name: 'otherProps',
          kind: 'variable',
          context: 'const { name, age, ...§otherProps§ } = person;',
          referenced_in: [],
        },
        {
          name: 'name',
          kind: 'constant',
          context: 'const { §name§, age, ...otherProps } = person;',
          referenced_in: [
            'console.log(id, §name§, email);'
          ],
        },
        {
          name: 'age',
          kind: 'constant',
          context: 'const { name, §age§, ...otherProps } = person;',
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
      references: [],
      child_scopes: [
        {
          definitions: [],
          imports: [],
          references: [],
          child_scopes: [
            {
              definitions: [],
              imports: [],
              references: [],
              child_scopes: [],
            },
          ],
        },
        {
          definitions: [],
          imports: [],
          references: [],
          child_scopes: [],
        },
      ],
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
      child_scopes: [
        {
          definitions: [
            {
              name: '#privateField',
              kind: 'property',
              context: '§#privateField§;',
              referenced_in: [],
            },
            {
              name: '#privateStatic',
              kind: 'property',
              context: 'static §#privateStatic§;',
              referenced_in: [],
            },
            {
              name: 'constructor',
              kind: 'method',
              context: '§constructor§() {',
              referenced_in: [],
            },
            {
              name: 'getPrivate',
              kind: 'method',
              context: '§getPrivate§() {',
              referenced_in: [],
            },
            {
              name: 'getStatic',
              kind: 'method',
              context: 'static §getStatic§() {',
              referenced_in: [],
            },
          ],
          imports: [],
          references: [],
          child_scopes: [
            {
              definitions: [],
              imports: [],
              references: [],
              child_scopes: [
                {
                  definitions: [],
                  imports: [],
                  references: [],
                  child_scopes: [],
                },
              ],
            },
            {
              definitions: [],
              imports: [],
              references: [],
              child_scopes: [
                {
                  definitions: [],
                  imports: [],
                  references: [],
                  child_scopes: [],
                },
              ],
            },
            {
              definitions: [],
              imports: [],
              references: [],
              child_scopes: [
                {
                  definitions: [],
                  imports: [],
                  references: [],
                  child_scopes: [],
                },
              ],
            },
          ],
        },
      ],
    };

    test_scopes('javascript', source, expected);
  });

  test.skip('JSX elements', () => {
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
      child_scopes: [
        {
          definitions: [],
          imports: [],
          references: [],
          child_scopes: [
            {
              definitions: [],
              imports: [],
              references: [],
              child_scopes: [],
            },
          ],
        },
      ],
    };

    test_scopes('javascript', source, expected);
  });
});