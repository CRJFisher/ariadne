export {
  StorageInterface,
  StorageTransaction,
  ProjectState,
  StoredFileCache,
  StorageFactory,
  createStorage,
  registerStorageProvider,
  storageProviders
} from './storage_interface';

export {
  StorageInterfaceSync,
  StorageTransactionSync,
  SyncToAsyncStorageAdapter
} from './storage_interface_sync';

export {
  createEmptyState,
  updateFileInState,
  removeFileFromState,
  updateInheritanceInState,
  updateCallGraphDataInState,
  deepFreeze
} from './storage_utils';

export { InMemoryStorage } from './in_memory_storage';

// Import to register the provider
import './in_memory_storage';