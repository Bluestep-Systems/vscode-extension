export abstract class Converter {
  abstract fromVersion: string;
  abstract toVersion: string;
  abstract convert(): Promise<void>;
}