import { 
  StorageInterfaceSync,
  StorageTransactionSync,
  ProjectState,
  StoredFileCache 
} from '../storage_interface_sync';
import { ScopeGraph } from '../../graph';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  createEmptyState,
  updateFileInState,
  removeFileFromState 
} from '../storage_utils';
import { LanguageConfig } from '../../types';

/**
 * Example disk-based storage implementation
 * Stores project state on disk to reduce memory usage
 * 
 * Directory structure:
 * - storage_dir/
 *   - metadata.json (project metadata)
 *   - files/
 *     - [hash].json (file cache and graph data)
 *   - index.json (file path to hash mapping)
 */
export class DiskStorage implements StorageInterfaceSync {
  private readonly storageDir: string;
  private readonly filesDir: string;
  private readonly metadataPath: string;
  private readonly indexPath: string;
  private fileIndex: Map<string, string> = new Map(); // filePath -> hash
  private readonly languages: ReadonlyMap<string, LanguageConfig>;
  
  constructor(storageDir: string, languages: ReadonlyMap<string, LanguageConfig>) {
    this.storageDir = storageDir;
    this.filesDir = path.join(storageDir, 'files');
    this.metadataPath = path.join(storageDir, 'metadata.json');
    this.indexPath = path.join(storageDir, 'index.json');
    this.languages = languages;
  }
  
  initialize(): void {
    // Create directories if they don't exist
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.filesDir)) {
      fs.mkdirSync(this.filesDir, { recursive: true });
    }
    
    // Load index if it exists
    if (fs.existsSync(this.indexPath)) {
      const indexData = fs.readFileSync(this.indexPath, 'utf-8');
      this.fileIndex = new Map(JSON.parse(indexData));
    }
    
    // Initialize metadata if it doesn't exist
    if (!fs.existsSync(this.metadataPath)) {
      this.saveMetadata(createEmptyState(this.languages));
    }
  }
  
  getState(): ProjectState {
    // Load metadata
    const metadata = this.loadMetadata();
    
    // Create state with lazy-loaded file data
    const state: ProjectState = {
      ...metadata,
      file_graphs: new Map(),
      file_cache: new Map()
    };
    
    // Load all files from index
    for (const [filePath, hash] of this.fileIndex) {
      const fileData = this.loadFileData(hash);
      if (fileData) {
        state.file_cache.set(filePath, fileData.cache);
        state.file_graphs.set(filePath, fileData.graph);
      }
    }
    
    return state;
  }
  
  setState(state: ProjectState): void {
    // Clear existing files
    this.clear();
    
    // Save metadata
    this.saveMetadata(state);
    
    // Save each file
    for (const [filePath, cache] of state.file_cache) {
      const graph = state.file_graphs.get(filePath);
      if (graph) {
        this.saveFile(filePath, cache, graph);
      }
    }
  }
  
  beginTransaction(): StorageTransactionSync {
    return new DiskStorageTransaction(this, this.getState());
  }
  
  getFileCache(filePath: string): StoredFileCache | undefined {
    const hash = this.fileIndex.get(filePath);
    if (!hash) return undefined;
    
    const fileData = this.loadFileData(hash);
    return fileData?.cache;
  }
  
  getFileGraph(filePath: string): ScopeGraph | undefined {
    const hash = this.fileIndex.get(filePath);
    if (!hash) return undefined;
    
    const fileData = this.loadFileData(hash);
    return fileData?.graph;
  }
  
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): void {
    this.saveFile(filePath, fileCache, scopeGraph);
  }
  
  removeFile(filePath: string): void {
    const hash = this.fileIndex.get(filePath);
    if (hash) {
      // Remove file data
      const filePath = path.join(this.filesDir, `${hash}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Update index
      this.fileIndex.delete(filePath);
      this.saveIndex();
    }
  }
  
  getFilePaths(): string[] {
    return Array.from(this.fileIndex.keys());
  }
  
  hasFile(filePath: string): boolean {
    return this.fileIndex.has(filePath);
  }
  
  clear(): void {
    // Remove all files
    if (fs.existsSync(this.filesDir)) {
      const files = fs.readdirSync(this.filesDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.filesDir, file));
      }
    }
    
    // Clear index
    this.fileIndex.clear();
    this.saveIndex();
    
    // Reset metadata
    this.saveMetadata(createEmptyState(this.languages));
  }
  
  close(): void {
    // Save index before closing
    this.saveIndex();
  }
  
  /**
   * Apply transaction state (internal method)
   */
  applyTransaction(newState: ProjectState): void {
    this.setState(newState);
  }
  
  private saveFile(filePath: string, cache: StoredFileCache, graph: ScopeGraph): void {
    // Generate hash for file
    const hash = this.generateHash(filePath);
    
    // Serialize file data
    const fileData = {
      cache: {
        source_code: cache.source_code,
        // Note: We can't serialize tree-sitter Tree objects directly
        // In a real implementation, you'd need to handle this appropriately
        tree: null,
        graph: null
      },
      graph: this.serializeGraph(graph)
    };
    
    // Write to disk
    const dataPath = path.join(this.filesDir, `${hash}.json`);
    fs.writeFileSync(dataPath, JSON.stringify(fileData, null, 2));
    
    // Update index
    this.fileIndex.set(filePath, hash);
    this.saveIndex();
  }
  
  private loadFileData(hash: string): { cache: StoredFileCache; graph: ScopeGraph } | null {
    const dataPath = path.join(this.filesDir, `${hash}.json`);
    if (!fs.existsSync(dataPath)) return null;
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    // Deserialize graph
    const graph = this.deserializeGraph(data.graph);
    
    // Note: In a real implementation, you'd need to reparse the tree
    // from source_code when needed
    
    return {
      cache: data.cache as StoredFileCache,
      graph
    };
  }
  
  private saveMetadata(state: ProjectState): void {
    const metadata = {
      languages: Array.from(state.languages.keys()),
      inheritance_map: Array.from(state.inheritance_map.entries()),
      call_graph_data: {
        // Simplified - in reality you'd need proper serialization
        fileTypeTrackers: Array.from(state.call_graph_data.fileTypeTrackers.keys())
      }
    };
    
    fs.writeFileSync(this.metadataPath, JSON.stringify(metadata, null, 2));
  }
  
  private loadMetadata(): ProjectState {
    if (!fs.existsSync(this.metadataPath)) {
      return createEmptyState(this.languages);
    }
    
    const metadata = JSON.parse(fs.readFileSync(this.metadataPath, 'utf-8'));
    
    // Reconstruct state from metadata
    const state = createEmptyState(this.languages);
    
    // Restore inheritance map
    if (metadata.inheritance_map) {
      state.inheritance_map = new Map(metadata.inheritance_map);
    }
    
    return state;
  }
  
  private saveIndex(): void {
    const indexData = Array.from(this.fileIndex.entries());
    fs.writeFileSync(this.indexPath, JSON.stringify(indexData, null, 2));
  }
  
  private generateHash(filePath: string): string {
    return crypto.createHash('sha256').update(filePath).digest('hex').substring(0, 16);
  }
  
  private serializeGraph(graph: ScopeGraph): any {
    // Simplified serialization - in a real implementation,
    // you'd need to properly serialize the graph structure
    return {
      nodes: (graph as any).nodes || [],
      edges: (graph as any).edges || [],
      lang: (graph as any).lang || 'unknown'
    };
  }
  
  private deserializeGraph(data: any): ScopeGraph {
    // Simplified deserialization - in a real implementation,
    // you'd need to properly reconstruct the graph
    const graph = {} as ScopeGraph;
    Object.assign(graph, data);
    return graph;
  }
}

/**
 * Disk storage transaction
 */
class DiskStorageTransaction implements StorageTransactionSync {
  private transactionState: ProjectState;
  private committed = false;
  private rolledBack = false;
  
  constructor(
    private readonly storage: DiskStorage,
    initialState: ProjectState
  ) {
    this.transactionState = this.cloneState(initialState);
  }
  
  getState(): ProjectState {
    this.checkValid();
    return this.transactionState;
  }
  
  setState(state: ProjectState): void {
    this.checkValid();
    this.transactionState = state;
  }
  
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): void {
    this.checkValid();
    this.transactionState = updateFileInState(
      this.transactionState,
      filePath,
      fileCache,
      scopeGraph
    );
  }
  
  removeFile(filePath: string): void {
    this.checkValid();
    this.transactionState = removeFileFromState(this.transactionState, filePath);
  }
  
  commit(): void {
    this.checkValid();
    this.storage.applyTransaction(this.transactionState);
    this.committed = true;
  }
  
  rollback(): void {
    this.checkValid();
    this.rolledBack = true;
  }
  
  private checkValid(): void {
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already completed');
    }
  }
  
  private cloneState(state: ProjectState): ProjectState {
    return {
      file_graphs: new Map(state.file_graphs),
      file_cache: new Map(state.file_cache),
      languages: state.languages,
      inheritance_map: new Map(state.inheritance_map),
      call_graph_data: {
        ...state.call_graph_data,
        fileGraphs: new Map(state.call_graph_data.fileGraphs),
        fileCache: new Map(state.call_graph_data.fileCache),
        fileTypeTrackers: new Map(state.call_graph_data.fileTypeTrackers)
      }
    };
  }
}

/**
 * Register the disk storage provider
 */
import { registerStorageProvider } from '../storage_interface';
import { SyncToAsyncStorageAdapter } from '../storage_interface_sync';

registerStorageProvider('disk', async (options?: { 
  storageDir?: string, 
  languages?: ReadonlyMap<string, LanguageConfig> 
}) => {
  const storageDir = options?.storageDir || './.ariadne-storage';
  const languages = options?.languages || new Map();
  const diskStorage = new DiskStorage(storageDir, languages);
  return new SyncToAsyncStorageAdapter(diskStorage);
});