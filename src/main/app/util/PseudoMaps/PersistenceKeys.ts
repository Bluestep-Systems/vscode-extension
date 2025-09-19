/**
 * Keys used for private persistance maps
 */
export enum PrivateKeys {
  /**
   * key for the data we persist for the basic auth map
   */
  BASIC_AUTH = 'b6p:basic_auth',

  /**
   * key for the data we persist for the existing sessions
   */
  SESSIONS = 'b6p:sessions',

  /**
   * key for the data we persist for the github keys map
   */
  GITHUB_KEYS = 'b6p:github_keys'
}

/**
 * Keys used for public persistance maps
 */
export enum PublicKeys {
  /**
   * Key for the data we persist for the GitHub state
   */
  GITHUB_STATE = 'b6p:github_state',
}