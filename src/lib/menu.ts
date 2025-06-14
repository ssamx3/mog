import { Menu, Submenu, MenuItem } from '@tauri-apps/api/menu';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

export async function setupAppMenu() {
    // On macOS, the first submenu is always the "App" menu.
    // We can create it ourselves, or Tauri will do it automatically.
    // For simplicity, we'll focus on the "File" menu.

    const fileSubmenu = await Submenu.new({
        text: 'File',
        items: [
            await MenuItem.new({
                text: 'New Note',
                // Use CmdOrCtrl for cross-platform compatibility (macOS/Windows/Linux)
                accelerator: 'CmdOrCtrl+T',
                action: () => {
                    // Emit a custom event that the Svelte component will listen for
                    appWindow.emit('menu-action', { action: 'new' });
                },
            }),
            await MenuItem.new({
                text: 'Save',
                id: 'save-note', // Give it an ID to update it later
                accelerator: 'CmdOrCtrl+S',
                action: () => {
                    appWindow.emit('menu-action', { action: 'save' });
                },
            }),
            await MenuItem.new({
                text: 'Delete Note',
                id: 'delete-note', // Give it an ID
                accelerator: 'CmdOrCtrl+L', // Your custom shortcut
                action: () => {
                    appWindow.emit('menu-action', { action: 'delete' });
                },
            }),
        ],
    });

    const appMenu = await Menu.new({
        items: [fileSubmenu],
    });

    // Set this as the main application menu
    await appMenu.setAsAppMenu();

    // --- Pro Tip: Dynamic Disabling/Enabling ---
    // Listen for state changes from the Svelte component
    await listen('file-status-changed', async (event) => {
        const payload = event.payload as { hasOpenFile: boolean };
        const saveItem = await appMenu.get('save-note');
        const deleteItem = await appMenu.get('delete-note');

        // Enable or disable items based on whether a file is open
        if (saveItem) await saveItem.setEnabled(payload.hasOpenFile);
        if (deleteItem) await deleteItem.setEnabled(payload.hasOpenFile);
    });
}