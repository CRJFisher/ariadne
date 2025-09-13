import { describe, it, expect } from 'vitest';
import { generate_code_graph } from './code_graph';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe.skip('Method Override Detection Integration', () => {
  it('should detect method overrides in JavaScript class hierarchy', async () => {
    // Create a temporary directory with test files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'override-test-'));
    
    // Create JavaScript files with method overrides
    const baseFile = path.join(tmpDir, 'base.js');
    const derivedFile = path.join(tmpDir, 'derived.js');
    
    fs.writeFileSync(baseFile, `
class Animal {
  speak() {
    console.log('Animal makes a sound');
  }
  
  move() {
    console.log('Animal moves');
  }
}

module.exports = Animal;
`);
    
    fs.writeFileSync(derivedFile, `
const Animal = require('./base');

class Dog extends Animal {
  speak() {
    console.log('Dog barks');
  }
  
  wagTail() {
    console.log('Dog wags tail');
  }
}

class Cat extends Animal {
  speak() {
    console.log('Cat meows');
  }
  
  move() {
    console.log('Cat prowls silently');
  }
}

module.exports = { Dog, Cat };
`);

    try {
      // Generate code graph
      const codeGraph = await generate_code_graph({
        project_root: tmpDir,
        include_patterns: ['**/*.js'],
        exclude_patterns: [],
      });

      // Check that classes are found
      expect(codeGraph.classes.classes.size).toBeGreaterThan(0);
      
      // Check Dog class
      const dogClass = codeGraph.classes.classes.get('Dog');
      expect(dogClass).toBeDefined();
      if (dogClass) {
        const speakMethod = dogClass.methods.get('speak');
        expect(speakMethod).toBeDefined();
        if (speakMethod) {
          // The speak method should be marked as an override
          expect(speakMethod.is_override).toBe(true);
        }
      }
      
      // Check Cat class
      const catClass = codeGraph.classes.classes.get('Cat');
      expect(catClass).toBeDefined();
      if (catClass) {
        const speakMethod = catClass.methods.get('speak');
        const moveMethod = catClass.methods.get('move');
        
        expect(speakMethod).toBeDefined();
        expect(moveMethod).toBeDefined();
        
        if (speakMethod) {
          expect(speakMethod.is_override).toBe(true);
        }
        if (moveMethod) {
          expect(moveMethod.is_override).toBe(true);
        }
      }
    } finally {
      // Clean up temporary files
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should detect method overrides in Python class hierarchy', async () => {
    // Create a temporary directory with test files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'override-py-test-'));
    
    // Create Python file with method overrides
    const pythonFile = path.join(tmpDir, 'classes.py');
    
    fs.writeFileSync(pythonFile, `
class Shape:
    def area(self):
        raise NotImplementedError()
    
    def perimeter(self):
        raise NotImplementedError()

class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height
    
    def area(self):
        return self.width * self.height
    
    def perimeter(self):
        return 2 * (self.width + self.height)

class Square(Rectangle):
    def __init__(self, side):
        super().__init__(side, side)
    
    def area(self):
        return self.width ** 2
`);

    try {
      // Generate code graph
      const codeGraph = await generate_code_graph({
        project_root: tmpDir,
        include_patterns: ['**/*.py'],
        exclude_patterns: [],
      });

      // Check Rectangle class
      const rectangleClass = codeGraph.classes.classes.get('Rectangle');
      expect(rectangleClass).toBeDefined();
      if (rectangleClass) {
        const areaMethod = rectangleClass.methods.get('area');
        const perimeterMethod = rectangleClass.methods.get('perimeter');
        
        expect(areaMethod).toBeDefined();
        expect(perimeterMethod).toBeDefined();
        
        // These should be overrides of Shape's methods
        if (areaMethod) {
          expect(areaMethod.is_override).toBe(true);
        }
        if (perimeterMethod) {
          expect(perimeterMethod.is_override).toBe(true);
        }
      }
      
      // Check Square class
      const squareClass = codeGraph.classes.classes.get('Square');
      expect(squareClass).toBeDefined();
      if (squareClass) {
        const areaMethod = squareClass.methods.get('area');
        
        expect(areaMethod).toBeDefined();
        if (areaMethod) {
          // This overrides Rectangle's area method
          expect(areaMethod.is_override).toBe(true);
        }
      }
    } finally {
      // Clean up temporary files
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});