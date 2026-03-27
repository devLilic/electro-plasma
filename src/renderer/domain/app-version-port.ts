export interface AppVersionPort {
  getVersion(): Promise<string>
}
