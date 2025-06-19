import { Menu, Submenu, MenuItem } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';

export async function setupAppMenu() {
    const appWindow = getCurrentWindow();

    const newNoteItem = await MenuItem.new({ text: 'New Note', id: 'new-note', accelerator: 'CmdOrCtrl+N', action: () => appWindow.emit('menu-action', { action: 'new' }) });
    const saveItem = await MenuItem.new({ text: 'Save Note', id: 'save-note', accelerator: 'CmdOrCtrl+S', action: () => appWindow.emit('menu-action', { action: 'save' }) });
    const deleteItem = await MenuItem.new({ text: 'Delete Note', id: 'delete-note', accelerator: 'CmdOrCtrl+L', action: () => appWindow.emit('menu-action', { action: 'delete' }) });
    const toggleSidebarItem = await MenuItem.new({ text: 'Toggle Sidebar', id: 'toggle-sidebar', accelerator: 'CmdOrCtrl+.', action: () => appWindow.emit('menu-action', { action: 'toggle-sidebar' }) });
    const quitItem = await MenuItem.new({ text: 'Quit mog', id: 'quit-app', accelerator: 'CmdOrCtrl+Q', action: async () => await exit(0) });

    const customFileItems = [newNoteItem, saveItem, deleteItem];

    const defaultMenu = await Menu.default();

    if (!defaultMenu) {
        console.log("No default menu found, creating a new one for Windows/Linux.");
        const fileSubmenu = await Submenu.new({
            text: 'File',
            items: [...customFileItems, quitItem],
        });
        const viewSubmenu = await Submenu.new({
            text: 'View',
            items: [toggleSidebarItem],
        });
        const appMenu = await Menu.new({ items: [fileSubmenu, viewSubmenu] });
        await appWindow.setMenu(appMenu);
        return { appMenu, saveItem, deleteItem };
    }

    try {
        let finalAppSubmenu: Submenu | null = null;
        let finalFileSubmenu: Submenu | null = null;
        let finalViewSubmenu: Submenu | null = null;
        const otherMenuItems: (MenuItem | Submenu)[] = [];

        const defaultItems = await defaultMenu.items();

        for (const item of defaultItems) {
            const itemText = await item.text();

            if (item.kind === 'Submenu' && defaultItems.indexOf(item) === 0) {
                const appSubmenuItems = await item.items();
                appSubmenuItems.push(quitItem);
                finalAppSubmenu = await Submenu.new({ text: itemText, items: appSubmenuItems });
            }
            else if (item.kind === 'Submenu' && itemText === 'File') {
                const originalFileItems = await item.items();
                finalFileSubmenu = await Submenu.new({
                    text: 'File',
                    items: [...customFileItems, ...originalFileItems],
                });
            }
            else if (item.kind === 'Submenu' && itemText === 'View') {
                const originalViewItems = await item.items();
                finalViewSubmenu = await Submenu.new({
                    text: 'View',
                    items: [toggleSidebarItem, ...originalViewItems],
                });
            }
            else {
                otherMenuItems.push(item);
            }
        }

        if (!finalFileSubmenu) {
            finalFileSubmenu = await Submenu.new({ text: 'File', items: customFileItems });
        }
        if (!finalViewSubmenu) {
            finalViewSubmenu = await Submenu.new({ text: 'View', items: [toggleSidebarItem] });
        }

        const finalMenuItems = [
            finalAppSubmenu,
            finalFileSubmenu,
            finalViewSubmenu,
            ...otherMenuItems,
        ].filter(Boolean) as (MenuItem | Submenu)[];

        const appMenu = await Menu.new({ items: finalMenuItems });
        await appMenu.setAsAppMenu();

        return { appMenu, saveItem, deleteItem };

    } catch (error) {
        console.error('Error modifying the default macOS menu:', error);
        return { appMenu: null, saveItem: null, deleteItem: null };
    }
}

export async function updateMenuItemStates(hasOpenFile: boolean) {
    try {
        const appMenu = await Menu.default();
        if (!appMenu) return;

        const saveItem = await appMenu.get('save-note');
        const deleteItem = await appMenu.get('delete-note');

        if (saveItem) await saveItem.setEnabled(hasOpenFile);
        if (deleteItem) await deleteItem.setEnabled(hasOpenFile);
    } catch (error) {
        console.error('Failed to update menu items:', error);
    }
}