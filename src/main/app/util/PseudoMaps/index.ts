// Re-export everything from core persistence layer
export {
  PseudoMap,
  TypedMap,
  Persistable,
  registerSerializable,
  revive,
  PrivateKeys,
  PublicKeys,
  PersistablePseudoMap,
  PublicPersistanceMap,
  PrivateGenericMap,
  TypedPersistable,
  PrivateTypedPersistable,
} from '../../../../core/persistence';
export type { SerializableClass, Serializable } from '../../../../core/persistence';

// SettingsWrapper remains in main/ (VS Code-specific)
export { SettingsWrapper } from "./SettingsWrapper";
