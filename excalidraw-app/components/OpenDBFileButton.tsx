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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFileName, setEditingFileName] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [showSaveCurrentDialog, setShowSaveCurrentDialog] = useState(false);
  const [saveCurrentValue, setSaveCurrentValue] = useState("");

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
    const currentName = localStorage.getItem("excalidraw-name");

    if (!currentName) {
      // 当前画板没有名称，先弹出保存对话框
      setShowSaveCurrentDialog(true);
    } else {
      // 有名称，直接打开画板管理
      setOpen(true);
    }
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


  // 重命名画板
  const handleRenameFile = async () => {
    if (!editingValue.trim()) {
      setError("请输入画板名");
      return;
    }

    if (editingValue === editingFileName) {
      setShowEditDialog(false);
      setEditingFileName("");
      setEditingValue("");
      setError("");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await MulitpleDBFileManager.renameXMindFile(editingFileName, editingValue);

      // 如果重命名的是当前画板，更新localStorage
      if (editingFileName === currentFileName) {
        localStorage.setItem("excalidraw-name", editingValue);
      }

      // 刷新画板列表
      await loadFileList();

      setShowEditDialog(false);
      setEditingFileName("");
      setEditingValue("");
    } catch (e: any) {
      setError(e.message || "重命名失败");
    } finally {
      setSaving(false);
    }
  };

  // 保存当前画板
  const handleSaveCurrentBoard = async () => {
    if (!saveCurrentValue.trim()) {
      setError("请输入画板名");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const saved = await saveCurrentFile(saveCurrentValue);
      if (saved) {
        localStorage.setItem("excalidraw-name", saveCurrentValue);
        setShowSaveCurrentDialog(false);
        setSaveCurrentValue("");
        setOpen(true); // 保存成功后打开画板管理
      }
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 重置画板
  const handleResetBoard = () => {
    if (window.confirm("确定要重置画板吗？当前内容将会丢失，此操作无法撤销。")) {
      if (excalidrawAPI) {
        excalidrawAPI.resetScene();
      }
      localStorage.removeItem("excalidraw-name");
      setShowSaveCurrentDialog(false);
      setSaveCurrentValue("");
      setOpen(true); // 重置后打开画板管理
    }
  };

  // 删除画板
  const handleDeleteFile = async (fileName: string) => {
    setLoading(true);
    setError("");
    try {
      await MulitpleDBFileManager.deleteXMindFile(fileName);

      // 如果删除的是当前画板，清空当前状态
      if (fileName === currentFileName) {
        if (excalidrawAPI) {
          excalidrawAPI.resetScene();
        }
        localStorage.removeItem("excalidraw-name");
      }

      // 刷新画板列表
      await loadFileList();
    } catch (e: any) {
      setError(e.message || "删除失败");
    } finally {
      setLoading(false);
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
                      style={{
                        padding: "8px",
                        borderBottom: "1px solid #eee",
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
                      <div
                        style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                        onClick={() => handleOpenFile(file.name)}
                      >
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: "12px", color: "#999" }}>
                          点击打开
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFileName(file.name);
                            setEditingValue(file.name);
                            setShowEditDialog(true);
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            background: "#fff",
                            cursor: "pointer",
                            color: "#666",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f0f0f0";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#fff";
                          }}
                        >
                          编辑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定要删除画板"${file.name}"吗？此操作无法撤销。`)) {
                              handleDeleteFile(file.name);
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            border: "1px solid #ff4d4f",
                            borderRadius: "4px",
                            background: "#fff",
                            cursor: "pointer",
                            color: "#ff4d4f",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#fff2f0";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#fff";
                          }}
                        >
                          删除
                        </button>
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

      {showEditDialog && (
        <Dialog
          title="编辑画板名称"
          size="small"
          onCloseRequest={() => {
            setShowEditDialog(false);
            setEditingFileName("");
            setEditingValue("");
            setError("");
          }}
        >
          <div>
            <div style={{ marginBottom: "8px" }}>
              当前名称：<span style={{ fontWeight: "bold" }}>{editingFileName}</span>
            </div>
            <div style={{ marginBottom: "8px" }}>
              新名称：
            </div>
            <input
              value={editingValue}
              onChange={e => setEditingValue(e.target.value)}
              placeholder="请输入新的画板名"
              style={{ width: "100%", marginBottom: "8px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                onSelect={handleRenameFile}
                disabled={!editingValue.trim() || saving}
                style={{ flex: 1 }}
              >
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button
                onSelect={() => {
                  setShowEditDialog(false);
                  setEditingFileName("");
                  setEditingValue("");
                  setError("");
                }}
                style={{ flex: 1 }}
              >
                取消
              </Button>
            </div>
            {error && <div style={{ color: "red", marginTop: "8px" }}>{error}</div>}
          </div>
        </Dialog>
      )}

      {showSaveCurrentDialog && (
        <Dialog
          title="保存当前画板"
          size="small"
          onCloseRequest={() => {
            setShowSaveCurrentDialog(false);
            setSaveCurrentValue("");
            setError("");
          }}
        >
          <div>
            <div style={{ marginBottom: "8px" }}>
              当前画板尚未保存，请输入名称：
            </div>
            <input
              value={saveCurrentValue}
              onChange={e => setSaveCurrentValue(e.target.value)}
              placeholder="请输入画板名"
              style={{ width: "100%", marginBottom: "8px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                onSelect={handleSaveCurrentBoard}
                disabled={!saveCurrentValue.trim() || saving}
                style={{ flex: 1 }}
              >
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button
                onSelect={handleResetBoard}
                disabled={saving}
                style={{ flex: 1, backgroundColor: "#ff4d4f", borderColor: "#ff4d4f" }}
              >
                重置画板
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
