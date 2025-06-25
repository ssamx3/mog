import * as fileManager from '$lib/fileManager';
import { toast } from 'svelte-sonner';

export let notesList = $state<string[]>([]);
export let foldersList = $state<string[]>([]);

export async function loadNotesList(currentFolder: string): Promise<void> {
    try {
        const { noteFiles, folders } = await fileManager.listAll(currentFolder);
        notesList.length = 0;
        notesList.push(...noteFiles);
        foldersList.length = 0;
        foldersList.push(...folders);

    } catch (error) {
        console.error("Failed to load notes list:", error);
        toast.error("Failed to load notes.");
    }
}