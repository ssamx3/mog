// search.svelte
<script lang="ts">
    import {fade, scale} from 'svelte/transition';

    import * as fileManager from '$lib/fileManager';
    import type {NoteEntry} from '$lib/fileManager';
    import {quintOut} from "svelte/easing";
    import {File, FilePenLine} from "lucide-svelte";
    import * as editorService from "$lib/editorService";
    import { setBreadcrumb} from "$lib/state.svelte"
    import { loadNotesList } from '$lib/notes.svelte';

    let searchField = $state('');
    let allNotes = $state<NoteEntry[]>([]);
    let selectedIndex = $state(0);

    let {
        showSearchDialog = $bindable(),
        currentFile = $bindable(),
        currentFolder = $bindable(),
    } = $props();

    $effect(() => {
        if (showSearchDialog) {
            fileManager.listAllNotesRecursively().then(notes => {
                allNotes = notes;
            });
        }
    });

    let searchList = $derived(performSearch(searchField));

    $effect(() => {
        if (searchList.length > 0) {
            selectedIndex = 0;
        }
    });

    function performSearch(searchTerm: string): NoteEntry[] {
        if (!searchTerm) return [];
        return allNotes.filter((note) =>
            note.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    function hideSearch() {
        showSearchDialog = false;
        searchField = '';
    }

    async function openNote(note: NoteEntry): Promise<void> {
        const fullPath = note.path ? `${note.path}/${note.name}` : note.name;
        if (currentFile === fullPath) {
            hideSearch();
            return;
        }


        const editorData = await fileManager.readFile(note.name, note.path);
        if (editorData) {
            await editorService.render(editorData)
            currentFolder = note.path || '';
            currentFile = fullPath;
            setBreadcrumb(note.path);
            await loadNotesList(currentFolder);

            hideSearch();
        }
    }

    function handleSearchKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            hideSearch();
            return;
        }
        if (searchList.length === 0) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                selectedIndex = (selectedIndex + 1) % searchList.length;
                break;
            case 'ArrowUp':
                event.preventDefault();
                selectedIndex = (selectedIndex === 0 ? searchList.length - 1 : selectedIndex - 1);
                break;
            case 'Enter':
                event.preventDefault();
                if (searchList[selectedIndex]) {
                    openNote(searchList[selectedIndex]);
                }
                break;
        }
    }

    function getDisplayName(fileName: string): string {
        return fileName.replace('.json', '');
    }
</script>

<div class="z-50 fixed inset-0 flex justify-center items-center bg-black/80 transition" in:fade={{ duration: 200 }}
     out:fade={{ duration: 150 }} onkeydown={handleSearchKeydown} role="button" tabindex="-1">
    <div class="bg-[#2c2c2c] shadow-xl p-6 rounded-2xl w-96"
         in:scale={{ duration: 300, start: 0.95, opacity: 0.5, easing: quintOut }}
         out:scale={{ duration: 200, start: 0.95, opacity: 0 }}>
        <input
                type="text"
                placeholder="Search all notes..."
                class="mb-4 p-3 text-[#ffffff] font-[vr] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 w-full"
                bind:value={searchField}
                autofocus
        />

        <section>
            {#if searchField && searchList.length === 0}
                <div class="text-center text-[#9b9b9b] py-4">
                    No notes found for "{searchField}"
                </div>
            {:else if searchList.length > 0}
                <ul class="box flex-column flex-wrap scrollbar-hide max-h-60 overflow-y-auto ">
                    {#each searchList as note, index}
                        <div class="pb-1">
                        <button
                                class="flex items-center justify-between gap-6  hover:bg-[#3c3c3c]  transition-all ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] text-[#9b9b9b] text-left"
                                class:bg-[#3c3c3c]={selectedIndex === index}
                                class:font-bold={selectedIndex === index}
                                onclick={() => openNote(note)}
                                type="button"
                        >
                            <div class="flex items-center gap-2 truncate">
                                {#if currentFile === (note.path ? `${note.path}/${note.name}` : note.name)}
                                    <FilePenLine size={16} class="shrink-0"/>
                                {:else}
                                    <File size={16} class="shrink-0"/>
                                {/if}
                                <span class="truncate">{getDisplayName(note.name)}</span>
                            </div>
                            <span class="text-xs text-[#6e6e6e] font-mono shrink-0 ml-2">
                                {note.path || 'Home'}
                            </span>
                        </button>
                        </div>
                    {/each}
                </ul>
            {:else if !searchField}
                <div class="text-center text-[#9b9b9b] py-4">
                    Start typing to search notes...
                </div>
            {/if}
        </section>
    </div>
</div>