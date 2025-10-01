#!/usr/bin/env npx tsx

import { writeFileSync } from 'fs';
import { join } from 'path';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { build_semantic_index } from './packages/core/src/index_single_file/semantic_index';
import { Language, ParsedFile } from './packages/types/src';

interface CoverageStats {
  language: string;
  totalMethodCalls: number;
  methodCallsWithReceiverLocation: number;
  receiverLocationCoverage: number;
  totalTypeReferences: number;
  typeReferencesWithTypeInfo: number;
  typeInfoCoverage: number;
  totalConstructorCalls: number;
  constructorCallsWithTarget: number;
  constructorTargetCoverage: number;
  totalPropertyAccess: number;
  propertyAccessWithChain: number;
  propertyChainCoverage: number;
}

const languageTestCode: Record<Language, string> = {
  javascript: `
// Test JavaScript code with various patterns
const fs = require('fs');
const { readFile, writeFile } = require('fs/promises');
import { join } from 'path';
import * as utils from './utils';

class TestClass {
  constructor(name) {
    this.name = name;
    this.items = [];
  }

  addItem(item) {
    this.items.push(item);
    return this;
  }

  static createDefault() {
    return new TestClass('default');
  }

  getItem(index) {
    return this.items[index];
  }
}

function processData(data) {
  const result = data.map(item => item * 2);
  return result.filter(x => x > 10);
}

const instance = new TestClass('test');
instance.addItem(5).addItem(10);

const items = instance.getItem(0);
const processed = processData([1, 2, 3, 4, 5]);

// Method calls
console.log('Result:', processed);
Math.max(1, 2, 3);
Object.keys({ a: 1 });

// Property access chains
const config = { database: { host: 'localhost', port: 5432 } };
const host = config.database.host;
const port = config.database.port;

// Assignment patterns
let x = 10;
x += 5;
const [a, b] = [1, 2];
const { name, age } = { name: 'Alice', age: 30 };
`,

  typescript: `
class Service {
  getData() {
    return this.items;
  }
}

const svc = new Service();
const result = svc.getData();
`,

  python: `
# Test Python code with various patterns
from typing import List, Dict, Optional, Union, Tuple
from dataclasses import dataclass
import os.path
from collections import defaultdict

@dataclass
class User:
    id: int
    name: str
    email: Optional[str] = None

class UserService:
    def __init__(self, config: Dict[str, any]):
        self.config = config
        self.users: Dict[int, User] = {}

    def add_user(self, user: User) -> None:
        self.users[user.id] = user

    def get_user(self, user_id: int) -> Optional[User]:
        return self.users.get(user_id)

    @classmethod
    def create_default(cls, config: Dict[str, any]) -> 'UserService':
        return cls(config)

    @property
    def user_count(self) -> int:
        return len(self.users)

def process_users(users: List[User]) -> List[User]:
    return [u for u in users if u.email is not None]

# Constructor calls
service = UserService({'api_key': 'test'})
user = User(id=1, name='Alice', email='alice@test.com')
service.add_user(user)

# Method calls with receivers
found_user = service.get_user(1)
processed = process_users([user])

# Property access chains
user_name = user.name
user_email = user.email
config_key = service.config.get('api_key')

# Type annotations
status: str = 'active'
nullable_value: Optional[str] = None
union_type: Union[int, str] = 42
tuple_type: Tuple[int, str, bool] = (1, 'test', True)

# Assignment patterns
x = 10
y = x
x += 5
a, b = 1, 2
items = [1, 2, 3, 4, 5]
filtered = [x for x in items if x > 2]
`,

  rust: `
// Test Rust code with various patterns
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
struct User {
    id: u32,
    name: String,
    email: Option<String>,
}

struct UserService {
    config: HashMap<String, String>,
    users: HashMap<u32, User>,
}

impl UserService {
    fn new(config: HashMap<String, String>) -> Self {
        Self {
            config,
            users: HashMap::new(),
        }
    }

    fn add_user(&mut self, user: User) {
        self.users.insert(user.id, user);
    }

    fn get_user(&self, id: u32) -> Option<&User> {
        self.users.get(&id)
    }

    fn user_count(&self) -> usize {
        self.users.len()
    }
}

impl User {
    fn new(id: u32, name: String) -> Self {
        Self {
            id,
            name,
            email: None,
        }
    }

    fn with_email(mut self, email: String) -> Self {
        self.email = Some(email);
        self
    }
}

fn process_users(users: Vec<User>) -> Vec<User> {
    users.into_iter()
        .filter(|u| u.email.is_some())
        .collect()
}

fn main() {
    // Constructor calls
    let mut service = UserService::new(HashMap::new());
    let user = User::new(1, "Alice".to_string())
        .with_email("alice@test.com".to_string());

    // Method calls
    service.add_user(user.clone());
    let found_user = service.get_user(1);
    let count = service.user_count();

    // Property access
    let user_name = &user.name;
    let user_email = &user.email;

    // Type references
    let optional: Option<String> = None;
    let result: Result<i32, String> = Ok(42);
    let arc_user: Arc<User> = Arc::new(user);

    // Pattern matching
    match found_user {
        Some(u) => println!("Found: {}", u.name),
        None => println!("Not found"),
    }
}
`
};

function getParser(language: Language): Parser.Language {
  switch (language) {
    case 'javascript':
      return JavaScript;
    case 'typescript':
      return TypeScript.typescript;
    case 'python':
      return Python;
    case 'rust':
      return Rust;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

async function measureCoverage(language: Language, code: string): Promise<CoverageStats> {
  // Parse the code first
  const parser = new Parser();
  parser.setLanguage(getParser(language));
  const tree = parser.parse(code);

  if (!tree) {
    throw new Error(`Failed to parse ${language} code`);
  }

  const parsedFile: ParsedFile = {
    path: `test.${language === 'python' ? 'py' : language === 'rust' ? 'rs' : language === 'typescript' ? 'ts' : 'js'}`,
    content: code,
    language: language
  };

  const result = build_semantic_index(parsedFile, tree, language);

  // Count method calls (call type with receiver_location) and those with receiver_location
  const methodCalls = result.references.filter(ref =>
    ref.type === 'call' && ref.context?.receiver_location
  );
  const methodCallsWithReceiver = methodCalls.filter(ref =>
    ref.context?.receiver_location &&
    (ref.context.receiver_location.start_line > 0 || ref.context.receiver_location.start_column > 0)
  );

  // Count type references and those with type_info
  const typeReferences = result.references.filter(ref => ref.type === 'type_reference' || ref.type === 'type');
  const typeReferencesWithInfo = typeReferences.filter(ref =>
    ref.context?.type_info &&
    ref.context.type_info.type_name
  );

  // Count constructor calls and those with target
  const constructorCalls = result.references.filter(ref =>
    ref.type === 'constructor_call' || ref.type === 'new' ||
    (ref.type === 'call' && ref.context?.construct_target)
  );
  const constructorCallsWithTarget = constructorCalls.filter(ref =>
    ref.context?.construct_target &&
    (ref.context.construct_target.start_line > 0 || ref.context.construct_target.start_column > 0)
  );

  // Count property access and those with chains
  const propertyAccess = result.references.filter(ref =>
    ref.type === 'member_access' ||
    (ref.type === 'call' && ref.context?.property_chain && ref.context.property_chain.length > 0)
  );
  const propertyAccessWithChain = propertyAccess.filter(ref =>
    ref.context?.property_chain &&
    ref.context.property_chain.length > 0
  );

  return {
    language,
    totalMethodCalls: methodCalls.length,
    methodCallsWithReceiverLocation: methodCallsWithReceiver.length,
    receiverLocationCoverage: methodCalls.length > 0 ?
      (methodCallsWithReceiver.length / methodCalls.length) * 100 : 0,
    totalTypeReferences: typeReferences.length,
    typeReferencesWithTypeInfo: typeReferencesWithInfo.length,
    typeInfoCoverage: typeReferences.length > 0 ?
      (typeReferencesWithInfo.length / typeReferences.length) * 100 : 0,
    totalConstructorCalls: constructorCalls.length,
    constructorCallsWithTarget: constructorCallsWithTarget.length,
    constructorTargetCoverage: constructorCalls.length > 0 ?
      (constructorCallsWithTarget.length / constructorCalls.length) * 100 : 0,
    totalPropertyAccess: propertyAccess.length,
    propertyAccessWithChain: propertyAccessWithChain.length,
    propertyChainCoverage: propertyAccess.length > 0 ?
      (propertyAccessWithChain.length / propertyAccess.length) * 100 : 0,
  };
}

async function main() {
  console.log('📊 Measuring Metadata Extraction Coverage\n');
  console.log('=' .repeat(80));

  const results: CoverageStats[] = [];
  const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];

  for (const language of languages) {
    if (languageTestCode[language]) {
      console.log(`\n🔍 Analyzing ${language.toUpperCase()}...`);
      try {
        const stats = await measureCoverage(language, languageTestCode[language]);
        results.push(stats);

        console.log(`  ✅ Method calls: ${stats.methodCallsWithReceiverLocation}/${stats.totalMethodCalls} (${stats.receiverLocationCoverage.toFixed(1)}%)`);
        console.log(`  ✅ Type references: ${stats.typeReferencesWithTypeInfo}/${stats.totalTypeReferences} (${stats.typeInfoCoverage.toFixed(1)}%)`);
        console.log(`  ✅ Constructor calls: ${stats.constructorCallsWithTarget}/${stats.totalConstructorCalls} (${stats.constructorTargetCoverage.toFixed(1)}%)`);
        console.log(`  ✅ Property access: ${stats.propertyAccessWithChain}/${stats.totalPropertyAccess} (${stats.propertyChainCoverage.toFixed(1)}%)`);
      } catch (error) {
        console.error(`  ❌ Error processing ${language}:`, error);
      }
    }
  }

  console.log('\n' + '=' .repeat(80));
  console.log('\n📈 OVERALL COVERAGE SUMMARY\n');

  // Calculate overall averages
  const avgMethodCallCoverage = results.length > 0 ?
    results.reduce((sum, r) => sum + r.receiverLocationCoverage, 0) / results.length : 0;
  const avgTypeInfoCoverage = results.length > 0 ?
    results.reduce((sum, r) => sum + r.typeInfoCoverage, 0) / results.length : 0;

  console.log(`Average Method Call Coverage (receiver_location): ${avgMethodCallCoverage.toFixed(1)}%`);
  console.log(`Average Type Reference Coverage (type_info): ${avgTypeInfoCoverage.toFixed(1)}%`);

  // Check success criteria
  console.log('\n✅ SUCCESS CRITERIA CHECK:');
  console.log(`  - Method calls with receiver_location: ${avgMethodCallCoverage >= 80 ? '✅' : '❌'} ${avgMethodCallCoverage.toFixed(1)}% (target: 80%+)`);
  console.log(`  - Type references with type_info: ${avgTypeInfoCoverage >= 90 ? '✅' : '❌'} ${avgTypeInfoCoverage.toFixed(1)}% (target: 90%+)`);

  // Generate detailed report
  const reportPath = join(process.cwd(), 'metadata_coverage_report.json');
  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      avgMethodCallCoverage,
      avgTypeInfoCoverage,
      meetsMethodCallTarget: avgMethodCallCoverage >= 80,
      meetsTypeInfoTarget: avgTypeInfoCoverage >= 90,
    }
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Detailed report saved to: ${reportPath}`);
}

main().catch(console.error);