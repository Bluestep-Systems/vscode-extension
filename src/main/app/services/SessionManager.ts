import { PrivateKeys, PrivatePersistanceMap } from "../util/data/PseudoMaps";

export default class SessionManager {
  private static instance: SessionManager | null = null;
  static sessionData: PrivatePersistanceMap<any> = new PrivatePersistanceMap(PrivateKeys.SESSIONS);
  private constructor() {
    // Initialize session data
  }

  public static getInstance(): SessionManager {
    if (this.instance === null) {
      this.instance = new SessionManager();
    }
    return this.instance;
  }

  public startSession() {
    // Start a new session
  }

  public endSession() {
    // End the current session
  }
}
