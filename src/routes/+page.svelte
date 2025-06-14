<script lang="ts">
    import {onMount} from "svelte";
    import * as editorService from '$lib/editorService';
    import * as fileManager from '$lib/fileManager';
    import {confirm} from '@tauri-apps/plugin-dialog';

    // Define the component's props with TypeScript
    let {class: className = ''} = $props<{ class?: string }>();

    // This will hold the reference to the <div> element
    let editorEl: HTMLElement;

    // Track the currently open file and list of notes using Svelte 5 $state
    let currentFile = $state<string | null>(null);
    let notesList = $state<string[]>([]);
    let showNewNoteDialog = $state(false);
    let newNoteTitle = $state('');

    onMount(async () => {
        // Initialize the editor once the component is mounted to the DOM
        try {
            await editorService.initializeEditor(editorEl);
            // Load the list of notes
            await loadNotesList();
        } catch (error) {
            console.error("Failed to initialize EditorJS:", error);
        }
    });

    async function loadNotesList(): Promise<void> {
        try {
            notesList = await fileManager.listNotes();
        } catch (error) {
            console.error("Failed to load notes list:", error);
        }
    }

    async function handleSave(): Promise<void> {
        if (!currentFile) {
            console.warn("No file is currently open");
            return;
        }

        const outputData = await editorService.save();
        // Only write the file if save() returned data
        if (outputData) {
            await fileManager.writeFile(currentFile, outputData);
        }
    }

    async function openNote(fileName: string): Promise<void> {
        const editorData = await fileManager.readFile(fileName);
        // Only render if readFile returned data
        if (editorData) {
            await editorService.render(editorData);
            currentFile = fileName;
        }
    }

    function showCreateDialog() {
        showNewNoteDialog = true;
        newNoteTitle = '';
    }

    function hideCreateDialog() {
        showNewNoteDialog = false;
        newNoteTitle = '';
    }

    async function createNewNote() {
        if (!newNoteTitle.trim()) {
            return;
        }

        const fileName = `${newNoteTitle.trim()}.json`;

        // Check if file already exists
        if (notesList.includes(fileName)) {
            alert('A note with that title already exists!');
            return;
        }

        // Clear the editor and create empty content
        await editorService.clearEditor();

        // Set as current file
        currentFile = fileName;

        // Save empty content to create the file
        const outputData = await editorService.save();
        if (outputData) {
            await fileManager.writeFile(fileName, outputData);
            // Refresh the notes list
            await loadNotesList();
        }

        hideCreateDialog();
    }

    function handleKeyDown(event: KeyboardEvent, action: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            action();
        }
    }

    function handleNewNoteKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            createNewNote();
        } else if (event.key === 'Escape') {
            hideCreateDialog();
        }
    }

    // Helper function to get display name (remove .json extension)
    function getDisplayName(fileName: string): string {
        return fileName.replace('.json', '');
    }
</script>

<div class="flex h-screen">
    <!-- Notes List Sidebar -->
    <div class="w-64 bg-gray-100 p-4 overflow-y-auto">


        <div class="space-y-2">
            {#each notesList as note}
                <button
                        class="w-full p-3 bg-white rounded shadow text-left hover:bg-blue-50 transition-colors
                           {currentFile === note ? 'bg-blue-100 border-l-4 border-blue-500' : ''}"
                        onclick={() => openNote(note)}
                        onkeydown={(e) => handleKeyDown(e, () => openNote(note))}
                        type="button"
                >
                    {getDisplayName(note)}
                </button>
            {/each}
            <button
                    class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                    onclick={showCreateDialog}
            >
                New
            </button>
        </div>

    </div>


    <div class="flex-1 flex flex-col">
        <!-- Editor Container -->
        <div bg-gray-50 bind:this={editorEl} border-t class="flex-1 p-4 {className}" flex gap-2 p-4 style="visibility: {currentFile ? 'visible' : 'hidden'}"></div>

    <div class="
        ">
        <button
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:bg-gray-300"
                disabled={!currentFile}
                onclick={handleSave}
                type="button"
        >
            Save {currentFile ? `(${getDisplayName(currentFile)})` : ''}
        </button>



        {#if currentFile}
                <span class="px-4 py-2 bg-blue-100 text-blue-800 rounded">
                    Editing: {getDisplayName(currentFile)}
                </span>
        {/if}
    </div>
</div>
</div>

<!-- New Note Dialog -->
{#if showNewNoteDialog}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 class="text-lg font-semibold mb-4">Create New Note</h3>

            <input
                    type="text"
                    placeholder="Enter note title..."
                    class="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    bind:value={newNoteTitle}
                    onkeydown={handleNewNoteKeyDown}
                    autofocus
            />

            <div class="flex gap-2 justify-end">
                <button
                        class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                        onclick={hideCreateDialog}
                        type="button"
                >
                    Cancel
                </button>

                <button
                        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-gray-300"
                        onclick={createNewNote}
                        disabled={!newNoteTitle.trim()}
                        type="button"
                >
                    Create
                </button>


            </div>
        </div>
    </div>
{/if}