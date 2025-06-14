import EditorJS, { type OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';

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
        tools: {
            header: {
                class: Header,
                inlineToolbar: ['link']
            },
        }
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
 * Clears the editor and renders new data.
 * @param data - The OutputData to load into the editor.
 */
export async function render(data: OutputData): Promise<void> {
    if (!editor) {
        console.error('Editor not initialized');
        return;
    }
    try {
        await editor.clear();
        await editor.render(data);
    } catch (error) {
        console.error('Rendering failed: ', error);
    }
}

export async function clearEditor() {
    if (!editor) {
        console.error('Editor not initialized');
        return;
    }
    try {
        await editor.clear();
    } catch (error) {
        console.error('clear failed: ', error);
    }
}