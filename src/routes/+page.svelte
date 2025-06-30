<script lang="ts">
    import {onDestroy, onMount} from "svelte";
    import {load} from '@tauri-apps/plugin-store';
    import {invoke} from '@tauri-apps/api/core';
    import {blur, fade, scale} from 'svelte/transition';
    import * as editorService from '$lib/editorService';
    import * as fileManager from '$lib/fileManager';
    import {setupAppMenu, updateMenuItemStates} from '$lib/menu';
    import {getCurrentWindow} from '@tauri-apps/api/window';
    import {confirm} from '@tauri-apps/plugin-dialog';
    import '../app.css';
    import {breadcrumb} from "$lib/state.svelte"
    import {flip} from 'svelte/animate'
    import {quintOut} from 'svelte/easing';
    import {Cat, ChevronLeft, File, FilePenLine, FolderClosedIcon, FolderOpenIcon, Search} from 'lucide-svelte';
    import SearchConsole from '$lib/components/search.svelte';
    import { animate, utils, createSpring, stagger} from 'animejs';

    import {toast, Toaster} from 'svelte-sonner';
    import {foldersList, loadNotesList, notesList} from '$lib/notes.svelte';


    let editorEL: HTMLElement;

    let editorEl: HTMLElement;
    let isSidebarVisible = $state(true);
    let currentFile = $state<string | null>(null);

    let showNewNoteDialog = $state(false);
    let showSearchDialog = $state(false);
    let showRenameDialog = $state(false);
    let showNewFolderDialog = $state(false);
    let newNoteTitle = $state('');
    let newFileTitle = $state('');
    let newFolderTitle = $state('');
    let isDeleting = $state(false);
    let unlistenMenu: (() => void) | null = null;
    let currentFolder = $state('');
    let animation

    let lastSavedData = $state<object | null>(null);



    onMount(async () => {
        try {
            await editorService.initializeEditor(editorEl);
            await loadNotesList(currentFolder);
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
        const store = await load('store.json', {autoSave: false});
        const val = await store.get<{ value: number }>('doneOnboarding');
        if (val != 1) {
            showOnboarding();
            await store.set('doneOnboarding', 1);
        }

        animation = animate('.burger', {
            scale: { from: 0.9 },
            duration: 1250,
            delay: stagger(150, { from: 'center' }),
            ease: 'inOut',
            loop: true,
            alternate: true
        })

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
            case 'newFolder':
                showMkdirDialog();
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
            case 'back':
                goBack();
                break;
            case 'search':
                showSearch();
                break;
            case 'toggle-sidebar':
                isSidebarVisible = !isSidebarVisible;
                break;
        }
    }

    async function handleSave(): Promise<void> {
        if (!currentFile) return;
        const outputData = await editorService.save();
        if (outputData) {
            const fileName = getFileName(currentFile);
            await fileManager.writeFile(fileName, currentFolder, outputData);
            toast.success(`'${getDisplayName(fileName)}' saved`);
            lastSavedData = outputData;
            await loadNotesList(currentFolder);
        }
    }

    async function handleSecretSave(): Promise<void> {
        if (!currentFile) return;
        const outputData = await editorService.save();
        if (outputData && JSON.stringify(outputData.blocks) !== JSON.stringify(lastSavedData?.blocks)) {
            const fileName = getFileName(currentFile);
            await fileManager.writeFile(fileName, currentFolder, outputData);
            lastSavedData = outputData;
        }
    }

    async function handleRename(): Promise<void> {
        if (!currentFile) return;
        const fileName = getFileName(currentFile);
        const newFileName = newFileTitle.trim().concat('.json');

        if (notesList.some(file => file.toUpperCase() === newFileName.toUpperCase())) {
            newFileTitle = '';
            toast.error('This name is already in use!');
            return;
        }

        await fileManager.renameFileByCopy(fileName, newFileName, currentFolder);
        await loadNotesList(currentFolder);
        currentFile = getFullFilePath(newFileName, currentFolder);
        hideReDialog();
        toast.info(`'${getDisplayName(newFileName)}' renamed`);
    }

    async function handleDelete(): Promise<void> {
        if (!currentFile || isDeleting) return;
        try {
            isDeleting = true;
            const fileName = getFileName(currentFile);
            const confirmed = await confirm(`Are you sure you want to delete '${getDisplayName(fileName)}'?`, {
                title: 'Delete Note'
            });

            if (confirmed) {
                await fileManager.deleteFile(fileName, currentFolder);
                await editorService.clearEditor();
                const deletedNoteName = getDisplayName(fileName);
                currentFile = null;
                await loadNotesList(currentFolder);
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
        const fullPath = getFullFilePath(fileName, currentFolder);
        if (currentFile === fullPath) return;
        const editorData = await fileManager.readFile(fileName, currentFolder);
        if (editorData) {
            await editorService.changePh('type something');
            await editorService.render(editorData);
            currentFile = fullPath;
            lastSavedData = editorData;
        }
    }

    async function createNewNote() {
        if (!newNoteTitle.trim()) return;
        const sanitizedTitle = sanitizeInput(newNoteTitle);
        const fileName = `${sanitizedTitle.trim()}.json`;

        if (notesList.some(note => note.toLowerCase() === fileName.toLowerCase())) {
            toast.error('A note with that title already exists!');
            return;
        }

        await editorService.clearEditor();
        currentFile = getFullFilePath(fileName, currentFolder);
        const outputData = await editorService.save();
        if (outputData) {
            await fileManager.writeFile(fileName, currentFolder, outputData);
            await loadNotesList(currentFolder);
            lastSavedData = outputData;
        }
        hideCreateDialog();
    }

    async function handleMoveNote(note: string, folder: string) {
        const fileName = getFileName(note);
        await fileManager.moveFile(fileName, folder, currentFolder);
        await loadNotesList(currentFolder);
        toast.info(`'${getDisplayName(fileName)}' moved`);
    }

    function openFolder(folderName: string): void {
        editorService.changePh('');
        currentFile = null;
        editorService.clearEditor();
        breadcrumb.push(currentFolder);
        currentFolder = currentFolder ? `${currentFolder}/${folderName}` : folderName;
        loadNotesList(currentFolder);
    }

    function goBack(): void {
        if (breadcrumb.length === 0) return;
        const lastFolder = breadcrumb.pop();
        if (lastFolder !== undefined) {
            editorService.changePh('');
            currentFile = null;
            editorService.clearEditor();
            currentFolder = lastFolder;
            loadNotesList(currentFolder);
        }
    }

    function handleNewFolder() {
        if (!newFolderTitle.trim()) return;
        const folderNameSanitized = sanitizeInput(newFolderTitle);
        if (foldersList.some(folder => folder.toLowerCase() === folderNameSanitized.toLowerCase())) {
            toast.error('A folder with that name already exists!');
            return;
        }
        fileManager.createFolder(folderNameSanitized, currentFolder);
        toast.success(`'${folderNameSanitized}' created`);
        hideMkdirDialog();
        loadNotesList(currentFolder);
    }

    async function navigateToFolder(targetFolderPath: string) {
        if (currentFolder === targetFolderPath) return;
        currentFile = null;
        await editorService.clearEditor();

        if (targetFolderPath === '') {
            breadcrumb.length = 0;
            currentFolder = '';
        } else {
            const pathParts = targetFolderPath.split('/');
            breadcrumb.length = 0;
            for (let i = 0; i < pathParts.length; i++) {
                if (i === 0) {
                    breadcrumb.push('');
                } else {
                    breadcrumb.push(pathParts.slice(0, i).join('/'));
                }
            }
            currentFolder = targetFolderPath;
        }
        await loadNotesList(currentFolder);
    }

    function showCreateDialog() {
        showNewNoteDialog = true;
        editorService.pauseEditor()
        newNoteTitle = '';
    }

    function hideCreateDialog() {
        showNewNoteDialog = false;
        editorService.pauseEditor()
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

    function showMkdirDialog() {
        newFolderTitle = '';
        showNewFolderDialog = true;
    }

    function hideMkdirDialog() {
        showNewFolderDialog = false;
    }

    function showSearch() {
        showSearchDialog = true;
    }

    function handleKeyDown(event: KeyboardEvent, action: () => void) {
        if (showNewNoteDialog) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            action();
        }
    }

    function handleNewNoteKeyDown(event: KeyboardEvent) {
        if (event.key === '/' || event.key === '\\' || event.code === 'Slash') {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        if (event.key === 'Enter') createNewNote();
        else if (event.key === 'Escape') hideCreateDialog();
    }

    function handleRenameKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') handleRename();
        else if (event.key === 'Escape') hideReDialog();
    }

    function handleCreateFolderKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') handleNewFolder();
        else if (event.key === 'Escape') hideMkdirDialog();
    }

    function showOnboarding() {
        toast.info('Welcome to Mog!', {
            duration: 10000,
            position: 'top-right'
        })
    }

    function getFullFilePath(fileName: string, folder: string): string {
        return folder ? `${folder}/${fileName}` : fileName;
    }

    function getFileName(fullPath: string): string {
        const parts = fullPath.split('/');
        return parts[parts.length - 1];
    }


    function sanitizeInput(input: string): string {
        return input
            .replace(/[^a-zA-Z0-9\s\-_]/g, '') 
            .replace(/\.\./g, '')
            .replace(/^\.+/, '')
            .slice(0, 255);
    }
    

    function getDisplayName(fileName: string): string {
        return fileName.replace('.json', '');
    }

    function getBreadCrumbOfNewFile() {

    }


</script>

<Toaster duration={1000} position="top-right"  toastOptions={{
    style: 'font-size: 14px; padding: 12px 16px; width: 240px; font-family: "vr"; background: #202020; border: 2px solid #191919; color: #d4d4d4; corners: 100px; ',
    class: 'my-toast-class',
}}/>
<div class="absolute top left-0 right-0 h-7 bg-gradient-to-t from-transparent to-[#202020] "
     data-tauri-drag-region></div>

<div class="flex bg-[#191919] h-screen overflow-hidden pt-5">


    <div class="flex-shrink-0 pl-3 top-4 bottom-4 left-4 w-60 rounded-xl py-4 sidebar transition-all duration-200 ease-in-out"
         class:w-19={!isSidebarVisible}
         class:w-60={isSidebarVisible}>
        <div class="h-full  bg-gradient-to-b from-[#202020] to-[#170d1f]  rounded-xl p-3 relative flex flex-col">
            <div class="flex-1 overflow-y-auto scrollbar-hide relative">
                {#key currentFolder}
                    <section in:scale={{ duration: 200, delay: 100 }}
                             out:blur={{ duration: 100 }}
                             >


                        <ul class="box flex-column flex-wrap scrollbar-hide">

                            {#if breadcrumb.length !== 0}
                                <button
                                        class="flex top-3 items-center gap-2 transition-all hover:scale-105 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] hover:text-[#d4d4d4] text-[#9b9b9b] text-left truncate text-ellipsis "
                                        onclick={()=>goBack()}
                                        type="button">

                                    <ChevronLeft class="shrink-0" size={20}/>
                                    <span class="truncate">{currentFolder}</span>
                                </button>
                            {/if}

                            {#if showNewNoteDialog}

                                <div
                                        class:pointer-events-auto={showNewNoteDialog}
                                        class="flex items-center gap-2 hover:bg-[#2c2c2c]  stagger-item transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] text-[#9b9b9b] text-left truncate text-ellipsis "
                                        in:scale={{ duration: 300, start: 0.95, opacity: 0.5, easing: quintOut }}
                                        out:scale={{ duration: 200, start: 0.95, opacity: 0 }}>

                                        <FilePenLine size={16} class="shrink-0"/>
                                    <input
                                            type="text"
                                            placeholder="Enter note title..."
                                            class=" text-[#ffffff] rounded-md flex-grow w-full focus:outline-none "
                                            bind:value={newNoteTitle}
                                            oninput={(e) => newNoteTitle = sanitizeInput(e.currentTarget.value)}
                                            onkeydown={handleNewNoteKeyDown}
                                            autofocus
                                    />
                                </div>



                            {/if}

                            {#each foldersList as folder (folder)}
                                <div
                                        class="flex items-center gap-2 hover:bg-[#2c2c2c]  stagger-item transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] text-[#9b9b9b] text-left truncate text-ellipsis "
                                        role="button"
                                        tabindex="0"
                                        class:font-black={currentFolder === folder}
                                        class:scale-102={currentFolder === folder}
                                        onclick={() => openFolder(folder)}
                                        onkeydown={(e) => handleKeyDown(e, () => openFolder(folder))}
                                        type="button"
                                        ondragover={(e) => e.preventDefault()}
                                        ondrop={(e) => {
                                            e.preventDefault();
                                            const draggedNote = e.dataTransfer?.getData('text/plain');
                                            if (draggedNote) handleMoveNote(draggedNote, folder);
                                        }}
                                        animate:flip={{ duration: 300 }}>
                                    {#if currentFolder === folder}
                                        <FolderOpenIcon size={16} class="shrink-0"/>
                                    {/if}

                                    {#if currentFolder !== folder}
                                        <FolderClosedIcon size={16} class="shrink-0"/>
                                    {/if}
                                    <span class="truncate">{getDisplayName(folder)}</span>
                                </div>
                            {/each}
                            {#each notesList as note (note)}
                                <button
                                        class="flex items-center gap-2 hover:bg-[#2c2c2c] stagger-item  transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] text-[#9b9b9b] text-left truncate text-ellipsis "

                                        class:font-black={currentFile === getFullFilePath(note, currentFolder)}
                                        class:scale-102={currentFile === getFullFilePath(note, currentFolder)}
                                        onclick={() => {openNote(note); handleSecretSave()}}
                                        onkeydown={(e) => handleKeyDown(e, () => openNote(note))}
                                        type="button"
                                        draggable="true"
                                        ondragstart={(e) => e.dataTransfer?.setData('text/plain', note)}
                                        animate:flip={{ duration: 300 }}
                                >
                                    {#if currentFile === getFullFilePath(note, currentFolder)}
                                        <FilePenLine size={16} class="shrink-0"/>
                                    {/if}

                                    {#if currentFile !== getFullFilePath(note, currentFolder)}
                                        <File size={16} class="shrink-0"/>
                                    {/if}
                                    <span class="truncate">{getDisplayName(note)}</span>
                                </button>
                            {/each}


                        </ul>
                        <div
                                class="flex items-center gap-2 stagger-item  transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] text-[#9b9b9b] text-left truncate text-ellipsis ">
                            <span class="truncate"> </span>
                        </div>
                    </section>
                {/key}

            </div>
            <div class="absolute bottom-13 left-0 right-0 h-16 bg-gradient-to-t from-[#170d1f] to-transparent pointer-events-none"></div>
            <button
                    class="flex bottom-3  bg-white/20  items-center gap-2 transition-all hover:scale-105 ease-in-out duration-200 p-2 rounded-xl w-full font-[vr] hover:text-[#d4d4d4] text-[#9b9b9b] text-left truncate text-ellipsis "
                    onclick={()=>showSearch()}
                    type="button">

                <Search class="shrink-0 justify-center" size={20}/>
                <span class="truncate">search</span>
            </button>
            <!--
            <div class="flex-row flex">
            <button
                    class="flex  bottom-3 w-max items-center gap-2 transition-all hover:scale-105 ease-in-out duration-200 p-3 rounded-xl  font-[vr] hover:text-[#d4d4d4] text-[#9b9b9b] text-left truncate text-ellipsis "
                    onclick={()=>showCreateDialog()}
                    type="button">

                <FilePenLine class="shrink-0" size={20}/>
                <span class="truncate">note</span>
            </button>
                <button
                        class="flex  bottom-3 w-max items-center gap-2 transition-all hover:scale-105 ease-in-out duration-200 p-3 rounded-xl  font-[vr] hover:text-[#d4d4d4] text-[#9b9b9b] text-left truncate text-ellipsis "
                        onclick={()=>showMkdirDialog()}
                        type="button">

                    <FolderPen class="shrink-0" size={20}/>
                    <span class="truncate">folder</span>
                </button>
            </div>
            -->
        </div>

    </div>


    <div class="flex flex-col flex-1 min-w-0 transition-all duration-200 ease-in-out" class:pointer-events-none={showNewNoteDialog}>
        <div class="relative flex-1">
            <div class="absolute inset-0 p-4 flex flex-col  overflow-y-auto transition-all duration-500"
                 class:opacity-0={!currentFile}
                 class:opacity-100={currentFile}
                 class:pointer-events-auto={currentFile}
                 class:pointer-events-none={!currentFile}>
                {#if currentFile}
                    <h1 class="font-[vr] font-bold text-2xl pl-23 text-[#d4d4d4]">{getFileName(currentFile.replace('.json', ''))}</h1>
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
                    <Cat class="text-[#9b9b9b] burger" size={50}/>
                </div>
            </div>

        </div>
    </div>


</div>



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

{#if showNewFolderDialog}
    <div class="z-50 fixed inset-0 flex justify-center items-center bg-black/80 transition" in:fade={{ duration: 200 }}
         out:fade={{ duration: 150 }}>
        <div class="bg-[#2c2c2c] shadow-xl p-6 rounded-2xl w-96"
             in:scale={{ duration: 300, start: 0.95, opacity: 0.5, easing: quintOut }}
             out:scale={{ duration: 200, start: 0.95, opacity: 0 }}>
            <h3 class="mb-4 font-semibold font-[vr] text-[#ffffff] text-lg">New Folder</h3>
            <input
                    type="text"
                    placeholder="Enter note title..."
                    class="mb-4 p-3 text-[#ffffff] font-[vr] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 w-full"
                    bind:value={newFolderTitle}
                    oninput={(e) => newFolderTitle = sanitizeInput(e.currentTarget.value)}
                    onkeydown={handleCreateFolderKeyDown}
                    autofocus
            />
            <div class="flex justify-end gap-2">
                <button
                        class="bg-gray-200 hover:bg-gray-300 font-[vr] px-4 py-2 rounded-xl text-gray-400 transition-colors"
                        onclick={hideMkdirDialog}
                >
                    Cancel
                </button>
                <button
                        class="bg-violet-300 hover:bg-violet-400 font-[vr] disabled:bg-gray-300 px-4 py-2 rounded-xl text-white transition-colors"
                        onclick={handleNewFolder}
                        disabled={!newFolderTitle.trim()}
                >
                    Create
                </button>
            </div>
        </div>
    </div>
{/if}


{#if showSearchDialog}
    <SearchConsole
            bind:showSearchDialog={showSearchDialog}
            bind:currentFile={currentFile}
            bind:currentFolder={currentFolder}

    />
{/if}

<style>
    :global(body) {
        --toast-width: 240px;
        --toast-padding: 12px 16px;
        --toast-font-size: 14px;
        --toast-background: #191919;
        --toast-color: #d4d4d4;
        --toast-border: 1px solid #333;
    }
</style>