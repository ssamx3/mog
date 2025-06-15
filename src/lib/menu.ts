import { Menu, Submenu, MenuItem } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';

export async function setupAppMenu() {
    const appWindow = getCurrentWindow();

    // Create App menu items (mog submenu)
    const quitItem = await MenuItem.new({
        text: 'Quit mog',
        id: 'quit-app',
        accelerator: 'CmdOrCtrl+Q',
        action: async () => {
            await exit(0);
        },
    });

    // Create App submenu
    const appSubmenu = await Submenu.new({
        text: 'Mog',
        items: [quitItem],
    });

    // Create File menu items
    const newNoteItem = await MenuItem.new({
        text: 'New Note',
        id: 'new-note',
        accelerator: 'CmdOrCtrl+T',
        action: () => {
            appWindow.emit('menu-action', { action: 'new' });
        },
    });

    const saveItem = await MenuItem.new({
        text: 'Save Note',
        id: 'save-note',
        accelerator: 'CmdOrCtrl+S',
        action: () => {
            appWindow.emit('menu-action', { action: 'save' });
        },
    });

    const deleteItem = await MenuItem.new({
        text: 'Delete Note',
        id: 'delete-note',
        accelerator: 'CmdOrCtrl+L',
        action: () => {
            appWindow.emit('menu-action', { action: 'delete' });
        },
    });

    // Create File submenu
    const fileSubmenu = await Submenu.new({
        text: 'file',
        items: [newNoteItem, saveItem, deleteItem],
    });

    // Create the main menu
    const appMenu = await Menu.new({
        items: [appSubmenu, fileSubmenu],
    });

    // Set as the application menu
    await appMenu.setAsAppMenu();

    return { appMenu, saveItem, deleteItem };
}

export async function updateMenuItemStates(hasOpenFile: boolean) {
    try {
        const appMenu = await Menu.default();
        const saveItem = await appMenu?.get('save-note');
        const deleteItem = await appMenu?.get('delete-note');

        if (saveItem) await saveItem.setEnabled(hasOpenFile);
        if (deleteItem) await deleteItem.setEnabled(hasOpenFile);
    } catch (error) {
        console.error('Failed to update menu items:', error);
    }
}