<script lang="ts">
    import {onDestroy, onMount} from "svelte";
    import { invoke } from '@tauri-apps/api/core';
    import {fade, scale} from 'svelte/transition';
    import {quintOut} from 'svelte/easing';
    import * as editorService from '$lib/editorService';
    import * as fileManager from '$lib/fileManager';
    import {setupAppMenu, updateMenuItemStates} from '$lib/menu';
    import {getCurrentWindow} from '@tauri-apps/api/window';
    import {confirm} from '@tauri-apps/plugin-dialog';
    import '../app.css';
    import {toast, Toaster} from 'svelte-sonner';
    import {StickyNote, Plus} from 'lucide-svelte';

    let editorEL: HTMLElement;

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
            await invoke('show_window');
        } catch (error) {
            console.error("Failed to initialize application:", error);
            await invoke('show_window');
        }

        fileManager.checkFolderExists()
        fileManager.listAll()


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
        } catch (error) {
            console.error("Failed to load notes list:", error);
            toast.error("Failed to load notes.");
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
            const confirmed = await confirm(`Are you sure you want to delete '${getDisplayName(currentFile)}'?`, {
                title: 'Delete Note'
            });

            if (confirmed) {
                await fileManager.deleteFile(currentFile);
                await editorService.clearEditor();
                const deletedNoteName = getDisplayName(currentFile);
                currentFile = null;
                await loadNotesList();
                toast.info(`'${deletedNoteName}' deleted`);
            }
        } catch (error) {
            console.error("Error during delete operation:", error);
            toast.error("Failed to delete note.");
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

    function showCreateDialog() {
        showNewNoteDialog = true;
        newNoteTitle = '';
    }

    function hideCreateDialog() {
        showNewNoteDialog = false;
        newNoteTitle = '';
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

<Toaster duration={1500} position="top-right" richColors/>

<div class="flex bg-[#191919] h-screen overflow-hidden">
    <div class="flex-shrink-0 pl-3 top-4 bottom-4 left-4 w-60 rounded-xl py-4 sidebar transition-all duration-200 ease-in-out"
         class:w-60={isSidebarVisible}
         class:w-19={!isSidebarVisible}>
        <div class="h-full  bg-gradient-to-b from-[#202020] to-[#170d1f]  rounded-xl p-3 relative flex flex-col">
            <div class="flex-1 overflow-y-auto scrollbar-hide">
                <section>
                    <ul class="box flex-column flex-wrap scrollbar-hide">
                        {#each notesList as note}
                            <button
                                    class="flex items-center gap-2 hover:bg-[#2c2c2c]  transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-lg w-full font-serif text-[#9b9b9b] text-left truncate text-ellipsis transition-colors"
                                    class:bg-[#2c2c2c]={currentFile === note}
                                    class:font-bold={currentFile === note}
                                    onclick={() => openNote(note)}
                                    onkeydown={(e) => handleKeyDown(e, () => openNote(note))}
                                    type="button"
                            >
                                <StickyNote size={16} class="shrink-0"/>
                                <span class="truncate">{getDisplayName(note)}</span>
                            </button>
                        {/each}

                    </ul>

                </section>

            </div>
            <button
                    class="flex items-center gap-2 bottom-3 flex items-center gap-2 hover:bg-[#2c2c2c]  transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-lg w-full font-serif text-[#9b9b9b] text-left truncate text-ellipsis transition-colors"
                    type="button"
                    onclick={()=>showCreateDialog()}>

                <Plus size={20} class="shrink-0"/>
                <span class="truncate">add</span>
            </button>
        </div>
    </div>

    <div class="flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out">
        <div class="flex-1 p-4 overflow-y-auto" style="visibility: {currentFile ? 'visible' : 'hidden'}">
            <div bind:this={editorEl} class="mx-auto  w-full  h-full"></div>
        </div>
    </div>
</div>

{#if showNewNoteDialog}
    <div class="z-50 fixed inset-0 flex justify-center items-center bg-black/80 transition" in:fade={{ duration: 200 }}
         out:fade={{ duration: 150 }}>
        <div class="bg-[#2c2c2c] shadow-xl p-6 rounded-2xl w-96"
             in:scale={{ duration: 300, start: 0.95, opacity: 0.5, easing: quintOut }}
             out:scale={{ duration: 200, start: 0.95, opacity: 0 }}>
            <h3 class="mb-4 font-semibold font-serif text-[#ffffff] text-lg">Create New Note</h3>
            <input
                    type="text"
                    placeholder="Enter note title..."
                    class="mb-4 p-3 text-[#ffffff] font-serif rounded focus:outline-none focus:ring-2 focus:ring-violet-300 w-full"
                    bind:value={newNoteTitle}
                    oninput={(e) => newNoteTitle = sanitizeInput(e.currentTarget.value)}
                    onkeydown={handleNewNoteKeyDown}
                    autofocus
            />
            <div class="flex justify-end gap-2">
                <button
                        class="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-gray-400 transition-colors"
                        onclick={hideCreateDialog}
                >
                    Cancel
                </button>
                <button
                        class="bg-violet-300 hover:bg-violet-400 disabled:bg-gray-300 px-4 py-2 rounded text-white transition-colors"
                        onclick={createNewNote}
                        disabled={!newNoteTitle.trim()}
                >
                    create note
                </button>
            </div>
        </div>
    </div>
{/if}