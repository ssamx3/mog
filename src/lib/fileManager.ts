import {
    writeTextFile,
    readTextFile,
    readDir,
    BaseDirectory,
    type FileEntry,
    remove,
    mkdir
} from '@tauri-apps/plugin-fs';
import type { OutputData } from '@editorjs/editorjs';

const FILE_OPTIONS = { baseDir: BaseDirectory.AppData };
const FOLDER_NAME = 'mogNotes';

export async function checkFolderExists(): Promise<void> {
    try {
        await readDir(FOLDER_NAME, FILE_OPTIONS);
    } catch(error) {
        try  {
            await mkdir(FOLDER_NAME, { baseDir: BaseDirectory.AppData, recursive: true});
            console.log('created!')
        } catch(creationError) {
            console.log('oops!', creationError)
        }
    }
}

export async function listNotes(): Promise<string[]> {
    try {
        const entries: FileEntry[] = await readDir(FOLDER_NAME, FILE_OPTIONS);
        const noteFiles = entries
            .filter(entry => entry.name?.endsWith('.json') && entry.children === undefined)
            .map(entry => entry.name!);

        return noteFiles;
    } catch (error) {
    }
}


export async function listAll(): Promise<string[]> {
    try {
        const entries: FileEntry[] = await readDir(FOLDER_NAME, FILE_OPTIONS);
        const noteFiles = entries
            .map(entry => entry.name!);

        console.log(noteFiles);
        return noteFiles;
    } catch (error) {
        console.log(noteFiles);
        console.warn("Could not read notes directory (it may not exist yet):", error);
        return [];
    }
}



export async function writeFile(fileName: string, data: OutputData): Promise<void> {
    try {
        const path = `${FOLDER_NAME}/${fileName}`;
        await writeTextFile(path, JSON.stringify(data, null, 2), FILE_OPTIONS);
        console.log(`Successfully saved to Desktop/${path}`);
    } catch (error) {
        console.error('Error writing file:', error);
    }
}

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

export async function deleteFile(fileName: string): Promise<void> {
    try {
        const path = `${FOLDER_NAME}/${fileName}`;
        await remove(path, FILE_OPTIONS);
        console.log(`Successfully deleted Desktop/${path}`);
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}