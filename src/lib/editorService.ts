

// lib/editorService.ts

import EditorJS, { type OutputData } from '@editorjs/editorjs';

// --- IMPORT YOUR TOOLS ---
// You already have Header
import Header from '@editorjs/header';
// Import the new tools you just installed
import List from '@editorjs/list';
import Checklist from '@editorjs/checklist';
import Quote from '@editorjs/quote';
import Marker from '@editorjs/marker';

// This variable holds the single editor instance.
let editor: EditorJS | null = null;

/**
 * Initializes the EditorJS instance on a given HTML element.
 * @param holder - The HTML element that will contain the editor.
 * @returns The initialized editor instance.
 */
export async function initializeEditor(holder: HTMLElement): Promise<EditorJS> {
    editor = new EditorJS({
        holder: holder,

        // --- CONFIGURE THE TOOLS ---
        tools: {
            // Header is a "Block" tool
            header: {
                class: Header,
                inlineToolbar: ['link'] // Allows you to make links within the header text
            },

            // List is a "Block" tool
            list: {
                class: List,
                inlineToolbar: true // Allows bold, italic, marker, etc. on list items
            },

            // Checklist is a "Block" tool
            checklist: {
                class: Checklist,
                inlineToolbar: true // Allows formatting on checklist items
            },

            // Quote is a "Block" tool
            quote: {
                class: Quote,
                inlineToolbar: true, // Allows formatting within the quote text
                config: {
                    quotePlaceholder: 'Enter a quote',
                    captionPlaceholder: 'Quote\'s author',
                },
            },

            // Marker is an "Inline" tool. It appears in the inline popup when you select text.
            marker: {
                class: Marker,
                shortcut: 'CMD+M' // Optional: a keyboard shortcut
            },
        },

        /**
         * We recommend to specify a placeholder for the first empty block.
         */
        placeholder: 'Type anything...',
    });

    // It's important to wait for the editor to be ready before interacting with it.
    await editor.isReady;
    return editor;
}

/**
 * Saves the editor's current content.
 * @returns A Promise resolving to the editor's OutputData, or undefined on error.
 */
export async function save(): Promise<OutputData | undefined> {
    if (!editor) {
        console.error('Editor not initialized');
        return;
    }
    try {
        return await editor.save();
    } catch (error) {
        console.error('Saving failed: ', error);
    }
}

/**
 * Renders new data into the editor.
 * @param data - The OutputData to load into the editor.
 */
export async function render(data: OutputData): Promise<void> {
    if (!editor) {
        console.error('Editor not initialized');
        return;
    }
    try {
        // Clear previous content before rendering new data
        await editor.clear();
        await editor.render(data);
    } catch (error) {
        console.error('Rendering failed: ', error);
    }
}

/**
 * Clears all content from the editor.
 */
export async function clearEditor() {
    if (!editor) {
        console.error('Editor not initialized');
        return;
    }
    try {
        await editor.clear();
    } catch (error) {
        console.error('Clear failed: ', error);
    }
}
