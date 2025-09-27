import { createStore, set, get, del, entries } from "idb-keyval";
import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState, BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types";

// 每个 xmind 文件以 name 作为 key，value 是 { elements, appState, files }
export interface XMindFileData {
  name: string;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  created: number;
  updated: number;
}

const xmindFilesStore = createStore("xmind-files-db", "xmind-files-store");

export class MulitpleDBFileManager {
  // 保存或更新一个 xmind 文件
  static async saveXMindFile({
    name,
    elements,
    appState,
    files,
  }: {
    name: string;
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  }) {
    const now = Date.now();
    const old = await get<XMindFileData>(name, xmindFilesStore);
    const data: XMindFileData = {
      name,
      elements,
      appState,
      files,
      created: old?.created || now,
      updated: now,
    };
    await set(name, data, xmindFilesStore);
  }

  // 读取一个 xmind 文件
  static async loadXMindFile(name: string): Promise<XMindFileData | null> {
    return (await get<XMindFileData>(name, xmindFilesStore)) || null;
  }

  // 删除一个 xmind 文件
  static async deleteXMindFile(name: string) {
    await del(name, xmindFilesStore);
  }

  // 获取所有 xmind 文件的元信息（不含大数据）
  static async listXMindFiles(): Promise<Pick<XMindFileData, "name" | "created" | "updated">[]> {
    const all = await entries(xmindFilesStore);
    return all.map(([key, value]) => {
      const v = value as XMindFileData;
      return { name: v.name, created: v.created, updated: v.updated };
    });
  }

  // 重命名 xmind 文件
  static async renameXMindFile(oldName: string, newName: string) {
    // 检查新名称是否已存在
    const existingFile = await get<XMindFileData>(newName, xmindFilesStore);
    if (existingFile) {
      throw new Error("画板名称已存在");
    }

    // 获取旧文件数据
    const oldFileData = await get<XMindFileData>(oldName, xmindFilesStore);
    if (!oldFileData) {
      throw new Error("原画板不存在");
    }

    // 用新名称保存数据
    const newFileData: XMindFileData = {
      ...oldFileData,
      name: newName,
      updated: Date.now(),
    };
    await set(newName, newFileData, xmindFilesStore);

    // 删除旧数据
    await del(oldName, xmindFilesStore);
  }
}
