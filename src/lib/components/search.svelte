<script lang="ts">
    import {fade, scale} from 'svelte/transition';
    import * as fileManager from '$lib/fileManager';
    import {quintOut} from "svelte/easing";
    import {onMount} from "svelte";
    import {File, FilePenLine} from "lucide-svelte";
    import * as editorService from "$lib/editorService";
    import {toast} from "svelte-sonner";

    let searchField = $state('');
    let searchList = $derived(performSearch(searchField));
    let selectedIndex = $state(0);

    let { showSearchDialog = $bindable(), currentFile = $bindable(), notesList = $bindable() } = $props()

    // Reset selected index when search results change
    $effect(() => {
        if (searchList.length > 0) {
            selectedIndex = 0;
        }
    });

    function performSearch(searchTerm: string) {
        if (!searchTerm) return [];
        return notesList.filter((note) => note.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    function handleKeyDown(event: KeyboardEvent, action: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            action();
        }
    }

    function hideSearch() {
        showSearchDialog = false;
        searchField = '';
        selectedIndex = 0;
    }

    async function openNote(fileName: string): Promise<void> {
        if (currentFile === fileName) return;
        const editorData = await fileManager.readFile(fileName);
        if (editorData) {
            await editorService.render(editorData);
            currentFile = fileName;
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
                selectedIndex = selectedIndex === 0 ? searchList.length - 1 : selectedIndex - 1;
                break;
            case 'Enter':
                event.preventDefault();
                if (searchList[selectedIndex]) {
                    openNote(searchList[selectedIndex]);
                    hideSearch();
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
                placeholder="Search..."
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
                <ul class="box flex-column flex-wrap scrollbar-hide max-h-60 overflow-y-auto">
                    {#each searchList as note, index}
                        <button
                                class="flex items-center gap-2 hover:bg-[#3c3c3c] transition-all hover:scale-102 ease-in-out duration-200 p-3 rounded-xl w-full font-[vr] text-[#9b9b9b] text-left truncate text-ellipsis"
                                class:font-black={currentFile === note}
                                class:scale-102={currentFile === note}
                                class:bg-[#3c3c3c]={selectedIndex === index}
                                onclick={() => {openNote(note); hideSearch();}}
                                onkeydown={(e) => handleKeyDown(e, () => openNote(note))}
                                type="button"
                        >
                            {#if currentFile === note}
                                <FilePenLine size={16} class="shrink-0"/>
                            {:else}
                                <File size={16} class="shrink-0"/>
                            {/if}
                            <span class="truncate">{getDisplayName(note)}</span>
                        </button>
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