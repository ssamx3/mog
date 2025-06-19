import EditorJS, { type OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Checklist from '@editorjs/checklist';
import Quote from '@editorjs/quote';
import Marker from '@editorjs/marker';
import Embed from '@editorjs/embed';

let editor: EditorJS | null = null;

export async function initializeEditor(holder: HTMLElement): Promise<EditorJS> {
    editor = new EditorJS({
        holder: holder,

        tools: {
            header: {
                class: Header,
                inlineToolbar: ['link']
            },

            list: {
                class: List,
                inlineToolbar: true
            },

            embed: {
                class: Embed,
                inlineToolbar: true
            },


            checklist: {
                class: Checklist,
                inlineToolbar: true
            },

            quote: {
                class: Quote,
                inlineToolbar: true,
                config: {
                    quotePlaceholder: 'Enter a quote',
                    captionPlaceholder: 'Quote\'s author',
                },
            },

            marker: {
                class: Marker,
                shortcut: 'CMD+M'
            },
        },


        placeholder: 'Type anything...',
    });

    await editor.isReady;
    return editor;
}


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
        console.error('Clear failed: ', error);
    }
}
