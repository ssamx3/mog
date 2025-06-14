<script lang="ts">
    import {onMount} from "svelte";
    import * as editorService from '$lib/editorService';
    import * as fileManager from '$lib/fileManager';
    import {confirm} from '@tauri-apps/plugin-dialog';
    import '../app.css';


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

    async function handleDelete(): Promise<void> {
        if (!currentFile) {
            console.warn("No file is currently open");
            return;
        }

        const confirmed = await confirm('Are you sure you want to delete this note?', {
            title: 'Delete Note',
            type: 'warning'
        });

        if (confirmed) {
            await fileManager.deleteFile(currentFile);
            await editorService.clearEditor();
            currentFile = null;
            await loadNotesList();
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

    // Sanitize input to only allow alphanumeric characters and spaces
    function sanitizeInput(input: string): string {
        return input.replace(/[^a-zA-Z0-9\s]/g, '');
    }

    // Helper function to get display name (remove .json extension)
    function getDisplayName(fileName: string): string {
        return fileName.replace('.json', '');
    }
</script>


<div class="flex h-screen bg-[#191919]">
    <!-- Notes List Sidebar -->
    <div class="bg-[#202020] p-4 w-64 overflow-y-auto">


        <div class="space-y-2">
            {#each notesList as note}
                <button
                        class="w-full p-3 text-[#9b9b9b] rounded shadow text-left hover:bg-[#2c2c2c] transition-colors
                           {currentFile === note ? 'bg-[#2c2c2c]' : ''}"
                        onclick={() => openNote(note)}
                        onkeydown={(e) => handleKeyDown(e, () => openNote(note))}
                        type="button"
                >
                    {getDisplayName(note)}
                </button>
            {/each}
            <button
                    class="bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-white text-sm transition-colors"
                    onclick={showCreateDialog}
            >
                New
            </button>
        </div>

    </div>


    <div class="flex flex-col flex-1">
        <!-- Editor Container -->
        <div bg-gray-50 bind:this={editorEl} border-t class="flex-1 p-4 {className}" flex gap-2 p-4 style="visibility: {currentFile ? 'visible' : 'hidden'}"></div>

    <div class="
        ">
        <button
                class="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 px-4 py-2 rounded text-white transition-colors"
                disabled={!currentFile}
                onclick={handleSave}
                type="button"
        >
            Save {currentFile ? `(${getDisplayName(currentFile)})` : ''}
        </button>

        {#if currentFile}
            <button
                class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded text-white transition-colors"
                onclick={handleDelete}
                type="button"
            >
                Delete File
            </button>
            <span class="bg-blue-100 px-4 py-2 rounded text-blue-800">
                Editing: {getDisplayName(currentFile)}
            </span>
        {/if}
    </div>
</div>
</div>

<!-- New Note Dialog -->
{#if showNewNoteDialog}
    <div class="z-50 fixed inset-0 flex justify-center items-center bg-black bg-opacity-50">
        <div class="bg-white shadow-xl p-6 rounded-lg w-96">
            <h3 class="mb-4 font-semibold text-lg">Create New Note</h3>

            <input
                    type="text"
                    placeholder="Enter note title..."
                    class="mb-4 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    bind:value={newNoteTitle}
                    oninput={(e) => newNoteTitle = sanitizeInput(e.currentTarget.value)}
                    onkeydown={handleNewNoteKeyDown}
                    autofocus
            />

            <div class="flex justify-end gap-2">
                <button
                        class="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded text-gray-700 transition-colors"
                        onclick={hideCreateDialog}
                        type="button"
                >
                    Cancel
                </button>

                <button
                        class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 px-4 py-2 rounded text-white transition-colors"
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