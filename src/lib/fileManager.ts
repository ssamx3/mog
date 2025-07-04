// @ts-ignore
import {
    writeTextFile,
    readTextFile,
    readDir,
    rename,
    BaseDirectory,
    type FileEntry,
    remove,
    mkdir, stat
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

export async function listNotes(baseFolder: string): Promise<string[]> {
    try {
        const path = `${FOLDER_NAME}/${baseFolder}`;
        const entries: FileEntry[] = await readDir(path, FILE_OPTIONS);
        const noteFiles = entries
            .filter(entry => entry.name?.endsWith('.json') && entry.children === undefined)
            .map(entry => entry.name!);

        return noteFiles;
    } catch (error) {
        console.warn("Could not read notes directory (it may not exist yet):", error);
        return [];
    }
}

interface ListAllResult {
    noteFiles: string[];
    folders: string[];
}

export async function listAll(baseFolder: string): Promise<ListAllResult> {
    try {
        const path = `${FOLDER_NAME}/${baseFolder}`;
        const entries: FileEntry[] = await readDir(path, FILE_OPTIONS);


        const folders: string[] = [];
        const noteFiles: { name: string, time: number }[] = [];

        const fileReadPromises = entries.map(async (entry) => {
            if (entry.isDirectory) {
                folders.push(entry.name!);
            } else if (entry.name!.endsWith('.json')) {
                try {
                    const fileContent = await readTextFile(`${path}/${entry.name!}`, FILE_OPTIONS);
                    const noteData = JSON.parse(fileContent);
                    if (noteData && typeof noteData.time === 'number') {
                        noteFiles.push({ name: entry.name!, time: noteData.time });
                    } else {
                        noteFiles.push({ name: entry.name!, time: 0 });
                    }
                } catch (readError) {
                    console.error(`Error reading or parsing note file: ${entry.name!}`, readError);
                    noteFiles.push({ name: entry.name!, time: 0 });
                }
            }
        });

        await Promise.all(fileReadPromises);

        noteFiles.sort((a, b) => b.time - a.time);

        const sortedNoteFiles = noteFiles.map(note => note.name);

        return { noteFiles: sortedNoteFiles, folders };
    } catch (error) {
        console.warn("Could not read notes directory (it may not exist yet):", error);
        return { noteFiles: [], folders: [] };
    }
}



export async function writeFile(fileName: string, baseFolder: string, data: OutputData): Promise<void> {
    try {
        const path = `${FOLDER_NAME}/${baseFolder}/${fileName}`;
        await writeTextFile(path, JSON.stringify(data, null, 2), FILE_OPTIONS);
        console.log(`Successfully saved to Desktop/${path}`);
    } catch (error) {
        console.error('Error writing file:', error);
    }
}

export async function createFolder(folderName: string, baseFolder: string): Promise<void> {
    try {
        const path = `${FOLDER_NAME}/${baseFolder}/${folderName}`;
        await mkdir(path, { baseDir: BaseDirectory.AppData, recursive: true });
        console.log(`Successfully created folder ${path}`);
    } catch (error) {
        console.error('Error creating folder:', error);
    }
}

export async function deleteFolder(folderName: string, baseFolder: string): Promise<void> {
    try {
        const path = `${FOLDER_NAME}/${baseFolder}/${folderName}`;
        await remove(path, FILE_OPTIONS);
        console.log(`Successfully deleted folder ${path}`);
    } catch (error) {
        console.error('Error deleting folder:', error);
    }
}
export async function readFile(fileName:string, baseFolder: string): Promise<OutputData | null> {
    try {
        const path = `${FOLDER_NAME}/${baseFolder}/${fileName}`;
        const jsonString = await readTextFile(path, FILE_OPTIONS);
        const data = JSON.parse(jsonString) as OutputData;
        return data;
    } catch (error) {
        console.error('Error reading or parsing file:', error);
        return null;
    }
}

export async function deleteFile(fileName: string, baseFolder: string): Promise<void> {
    try {
        const path = `${FOLDER_NAME}/${baseFolder}/${fileName}`;
        await remove(path, FILE_OPTIONS);
        console.log(`Successfully deleted AppData/${path}`);
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

export async function renameFile(currentFileName: string, newFileName: string, baseFolder: string): Promise<void> {
    try {
        const oldPath = `${FOLDER_NAME}/${baseFolder}/${currentFileName}`;
        const newPath = `${FOLDER_NAME}/${baseFolder}/${newFileName}`;

        await rename(oldPath, newPath, FILE_OPTIONS);
        console.log(`Successfully renamed "${currentFileName}" to "${newFileName}"`);
    } catch (error) {
        console.error('Error renaming file "${currentFileName}" "${newFileName}"' , error);
        throw error;
    }
}

export async function renameFileByCopy(currentFileName: string, newFileName: string, baseFolder: string): Promise<void> {
    const oldPath = `${FOLDER_NAME}/${baseFolder}/${currentFileName}`;
    const newPath = `${FOLDER_NAME}/${baseFolder}/${newFileName}`;

    try {
        const content = await readTextFile(oldPath, FILE_OPTIONS);

        await writeTextFile(newPath, content, FILE_OPTIONS);

        await deleteFile(currentFileName,baseFolder);

        console.log(`Successfully renamed (by copy) "${currentFileName}" to "${newFileName}"`);

    } catch (error) {
        console.error(`Error during rename-by-copy for "${currentFileName}"`, error);
        throw error;
    }
}

export async function moveFile(currentFilePath: string, folderLocation: string, baseFolder: string): Promise<void> {
    let oldPath = ''
    let newPath = ''
    if (baseFolder === '') {
         oldPath = `${FOLDER_NAME}/${currentFilePath}`;
         newPath = `${FOLDER_NAME}/${folderLocation}/${currentFilePath}`;
    } else {
         oldPath = `${FOLDER_NAME}/${baseFolder}/${currentFilePath}`;
         newPath = `${FOLDER_NAME}/${baseFolder}/${folderLocation}/${currentFilePath}`;
    }

    try {
        const content = await readTextFile(oldPath, FILE_OPTIONS);
        await writeTextFile(newPath, content, FILE_OPTIONS);
        await deleteFile(currentFilePath,baseFolder);
        console.log(`Successfully moved "${currentFilePath}" to "${folderLocation}"`);
    } catch (error) {
        console.error(`Error during move for "${currentFilePath}"`, error);
        throw error;
    }
}

export interface NoteEntry {
    name: string;
    path: string;
}

export async function listAllNotesRecursively(currentPath: string = ''): Promise<NoteEntry[]> {
    const fullSearchPath = currentPath ? `${FOLDER_NAME}/${currentPath}` : FOLDER_NAME;
    let allNotes: NoteEntry[] = [];

    try {
        const entries = await readDir(fullSearchPath, FILE_OPTIONS);

        for (const entry of entries) {
            const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name!;
            if (entry.isDirectory) {
                allNotes.push(...await listAllNotesRecursively(newPath));
            } else if (entry.name?.endsWith('.json')) {
                allNotes.push({ name: entry.name, path: currentPath });
            }
        }
    } catch (error) {
        console.warn(`Could not read directory ${fullSearchPath}:`, error);
    }
    return allNotes;
}


