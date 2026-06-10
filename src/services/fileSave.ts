import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

export type FileSaveResult =
  | { status: "saved" }
  | { status: "cancelled" }
  | { status: "dialogError"; error: string }
  | { status: "writeError"; error: string };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function saveTextFile(fileName: string, text: string) {
  let selectedPath: string | null;
  try {
    selectedPath = await save({
      defaultPath: fileName,
      filters: [{ name: "Text", extensions: ["txt", "json"] }],
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Failed to open save dialog", error);
    return { status: "dialogError" as const, error: message };
  }

  if (!selectedPath) return { status: "cancelled" as const };

  try {
    await writeTextFile(selectedPath, text);
    return { status: "saved" as const };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`Failed to write text file to ${selectedPath}`, error);
    return { status: "writeError" as const, error: message };
  }
}

export async function saveBinaryFile(
  fileName: string,
  bytes: Uint8Array,
  filters = [{ name: "PDF", extensions: ["pdf"] }],
): Promise<FileSaveResult> {
  let selectedPath: string | null;
  try {
    selectedPath = await save({
      defaultPath: fileName,
      filters,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Failed to open save dialog", error);
    return { status: "dialogError", error: message };
  }

  if (!selectedPath) return { status: "cancelled" };

  try {
    await writeFile(selectedPath, bytes);
    return { status: "saved" };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`Failed to write binary file to ${selectedPath}`, error);
    return { status: "writeError", error: message };
  }
}
