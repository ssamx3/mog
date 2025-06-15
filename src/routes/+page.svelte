<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import * as editorService from '$lib/editorService';
    import * as fileManager from '$lib/fileManager';
    import { setupAppMenu, updateMenuItemStates } from '$lib/menu';
    import { getCurrentWindow } from '@tauri-apps/api/window';
    import { confirm } from '@tauri-apps/plugin-dialog';
    import '../app.css';
    import { Toaster, toast } from 'svelte-sonner';
    import { Plus, StickyNote } from 'lucide-svelte';

    let editorEl: HTMLElement;
    let isSidebarVisible = $state(true);
    let currentFile = $state<string | null>(null);
    let notesList = $state<string[]>([]);
    let showNewNoteDialog = $state(false);
    let newNoteTitle = $state('');
    let isDeleting = $state(false);
    let unlistenMenu: (() => void) | null = null;

    onMount(async () => {
        try {
            await editorService.initializeEditor(editorEl);
            await loadNotesList();
            await setupAppMenu();

            const appWindow = getCurrentWindow();
            unlistenMenu = await appWindow.listen('menu-action', (event) => {
                const payload = event.payload as { action: string };
                handleMenuAction(payload.action);
            });
            await updateMenuItemStates(false);
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    });

    onDestroy(() => {
        unlistenMenu?.();
    });

    $effect(() => {
        updateMenuItemStates(!!currentFile);
    });

    function handleMenuAction(action: string) {
        switch (action) {
            case 'new':
                showCreateDialog();
                break;
            case 'save':
                handleSave();
                break;
            case 'delete':
                handleDelete();
                break;
            case 'toggle-sidebar':
                isSidebarVisible = !isSidebarVisible;
                break;
        }
    }

    async function loadNotesList(): Promise<void> {
        try {
            notesList = await fileManager.listNotes();
        } catch (error)
        {
            console.error('Failed to load notes list:', error);
            toast.error('Failed to load notes.');
        }
    }

    async function handleSave(): Promise<void> {
        if (!currentFile) return;
        const outputData = await editorService.save();
        if (outputData) {
            await fileManager.writeFile(currentFile, outputData);
            toast.success(`'${getDisplayName(currentFile)}' saved`);
        }
    }

    async function handleDelete(): Promise<void> {
        if (!currentFile || isDeleting) return;
        try {
            isDeleting = true;
            const confirmed = await confirm(
                `Are you sure you want to delete '${getDisplayName(currentFile)}'?`,
                {
                    title: 'Delete Note'
                }
            );

            if (confirmed) {
                await fileManager.deleteFile(currentFile);
                await editorService.clearEditor();
                const deletedNoteName = getDisplayName(currentFile);
                currentFile = null;
                await loadNotesList();
                toast.info(`'${deletedNoteName}' deleted`);
            }
        } catch (error) {
            console.error('Error during delete operation:', error);
            toast.error('Failed to delete note.');
        } finally {
            isDeleting = false;
        }
    }

    async function openNote(fileName: string): Promise<void> {
        if (currentFile === fileName) return;
        const editorData = await fileManager.readFile(fileName);
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
        if (!newNoteTitle.trim()) return;
        const fileName = `${newNoteTitle.trim()}.json`;
        if (notesList.includes(fileName)) {
            toast.error('A note with that title already exists!');
            return;
        }
        await editorService.clearEditor();
        currentFile = fileName;
        const outputData = await editorService.save();
        if (outputData) {
            await fileManager.writeFile(fileName, outputData);
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
        if (event.key === 'Enter') createNewNote();
        else if (event.key === 'Escape') hideCreateDialog();
    }

    function sanitizeInput(input: string): string {
        return input.replace(/[^a-zA-Z0-9\s-]/g, '');
    }

    function getDisplayName(fileName: string): string {
        return fileName.replace('.json', '');
    }
</script>

<Toaster position="top-right" richColors duration={1500} />
<div class="flex bg-[#191919] h-screen overflow-hidden">
    <!-- Sidebar: The classes here have been updated -->
    <div
            class="flex flex-col bg-[#202020] p-2 w-64 transition-all duration-300 ease-in-out shrink-0"
            class:-ml-64={!isSidebarVisible}
    >
        <div class="p-2">
            <button
                    class="flex justify-center items-center gap-2 hover:bg-[#2c2c2c] p-2 rounded w-full text-[#b0b0b0] transition-colors"
                    onclick={showCreateDialog}
            >
                <Plus size={16} />
                New Note
            </button>
        </div>

        <div class="flex-1 space-y-1 pr-1 overflow-y-auto">
            {#each notesList as note}
                <button
                        class="flex items-center gap-2 hover:bg-[#2c2c2c] p-2 rounded w-full font-serif text-[#9b9b9b] text-left truncate text-ellipsis transition-colors"
                        class:bg-[#2c2c2c]={currentFile === note}
                        onclick={() => openNote(note)}
                        onkeydown={(e) => handleKeyDown(e, () => openNote(note))}
                        type="button"
                >
                    <StickyNote size={16} class="shrink-0" />
                    <span class="truncate">{getDisplayName(note)}</span>
                </button>
            {/each}
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out">
        <div
                class="flex-1 p-4 overflow-y-auto flex justify-center items-start"
                style="visibility: {currentFile ? 'visible' : 'hidden'}"
        >
            <div
                    class="w-full h-full transition-all duration-300 ease-in-out"
                    class:max-w-4xl={isSidebarVisible}
                    class:max-w-6xl={!isSidebarVisible}
                    bind:this={editorEl}
            ></div>
        </div>
    </div>
</div>

{#if showNewNoteDialog}
    <div class="z-50 fixed inset-0 flex justify-center items-center bg-black bg-opacity-50">
        <div class="bg-white shadow-xl p-6 rounded-lg w-96">
            <h3 class="mb-4 font-semibold text-lg">Create New Note</h3>
            <input
                    type="text"
                    placeholder="Enter note title..."
                    class="mb-4 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    bind:value={newNoteTitle}
                    oninput={(e) => (newNoteTitle = sanitizeInput(e.currentTarget.value))}
                    onkeydown={handleNewNoteKeyDown}
                    autofocus
            />
            <div class="flex justify-end gap-2">
                <button
                        class="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded text-gray-700 transition-colors"
                        onclick={hideCreateDialog}
                >
                    Cancel
                </button>
                <button
                        class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 px-4 py-2 rounded text-white transition-colors"
                        onclick={createNewNote}
                        disabled={!newNoteTitle.trim()}
                >
                    Create
                </button>
            </div>
        </div>
    </div>
{/if}