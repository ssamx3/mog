import { Menu, Submenu, MenuItem } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';

export async function setupAppMenu() {
    const appWindow = getCurrentWindow();

    // 1. Create your custom menu items
    const newNoteItem = await MenuItem.new({ text: 'New Note', id: 'new-note', accelerator: 'CmdOrCtrl+T', action: () => appWindow.emit('menu-action', { action: 'new' }) });
    const saveItem = await MenuItem.new({ text: 'Save Note', id: 'save-note', accelerator: 'CmdOrCtrl+S', action: () => appWindow.emit('menu-action', { action: 'save' }) });
    const deleteItem = await MenuItem.new({ text: 'Delete Note', id: 'delete-note', accelerator: 'CmdOrCtrl+L', action: () => appWindow.emit('menu-action', { action: 'delete' }) });
    const toggleSidebarItem = await MenuItem.new({ text: 'Toggle Sidebar', id: 'toggle-sidebar', accelerator: 'CmdOrCtrl+B', action: () => appWindow.emit('menu-action', { action: 'toggle-sidebar' }) });
    const quitItem = await MenuItem.new({ text: 'Quit mog', id: 'quit-app', accelerator: 'CmdOrCtrl+Q', action: async () => await exit(0) });

    const customFileItems = [newNoteItem, saveItem, deleteItem]; // No separator

    // 2. Get the default menu
    const defaultMenu = await Menu.default();

    // On Windows/Linux, build a simple menu from scratch
    if (!defaultMenu) {
        console.log("No default menu found, creating a new one for Windows/Linux.");
        const fileSubmenu = await Submenu.new({
            text: 'File',
            items: [...customFileItems, quitItem], // No separator
        });
        const viewSubmenu = await Submenu.new({
            text: 'View',
            items: [toggleSidebarItem],
        });
        const appMenu = await Menu.new({ items: [fileSubmenu, viewSubmenu] });
        await appWindow.setMenu(appMenu);
        return { appMenu, saveItem, deleteItem };
    }

    // 3. For macOS, find and rebuild the default menus
    try {
        let finalAppSubmenu: Submenu | null = null;
        let finalFileSubmenu: Submenu | null = null;
        let finalViewSubmenu: Submenu | null = null;
        const otherMenuItems: (MenuItem | Submenu)[] = [];

        const defaultItems = await defaultMenu.items();

        for (const item of defaultItems) {
            const itemText = await item.text();

            // This is the main App menu (e.g., "mog")
            if (item.kind === 'Submenu' && defaultItems.indexOf(item) === 0) {
                const appSubmenuItems = await item.items();
                appSubmenuItems.push(quitItem); // Add quit, no separator
                finalAppSubmenu = await Submenu.new({ text: itemText, items: appSubmenuItems });
            }
            // Find and rebuild the File menu
            else if (item.kind === 'Submenu' && itemText === 'File') {
                const originalFileItems = await item.items();
                finalFileSubmenu = await Submenu.new({
                    text: 'File',
                    items: [...customFileItems, ...originalFileItems],
                });
            }
            // Find and rebuild the View menu
            else if (item.kind === 'Submenu' && itemText === 'View') {
                const originalViewItems = await item.items();
                finalViewSubmenu = await Submenu.new({
                    text: 'View',
                    items: [toggleSidebarItem, ...originalViewItems], // Prepend our toggle item
                });
            }
            // Keep all other default menus (Edit, Window, Help, etc.)
            else {
                otherMenuItems.push(item);
            }
        }

        // 4. Assemble the final menu in the correct order
        // Fallback: If any default menu wasn't found, create it.
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
        ].filter(Boolean) as (MenuItem | Submenu)[]; // filter(Boolean) removes any nulls

        const appMenu = await Menu.new({ items: finalMenuItems });
        await appMenu.setAsAppMenu();

        return { appMenu, saveItem, deleteItem };

    } catch (error) {
        console.error('Error modifying the default macOS menu:', error);
        return { appMenu: null, saveItem: null, deleteItem: null };
    }
}

// The update function remains unchanged and will work perfectly.
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