import * as fs from "fs";

export class ReactiveService {
  protected filePath: string = "";
  protected watcher?: fs.FSWatcher;
  protected changeListeners: Array<() => void> = [];

  constructor() {
    this.initialize();
    this.watchFile();
  }

  public onFileChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index !== -1) this.changeListeners.splice(index, 1);
    };
  }

  public dispose() {
    this.watcher?.close();
    this.watcher = undefined;
    this.changeListeners = [];
  }

  protected initialize() {
    console.log("ReactiveService initialized", this.filePath);
  }

  protected watchFile() {
    if (!this.filePath) {
      return;
    }

    try {
      this.watcher = fs.watch(this.filePath, { persistent: false }, () => {
        this.initialize();
        this.notifyListeners();
      });
    } catch {
      // File doesn't exist yet - that's fine
    }
  }

  protected notifyListeners() {
    this.changeListeners.forEach((listener) => listener());
  }
}
