import * as vscode from "vscode";

export class WorkspaceState {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Save workspace-specific data
   * @param key The key to store the value under
   * @param value The value to store
   */
  async saveWorkspaceData(key: string, value: unknown): Promise<void> {
    await this.context.workspaceState.update(key, value);
  }

  /**
   * Get workspace-specific data
   * @param key The key to retrieve
   * @param defaultValue The default value if the key doesn't exist
   * @returns The value associated with the key or the default value
   */
  getWorkspaceData<T>(key: string, defaultValue?: T): T | undefined {
    return this.context.workspaceState.get(key, defaultValue);
  }

  /**
   * Upsert docs and return any updated entries
   * @param newDocs - Map of document identifiers to their content
   * @returns A map of updated components with new content
   */
  async getUpdatedDocs(newDocs: Record<string, string>): Promise<Record<string, string>> {
    const storedDocs: Record<string, string> = this.getWorkspaceData<Record<string, string>>("docs", {}) || {};
    const updated: Record<string, string> = {};
    for (const [key, value] of Object.entries(newDocs)) {
      const existing = storedDocs[key];
      if (existing === undefined) {
        storedDocs[key] = value;
        updated[key] = value;
      } else if (existing !== value) {
        storedDocs[key] = value;
        updated[key] = value;
      }
    }
    await this.saveWorkspaceData("docs", storedDocs);
    return updated;
  }
}
