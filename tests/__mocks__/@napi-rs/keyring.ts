// Jest manual mock for @napi-rs/keyring
// Simulates OS keychain Entry class with in-memory storage

const store = new Map<string, Map<string, string>>();
let available = true;

export function __resetStore(): void {
  store.clear();
  available = true;
}

export function __setAvailable(isAvailable: boolean): void {
  available = isAvailable;
}

export class Entry {
  private service: string;
  private account: string;

  constructor(service: string, account: string) {
    if (!available) {
      throw new Error("Keychain is not available");
    }
    this.service = service;
    this.account = account;
  }

  getPassword(): string | null {
    if (!available) {
      throw new Error("Keychain is not available");
    }
    const serviceStore = store.get(this.service);
    if (!serviceStore) return null;
    return serviceStore.get(this.account) ?? null;
  }

  setPassword(password: string): void {
    if (!available) {
      throw new Error("Keychain is not available");
    }
    if (!store.has(this.service)) {
      store.set(this.service, new Map());
    }
    store.get(this.service)!.set(this.account, password);
  }

  deletePassword(): void {
    if (!available) {
      throw new Error("Keychain is not available");
    }
    const serviceStore = store.get(this.service);
    if (!serviceStore || !serviceStore.has(this.account)) {
      throw new Error("Password not found");
    }
    serviceStore.delete(this.account);
  }
}
