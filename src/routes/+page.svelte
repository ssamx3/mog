<script lang="ts">
    import { onMount } from "svelte";
    import * as editorService from '$lib/editorService';
    import * as fileManager from '$lib/fileManager';
    import type { OutputData } from "@editorjs/editorjs";
    import { confirm } from '@tauri-apps/plugin-dialog';


    // Define the component's props with TypeScript
    let { class: className = '' } = $props<{ class?: string }>();

    // This will hold the reference to the <div> element
    let editorEl: HTMLElement;

    const NOTE_FILE = 'testburger.json';

    onMount(() => {
        // Initialize the editor once the component is mounted to the DOM
        editorService.initializeEditor(editorEl).catch(error => {
            console.error("Failed to initialize EditorJS:", error);
        });


    });

    async function handleSave(): Promise<void> {
        const outputData = await editorService.save();
        // Only write the file if save() returned data
        if (outputData) {
            await fileManager.writeFile(NOTE_FILE, outputData);
        }
    }

    async function handleOpen(): Promise<void> {
        const editorData = await fileManager.readFile(NOTE_FILE);
        // Only render if readFile returned data
        if (editorData) {
            await editorService.render(editorData);
        }
    }

    async function handleClear() {
        const confirmation = await confirm(
            'Are you sure you want to clear?',
            { title: 'Unsaved work will be lost', kind: 'warning' }
        );

        if(confirmation) {
            await editorService.clearEditor()
        }
    }


</script>

<div bind:this={editorEl} class="w-full h-full {className}"></div>

<button onclick={handleSave}>Save</button>
<button onclick={handleOpen}>Open</button>
<button onclick={handleClear}>Clear</button>
