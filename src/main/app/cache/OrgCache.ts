import { BlueHqAnyUrlResp, OrgCacheElement } from "../../../../types";
import { BlueHQ } from "../../resources/constants";
import { Http, Numerical } from "../../resources/constants";
import { App } from "../App";
import type { SESSION_MANAGER } from "../b6p_session/SessionManager";
import { ContextNode } from "../context/ContextNode";
import { OrgWorker } from "../util/data/OrgWorker";
import { Err } from "../util/Err";
import { PublicKeys, PublicPersistanceMap } from "../util/PseudoMaps";
import { Alert } from "../util/ui/Alert";


/**
 * A cache of org URLs associated with U values.
 * 
 * This is a singleton;
 */
export const ORG_CACHE = new class extends ContextNode {
  _parent: typeof SESSION_MANAGER | null = null;
  private _orgCache: PublicPersistanceMap<OrgCacheElement[]> | null = null;
  init(parent: typeof SESSION_MANAGER): this {
    this._parent = parent;
    this._orgCache = new PublicPersistanceMap(PublicKeys.U_CACHE, this.context);
    this.cleanupOldEntries();
    return this;
  }

  public map(): PublicPersistanceMap<OrgCacheElement[]> {
    if (!this._orgCache) {
      throw new Error("OrgCache not initialized; call init() first.");
    }
    return this._orgCache;
  }

  public async delete(u: string): Promise<void> {
    this.map().delete(u);
    await this.map().store();
  }

  public get parent(): typeof SESSION_MANAGER {
    if (!this._parent) {
      throw new Error("OrgCache not initialized; call init() first.");
    }
    return this._parent;
  }

  public get context() {
    return this.parent.context;
  }

  /**
   * Cleans up entries that have not been accessed in the last 3 days.
   * If the cache is not initialized, throws an error.
   * We call this on initialization, but it can be called manually as well.
   */
  private cleanupOldEntries() {
    if (!this._orgCache) {
      throw new Error("OrgCache not initialized; call init() first.");
    }
    const now = Date.now();
    const cutoff = now - Numerical.millisecondsInXDays(3); // 3 days ago
    for (const [u, elementArray] of this._orgCache) {
      const filteredArray = elementArray.filter(element => element.lastAccess >= cutoff);
      if (filteredArray.length === 0) {
        this._orgCache.delete(u);
      } else if (filteredArray.length < elementArray.length) {
        this._orgCache.set(u, filteredArray);
      }
    }
    this.map().store();
    // we schedule the next cleanup in 24 hours; this should really never happen unless the extension is left running for a long time
    setTimeout(() => this.cleanupOldEntries(), Numerical.millisecondsInXDays(1)); // schedule next cleanup in 24 hours
  }

  /**
   * Validates the cache to ensure no duplicate hosts exist.
   * If throwIfDuplicateExists is true, will throw an error if duplicates are found.
   * otherwise it will clear all entries with duplicate hosts.
   */
  private cleanDuplicates(throwIfDuplicateExists = false) {
    const uniqueHosts = new Set<string>();
    for (const [u, elementArray] of this.map()) {
      for (const element of elementArray) {
        if (uniqueHosts.has(element.host)) {
          if (throwIfDuplicateExists) {
            App.isDebugMode() && console.error(`OrgCache contains duplicate host ${element.host}`, this.map().toJSON());
            Alert.popup(`OrgCache is invalid!`);
            throw new Err.AlreadyAlertedError(`OrgCache contains duplicate host ${element.host}`);
          } else {
            this.map().delete(u);
            let foundU: string | null = null;
            while (foundU = this.findUCacheOnly(new URL(Http.Schemes.HTTPS + element.host))) {
              App.logger.info(`OrgCache contained duplicate host ${element.host}. Cleared U ${foundU}`);
              this.map().delete(foundU);
            }
            this.map().store();
            console.warn(`OrgCache contained duplicate host ${element.host}. Cleared all Us`);
          }
        }
        uniqueHosts.add(element.host);
      }
    }
  }

  /**
   * Hard-validates all entries in the cache by calling the orgs to verify the U-host association.
   */
  public async hardValidateAll(): Promise<void> {
    this.cleanDuplicates(true);
    for (const u of this.map().keys()) {
      await this.hardValidateU(u);
    }
  }

  /**
   * Hard-validates an individual U by ensuring each known host connects to the same U.
   * 
   * Will simply clean up unvalidated hosts.
   */
  public async hardValidateU(u: string): Promise<void> {
    const elementArr = this.map().get(u);
    if (!elementArr) {
      return; // it is vacuously in a good state
    }
    const removalSet = new Set<string>();
    for (const element of elementArr) {
      const orgWorker = OrgWorker.fromHost(element.host);
      if (!await orgWorker.verifyU(u)) {
        App.isDebugMode() && console.error(`OrgCache entry for U ${u} with host ${element.host} is invalid`, this.map().toJSON());
        removalSet.add(element.host);
      }
    }
    if (removalSet.size > 0) {
      const newElementArr = elementArr.filter(element => !removalSet.has(element.host));
      if (newElementArr.length === 0) {
        this.map().delete(u);
      } else {
        this.map().set(u, newElementArr);
      }
      await this.map().store();
    }
  }

  /**
   * Gets the first available URL associated with the given U from the cache.
   * If none exists, will call the BlueHQ helper to get any domain associated with the U,
   * adding it to the cache before returning it.
   */
  public async getAnyBaseUrl(u: string): Promise<URL> {
    this.cleanDuplicates();
    if (this.map().has(u)) {
      const cacheElement = this.map().get(u);
      if (cacheElement && cacheElement.length > 0) {
        //TODO optimize this such that we check session manager for a valid session for one of the hosts
        //TODO update last access time
        return new URL(Http.Schemes.HTTPS + cacheElement[0].host);
      }
    }

    const resp = await this.parent.fetch(BlueHQ.getAnyDomainUrl());
    if (!resp.ok) {
      throw new Err.BlueHqHelperEndpointError("Failed to fetch any domain from BlueHQ: " + resp.status + " " + resp.statusText);
    }
    const json = await resp.json() as BlueHqAnyUrlResp;
    const retUrl = new URL(json.orgUrl);
    this.map().set(u, [{ host: json.orgUrl, lastAccess: Date.now() }]);
    return retUrl;
  }

  /**
   * 
   * Associates a host with a U value in the cache, and updates the last access time if the host is already present.
   * 
   * @param u The U value to associate the host with
   * @param url the {@link URL} whose host to associate with the U
   */
  public async addHost(u: string, url: URL): Promise<void> {
    this.cleanDuplicates(false);
    const host = url.hostname;
    if (this.map().has(u)) {
      const elementArray = this.map().get(u);
      if (elementArray) {
        const existingElement = elementArray.find(element => element.host === host);
        if (!existingElement) {
          elementArray.push({ host, lastAccess: Date.now() });
        } else {
          existingElement.lastAccess = Date.now();
        }
        await this.map().set(u, elementArray);
        return;
      }
    }
    await this.map().set(u, [{ host, lastAccess: Date.now() }]);
  }

  /**
   * Clears the entire cache.
   */
  public async clearCache(): Promise<void> {
    await this.map().clear();
  }

  /**
   * Finds the U associated with the provided argument if it exists in the cache. 
   * 
   * If not, it will attempt call the org to get the U,
   * then adding the result to the cache before returning it.
   * @param url The URL or string to find the U for.
   * @param cacheOnly If true, will only look in the cache and not attempt to call the org.
   * @throws an {@link TypeError} if the URL is invalid
   * @throws an {@link Err.OrgWorkerError} if no cached U is found and cacheOnly is true.
   * @throws an {@link Err.BlueHqHelperEndpointError} if the lookup attempt fails.
   */
  public async findU(url: string | URL, cacheOnly = false): Promise<string> {
    url = new URL(url);
    const existingU = this.findUCacheOnly(url);
    if (existingU) {
      return existingU;
    } else if (cacheOnly) {
      throw new Err.OrgWorkerError(`No cached U found for URL: ${url.toString()}`);
    }
    const orgWorker = new OrgWorker(url);
    const U = await orgWorker.getU();
    await this.addHost(U, url);
    return U;
  }

  /**
   * Finds the U associated with the provided argument if it exists in the cache. 
   * @throws an {@link TypeError} if the URL is invalid
   * @returns 
   */
  public findUCacheOnly(url: URL): string | null {
    url = new URL(url);
    const newHostName = url.hostname;
    for (const [u, elementArray] of this.map()) {
      for (const element of elementArray) {
        if (newHostName === element.host) {
          element.lastAccess = Date.now();
          this.map().set(u, elementArray);
          return u;
        }
      }
    }
    return null;
  }
};