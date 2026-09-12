import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';

export interface ParsedMarkdown {
  html: string;
  links: string[];
}

export interface VaultInfo {
  path: string;
  files: string[];
}

export interface LinkMap {
  forward: Record<string, string[]>;
  backlinks: Record<string, string[]>;
}

export async function readVault(path: string): Promise<VaultInfo> {
  return invoke('read_vault', { path });
}

export async function readFile(name: string): Promise<string> {
  return invoke('read_file', { name });
}

export async function writeFile(name: string, content: string): Promise<void> {
  return invoke('write_file', { name, content });
}

export async function parseMarkdown(text: string): Promise<ParsedMarkdown> {
  return invoke('parse_markdown_cmd', { text });
}

export async function getBacklinks(name: string): Promise<string[]> {
  return invoke('get_backlinks', { name });
}

export async function getAllFiles(): Promise<string[]> {
  return invoke('get_all_files');
}

export async function createFile(name: string): Promise<void> {
  return invoke('create_file', { name });
}

export async function deleteFile(name: string): Promise<void> {
  return invoke('delete_file', { name });
}

export async function renameFile(oldName: string, newName: string): Promise<void> {
  return invoke('rename_file', { old: oldName, new: newName });
}

export async function selectVaultFolder(): Promise<string | null> {
  return invoke('select_vault_folder');
}

export async function confirmDialog(message: string): Promise<boolean> {
  try {
    return await confirm(message, { title: 'Quartzite', kind: 'warning' });
  } catch (err) {
    console.error('Native dialog failed, falling back to window.confirm:', err);
    return window.confirm(message);
  }
}