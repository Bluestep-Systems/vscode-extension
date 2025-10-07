import { BlueHqAnyUrlResp } from "../../../../types";
import { BlueHQ } from "../../resources/constants";
import { HttpSchemes } from "../../resources/constants/HttpSchemes";
import type { SESSION_MANAGER } from "../b6p_session/SessionManager";
import { ContextNode } from "../context/ContextNode";
import { UpstairsUrlParser } from "../util/data/UpstairsUrlParser";
import { Err } from "../util/Err";
import { PublicKeys, PublicPersistanceMap } from "../util/PseudoMaps";

type OrgCacheElement = {
  /**
   * a list of known hosts for this org
   */
  host: string;

  /**
   * the last time this entry was accessed
   */
  lastAccess: number;
}
export const CACHE = new class extends ContextNode {
  _parent: typeof SESSION_MANAGER | null = null;
  private _orgCache: PublicPersistanceMap<OrgCacheElement[]> | null = null;
  init(parent: typeof SESSION_MANAGER): this {
    this._parent = parent;
    this._orgCache = new PublicPersistanceMap(PublicKeys.U_CACHE, this.context);
    return this;
  }

  public map(): PublicPersistanceMap<OrgCacheElement[]> {
    if (!this._orgCache) {
      throw new Error("OrgCache not initialized; call init() first.");
    }
    return this._orgCache;
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


  public async getAnyUrl(u: string): Promise<URL> {
    if (this.map().has(u)) {
      const cacheElement = this.map().get(u);
      if (cacheElement && cacheElement.length > 0) {
        return new URL(HttpSchemes.HTTPS + cacheElement[0].host);
      }
    }
    const resp = await this.parent.fetch(BlueHQ.ENDPOINT + "?action=getAnyDomain");
    if (!resp.ok) {
      throw new Err.BlueHqHelperEndpointError("Failed to fetch any domain from BlueHQ: " + resp.status + " " + resp.statusText);
    }
    const json = await resp.json() as BlueHqAnyUrlResp;
    const retUrl = new URL(json.orgUrl);
    this.map().set(u, [{ host: json.orgUrl, lastAccess: Date.now() }]);
    return retUrl;
  }

  public async addHost(u: string, url: URL): Promise<void> {
    const host = url.hostname;
    if (this.map().has(u)) {
      const cacheElement = this.map().get(u);
      if (cacheElement) {
        const existingElement = cacheElement.find(element => element.host === host);
        if (!existingElement) {
          cacheElement.push({ host, lastAccess: Date.now() });
        } else {
          existingElement.lastAccess = Date.now();
        }
        await this.map().set(u, cacheElement);
        return;
      }
    }
    await this.map().set(u, [{ host, lastAccess: Date.now() }]);
  }

  public async clearCache(): Promise<void> {
    await this.map().clear();
  }

  public async findU(url: string): Promise<string | null> {
    const newHostName = new URL(url).hostname;
    for (const [u, cacheElement] of this.map()) {
      for (const element of cacheElement) {
        if (newHostName === element.host) {
          element.lastAccess = Date.now();
          await this.map().set(u, cacheElement);
          return u;
        }
      }
    }
    const upstairsUrlParser = new UpstairsUrlParser(url);
    return await upstairsUrlParser.getU();
  }
};