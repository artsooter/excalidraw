import React, { useState, useEffect } from "react";
import { Button } from "@excalidraw/excalidraw";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import clsx from "clsx";
import { MulitpleDBFileManager } from "../data/multipleDBFileManager";
import { importFromLocalStorage } from "../data/localStorage";
import { loadFromBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface FileListItem {
  name: string;
  created: number;
  updated: number;
}

interface OpenDBFileButtonProps {
  excalidrawAPI?: ExcalidrawImperativeAPI;
}

const OpenDBFileButton: React.FC<OpenDBFileButtonProps> = ({ excalidrawAPI }) => {
  const [open, setOpen] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [fileName, setFileName] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fileList, setFileList] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取画板列表
  const loadFileList = async () => {
    try {
      const files = await MulitpleDBFileManager.listXMindFiles();
      setFileList(files.sort((a, b) => a.created - b.created)); // 按创建顺序
    } catch (e) {
      console.error("Failed to load file list:", e);
    }
  };

  // 打开弹窗时加载画板列表
  useEffect(() => {
    if (open) {
      loadFileList();
    }
  }, [open]);

  const handleClick = async () => {
    setOpen(true);
    console.log(fileName)
  };

  // 保存当前画板
  const saveCurrentFile = async (name: string) => {
    setSaving(true);
    setError("");
    try {
      const { elements, appState } = importFromLocalStorage();
      await MulitpleDBFileManager.saveXMindFile({
        name,
        elements,
        appState: appState || ({} as any),
        files: {}, // localStorage 里没有 files，先存空对象
      });
      return true;
    } catch (e) {
      setError("保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 保存当前localStorage内容到indexDB，key为localStorage的excalidraw-name
  const saveCurrentLocalToDB = async () => {
    const currentName = localStorage.getItem("excalidraw-name");
    if (currentName) {
      await saveCurrentFile(currentName);
    }
  };

  // 打开画板
  const handleOpenFile = async (fileName: string) => {
    setLoading(true);
    setError("");
    try {
      // 先保存当前localStorage内容到indexDB
      await saveCurrentLocalToDB();

      const fileData = await MulitpleDBFileManager.loadXMindFile(fileName);
      if (!fileData) {
        setError("画板不存在");
        return;
      }

      // 创建Blob对象来模拟画板
      const jsonString = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: fileData.elements,
        appState: fileData.appState,
        files: fileData.files,
      });

      const blob = new Blob([jsonString], { type: "application/json" });
      const file = new File([blob], `${fileName}.excalidraw`, { type: "application/json" });

      // 使用loadFromBlob加载画板
      const sceneData = await loadFromBlob(file, null, null);

      // 更新场景
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({
          elements: sceneData.elements,
          appState: sceneData.appState,
          captureUpdate: "IMMEDIATELY" as any,
        });
        // 添加画板
        if (sceneData.files && Object.keys(sceneData.files).length > 0) {
          const fileDataArray = Object.values(sceneData.files);
          excalidrawAPI.addFiles(fileDataArray);
        }
        // 保存画板名到 localStorage
        localStorage.setItem("excalidraw-name", fileName);
      }

      setOpen(false);
    } catch (e) {
      setError("打开画板失败");
      console.error("Failed to open file:", e);
    } finally {
      setLoading(false);
    }
  };

  // 创建新画板
  const handleCreateNewFile = async () => {
    if (!inputValue.trim()) {
      setError("请输入画板名");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // 先保存当前localStorage内容到indexDB
      await saveCurrentLocalToDB();

      // 先保存当前画板
      const saved = await saveCurrentFile(inputValue);
      if (!saved) {
        return;
      }

      // 清空画布创建新画板
      if (excalidrawAPI) {
        excalidrawAPI.resetScene();
      }


      setFileName(inputValue);
      localStorage.setItem("excalidraw-name", inputValue);      // 保存画板名到 localStorage
      setShowNameInput(false);
      setOpen(false);
      setInputValue("");

    } catch (e) {
      setError("创建新画板失败");
    } finally {
      setSaving(false);
    }
  };


  // 当前画板名
  const currentFileName = typeof window !== "undefined" ? localStorage.getItem("excalidraw-name") : undefined;

  return (
    <>
      <Button
        className={clsx("collab-button")}
        type="button"
        onSelect={handleClick}
        style={{ position: "relative", width: "auto" }}
        title="画板管理"
      >
        画板管理
      </Button>

      {/*画板管理 选择画板页面*/}
      {open && !showNameInput && (
        <Dialog
          title="画板管理"
          size="wide"
          onCloseRequest={() => setOpen(false)}
        >
          <div style={{ minHeight: "300px", display: "flex", flexDirection: "column" }}>
            {fileList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#666" }}>
                暂无保存的画板
              </div>
            ) : (
              <div style={{ flex: 1, marginBottom: "16px" }}>
                <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
                  已保存的画板：
                </div>
                <div style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "8px"
                }}>
                  {fileList.map((file) => (
                    <div
                      key={file.name}
                      onClick={() => handleOpenFile(file.name)}
                      style={{
                        padding: "8px",
                        borderBottom: "1px solid #eee",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontWeight: "500" }}>{file.name}</div>
                        {file.name === currentFileName && (
                          <span style={{
                            marginLeft: 8,
                            background: "#1890ff",
                            color: "#fff",
                            borderRadius: 4,
                            fontSize: 12,
                            padding: "2px 6px",
                            fontWeight: 500,
                          }}>
                            当前
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#999" }}>
                        点击打开
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid #eee", paddingTop: "16px" }}>
              <Button
                onSelect={() => setShowNameInput(true)}
                disabled={loading}
                style={{ width: "100%" }}
              >
                创建新画板
              </Button>
            </div>

            {error && <div style={{ color: "red", marginTop: "8px" }}>{error}</div>}
            {loading && <div style={{ color: "#666", marginTop: "8px" }}>正在加载...</div>}
          </div>
        </Dialog>
      )}

      {showNameInput && (
        <Dialog
          title="创建新画板"
          size="small"
          onCloseRequest={() => setShowNameInput(false)}
        >
          <div>
            <div style={{ marginBottom: "8px" }}>
              请输入新画板名：
            </div>
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="请输入画板名"
              style={{ width: "100%", marginBottom: "8px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                onSelect={handleCreateNewFile}
                disabled={!inputValue.trim() || saving}
                style={{ flex: 1 }}
              >
                {saving ? "保存中..." : "创建"}
              </Button>
              <Button
                onSelect={() => setShowNameInput(false)}
                style={{ flex: 1 }}
              >
                取消
              </Button>
            </div>
            {error && <div style={{ color: "red", marginTop: "8px" }}>{error}</div>}
          </div>
        </Dialog>
      )}
    </>
  );
};

export default OpenDBFileButton;
