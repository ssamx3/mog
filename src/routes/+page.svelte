<script lang="ts">
    import {onDestroy, onMount} from "svelte";
    import { load } from '@tauri-apps/plugin-store';
    import {invoke} from '@tauri-apps/api/core';
    import {fade, scale, blur} from 'svelte/transition';
    import {quintOut} from 'svelte/easing';
    import * as editorService from '$lib/editorService';
    import * as fileManager from '$lib/fileManager';
    import {setupAppMenu, updateMenuItemStates} from '$lib/menu';
    import {getCurrentWindow} from '@tauri-apps/api/window';
    import {confirm} from '@tauri-apps/plugin-dialog';
    import '../app.css';
    import SearchConsole from "$lib/components/search.svelte";
    import Baka from "$lib/components/flurb.svelte";
    import {toast, Toaster} from 'svelte-sonner';
    import {File, Plus, FilePenLine, Cat, Search, Baby} from 'lucide-svelte';


    let editorEL: HTMLElement;

    let editorEl: HTMLElement;
    let isSidebarVisible = $state(true);
    let currentFile = $state<string | null>(null);
    let notesList = $state<string[]>([]);
    let showNewNoteDialog = $state(false);
    let showSearchDialog = $state(false);
    let showRenameDialog = $state(false);
    let newNoteTitle = $state('');
    let newFileTitle = $state('');
    let isDeleting = $state(false);
    let unlistenMenu: (() => void) | null = null;
    let currentFolder = $state('bob');

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

        await fileManager.checkFolderExists()
        const store = await load('store.json', { autoSave: false });
        const val = await store.get<{ value: number }>('doneOnboarding');
        if (val != 1) {
            showOnboarding();
            await store.set('doneOnboarding', 1);
        }



    });

    onDestroy(() => {
        unlistenMenu?.();
    });

    $effect(() => {
        updateMenuItemStates(!!currentFile);
    });

    function showOnboarding() {
        toast.info('Welcome to Mog!', {
            duration: 10000,
            position: 'top-right',
            html: true
        })
    }

    

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
            case 'rename':
                if (!currentFile) return;
                showReDialog();
                break;

            case 'search':
                showSearch();
                break;
            case 'toggle-sidebar':
                isSidebarVisible = !isSidebarVisible;
                break;
        }
    }


    async function loadNotesList(): Promise<void> {
        try {
            notesList = await fileManager.listNotes(currentFolder);
        } catch (error) {
            console.error("Failed to load notes list:", error);
            toast.error("Failed to load notes.");
        }
    }

    async function handleSave(): Promise<void> {
        if (!currentFile) return;
        const outputData = await editorService.save();
        if (outputData) {
            await fileManager.writeFile(currentFile, currentFolder, outputData);
            toast.success(`'${getDisplayName(currentFile)}' saved`);
        }
    }

    async function handleSecretSave(): Promise<void> {
        if (!currentFile) return;
        const outputData = await editorService.save();
        if (outputData) {
            await fileManager.writeFile(currentFile, currentFolder, outputData);
        }
    }

    async function handleRename(): Promise<void> {
        if (!currentFile) return;
        if (notesList.some(file => file.toUpperCase() === newFileTitle.trim().concat('.json').toUpperCase())){
            newFileTitle = '';
            toast.error('This name is already in use!');
            return;
        }
        await fileManager.renameFileByCopy(currentFile.trim(), newFileTitle.trim().concat('.json'), currentFolder);
        await loadNotesList();
        currentFile = newFileTitle.trim().concat('.json');
        hideReDialog();
        toast.info(`'${getDisplayName(currentFile)}' renamed`);
    }

    async function handleDelete(): Promise<void> {
        if (!currentFile || isDeleting) return;
        try {
            isDeleting = true;
            const confirmed = await confirm(`Are you sure you want to delete '${getDisplayName(currentFile)}'?`, {
                title: 'Delete Note'
            });

            if (confirmed) {
                await fileManager.deleteFile(currentFile, currentFolder);
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
        const editorData = await fileManager.readFile(fileName, currentFolder);
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
            await fileManager.writeFile(fileName, currentFolder, outputData);
            await loadNotesList();
        }
        hideCreateDialog();
    }

    function showCreateDialog() {
        showNewNoteDialog = true;
        newNoteTitle = '';
    }

    function showReDialog() {
        showRenameDialog = true;
        newFileTitle = '';
    }
    function hideReDialog() {
        showRenameDialog = false;
        newFileTitle = '';
    }

    function showSearch() {

        showSearchDialog = true;
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
        else if (event.key === 'Escape') hideReDialog();
    }

    function handleRenameKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') handleRename();
        else if (event.key === 'Escape') hideReDialog();
    }


    function sanitizeInput(input: string): string {
        return input.replace(/[^a-zA-Z0-9\s-]/g, '');
    }

    function getDisplayName(fileName: string): string {
        return fileName.replace('.json', '');
    }


</script>

<Toaster duration={1000} position="top-right" richColors/>

<div class="flex bg-[#191919] h-screen overflow-hidden pt-5">
    <div class="flex-shrink-0 pl-3 top-4 bottom-4 left-4 w-60 rounded-xl py-4 sidebar transition-all duration-200 ease-in-out"
         class:w-19={!isSidebarVisible}
         class:w-60={isSidebarVisible}>
        <div class="h-full  bg-gradient-to-b from-[#202020] to-[#170d1f]  rounded-xl p-3 relative flex flex-col">
            <div class="flex-1 overflow-y-auto scrollbar-hide">
                <section>
                    <ul class="box flex-column flex-wrap scrollbar-hide">
                        {#each notesList as note}
                            <button
                                    class="flex items-center gap-2 hover:bg-[#2c2c2c]  transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] text-[#9b9b9b] text-left truncate text-ellipsis "

                                    class:font-black={currentFile === note}
                                    class:scale-102={currentFile === note}
                                    onclick={() => {openNote(note); handleSecretSave()}}
                                    onkeydown={(e) => handleKeyDown(e, () => openNote(note))}
                                    type="button"
                            >
                                {#if currentFile === note}
                                    <FilePenLine size={16} class="shrink-0"/>
                                {/if}

                                {#if currentFile !== note}
                                    <File size={16} class="shrink-0"/>
                                {/if}
                                <span class="truncate">{getDisplayName(note)}</span>
                            </button>
                        {/each}

                    </ul>

                </section>

            </div>
            <button
                    class="flex items-center gap-2 bottom-3 items-center gap-2 transition-all hover:scale-105 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] hover:text-[#d4d4d4] text-[#9b9b9b] text-left truncate text-ellipsis "
                    onclick={()=>showSearch()}
                    type="button">

                <Search class="shrink-0" size={20}/>
                <span class="truncate">search</span>
            </button>
            <button
                    class="flex items-center gap-2 bottom-3 items-center gap-2 transition-all hover:scale-105 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] hover:text-[#d4d4d4] text-[#9b9b9b] text-left truncate text-ellipsis "
                    onclick={()=>showCreateDialog()}
                    type="button">

                <Plus class="shrink-0" size={20}/>
                <span class="truncate">add</span>
            </button>
        </div>
    </div>

    <div class="flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out">
        <div class="relative flex-1">
            <div class="absolute inset-0 p-4 flex flex-col  overflow-y-auto transition-blur duration-200"
                 class:opacity-0={!currentFile}
                 class:opacity-100={currentFile}
                 class:pointer-events-auto={currentFile}
                 class:pointer-events-none={!currentFile}>
                {#if currentFile}
                <h1 class="font-[vr] font-bold text-2xl pl-23 text-[#d4d4d4]">{currentFile.replace('.json', '')}</h1>
                    {/if}
                <div bind:this={editorEl} class="mx-auto pl-8 w-full h-full"></div>
            </div>
            <div
                    class="absolute inset-0 p-4 flex items-center justify-center overflow-y-auto transition-opacity duration-200"
                    class:opacity-0={currentFile}
                    class:opacity-100={!currentFile}
                    class:pointer-events-auto={!currentFile}
                    class:pointer-events-none={currentFile}
            >
                <div class="mx-auto pl-8 w-full h-full flex flex-col items-center justify-center text-center">
                    <Cat class="text-[#9b9b9b]" size={50}/>
                    <h1 class="font-[vr] text-[#d4d4d4]">Autosave is disabled (switching to other notes will save your current note)</h1>
                    <h1 class="font-[vr] text-[#9b9b9b]">CMD + S to save</h1>
                    <h1 class="font-[vr] text-[#9b9b9b]">CMD + N for a new file</h1>
                    <h1 class="font-[vr] text-[#9b9b9b]">CMD + L to delete a file</h1>
                    <h1 class="font-[vr] text-[#9b9b9b]">CMD + . to toggle sidebar</h1>
                    <h1 class="font-[vr] text-[#9b9b9b]">CMD + K to search</h1>
                </div>
            </div>

        </div>
    </div>


</div>

{#if showNewNoteDialog}
    <div class="z-50 fixed inset-0 flex justify-center items-center bg-black/80 transition" in:fade={{ duration: 200 }}
         out:fade={{ duration: 150 }}>
        <div class="bg-[#2c2c2c] shadow-xl p-6 rounded-2xl w-96"
             in:scale={{ duration: 300, start: 0.95, opacity: 0.5, easing: quintOut }}
             out:scale={{ duration: 200, start: 0.95, opacity: 0 }}>
            <h3 class="mb-4 font-semibold font-[vr] text-[#ffffff] text-lg">Create New Note</h3>
            <input
                    type="text"
                    placeholder="Enter note title..."
                    class="mb-4 p-3 text-[#ffffff] font-[vr] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 w-full"
                    bind:value={newNoteTitle}
                    oninput={(e) => newNoteTitle = sanitizeInput(e.currentTarget.value)}
                    onkeydown={handleNewNoteKeyDown}
                    autofocus
            />
            <div class="flex justify-end gap-2">
                <button
                        class="bg-gray-200 hover:bg-gray-300 font-[vr] px-4 py-2 rounded-xl text-gray-400 transition-colors"
                        onclick={hideCreateDialog}
                >
                    Cancel
                </button>
                <button
                        class="bg-violet-300 hover:bg-violet-400 font-[vr] disabled:bg-gray-300 px-4 py-2 rounded-xl text-white transition-colors"
                        onclick={createNewNote}
                        disabled={!newNoteTitle.trim()}
                >
                    Create note
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showRenameDialog}
    <div class="z-50 fixed inset-0 flex justify-center items-center bg-black/80 transition" in:fade={{ duration: 200 }}
         out:fade={{ duration: 150 }}>
        <div class="bg-[#2c2c2c] shadow-xl p-6 rounded-2xl w-96"
             in:scale={{ duration: 300, start: 0.95, opacity: 0.5, easing: quintOut }}
             out:scale={{ duration: 200, start: 0.95, opacity: 0 }}>
            <h3 class="mb-4 font-semibold font-[vr] text-[#ffffff] text-lg">Rename note</h3>
            <input
                    type="text"
                    placeholder="Enter note title..."
                    class="mb-4 p-3 text-[#ffffff] font-[vr] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 w-full"
                    bind:value={newFileTitle}
                    oninput={(e) => newFileTitle = sanitizeInput(e.currentTarget.value)}
                    onkeydown={handleRenameKeyDown}
                    autofocus
            />
            <div class="flex justify-end gap-2">
                <button
                        class="bg-gray-200 hover:bg-gray-300 font-[vr] px-4 py-2 rounded-xl text-gray-400 transition-colors"
                        onclick={hideReDialog}
                >
                    Cancel
                </button>
                <button
                        class="bg-violet-300 hover:bg-violet-400 font-[vr] disabled:bg-gray-300 px-4 py-2 rounded-xl text-white transition-colors"
                        onclick={handleRename}
                        disabled={!newFileTitle.trim()}
                >
                    Rename
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showSearchDialog}
    <SearchConsole bind:showSearchDialog={showSearchDialog} bind:currentFile={currentFile} bind:notesList={notesList}></SearchConsole>
{/if}