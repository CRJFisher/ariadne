// lib/Compilation.js shape - compilation.js

class TransactionManager {
  getTransaction() {}
}

class Chunk {
  split() {}
}

class ChunkGraph {
  connect() {}
}

class Compilation {
  #tm = new TransactionManager();

  constructor() {
    this.chunk = new Chunk();
    this.chunkGraph = new ChunkGraph();
  }

  seal() {
    this.#tm.getTransaction();
    this.chunk.split();
    this.chunkGraph.connect();
  }
}

module.exports = Compilation;
