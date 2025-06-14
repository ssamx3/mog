// src/lib/fileManager.ts

import {
    writeTextFile,
    readTextFile,
    readDir, // <--- Import readDir
    BaseDirectory,
    type FileEntry // <--- Import the type for file entries
} from '@tauri-apps/plugin-fs';
import type { OutputData } from '@editorjs/editorjs';

const FILE_OPTIONS = { baseDir: BaseDirectory.Desktop };
const FOLDER_NAME = 'mogNotes';

/**
 * Lists all .json files in the 'mogNotes' directory on the desktop.
 * @returns A Promise resolving to an array of file names.
 */
export async function listNotes(): Promise<string[]> {
    try {
        // Read all entries in the 'mogNotes' directory
        const entries: FileEntry[] = await readDir(FOLDER_NAME, FILE_OPTIONS);

        // Filter for files that end with .json and map to just their names
        const noteFiles = entries
            .filter(entry => entry.name?.endsWith('.json') && entry.children === undefined) // Ensure it's a file, not a directory
            .map(entry => entry.name!); // The '!' asserts that name is not null here

        return noteFiles;
    } catch (error) {
        // This can happen if the 'mogNotes' directory doesn't exist yet.
        // It's safe to return an empty array in that case.
        console.warn("Could not read notes directory (it may not exist yet):", error);
        return [];
    }
}

/**
 * Writes EditorJS OutputData to a specified file inside the 'mogNotes' folder on the desktop.
 * @param fileName - The name of the file (e.g., 'document.json').
 * @param data - The OutputData object to write.
 */
export async function writeFile(fileName: string, data: OutputData): Promise<void> {
    try {
        const path = `${FOLDER_NAME}/${fileName}`;
        await writeTextFile(path, JSON.stringify(data, null, 2), FILE_OPTIONS);
        console.log(`Successfully saved to Desktop/${path}`);
    } catch (error) {
        console.error('Error writing file:', error);
    }
}

/**
 * Reads and parses a JSON file from the 'mogNotes' folder on the desktop.
 * @param fileName - The name of the file to read.
 * @returns A Promise resolving to the parsed OutputData, or null if an error occurs.
 */
export async function readFile(fileName:string): Promise<OutputData | null> {
    try {
        const path = `${FOLDER_NAME}/${fileName}`;
        const jsonString = await readTextFile(path, FILE_OPTIONS);
        const data = JSON.parse(jsonString) as OutputData;
        return data;
    } catch (error) {
        console.error('Error reading or parsing file:', error);
        return null;
    }
}