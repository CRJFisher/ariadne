export class Suite {
  constructor(title) {
    this.title = title;
  }

  beforeAll(fn) {}

  afterEach(fn) {}

  addTest(test) {}

  push(child) {}
}
