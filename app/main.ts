import { app, BrowserWindow, screen, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

// Initialize remote module
require('@electron/remote/main').initialize();

let win: BrowserWindow = null;
const args = process.argv.slice(1),
	serve = args.some(val => val === '--serve');
const iconPath = process.platform !== 'darwin'
	? 'src/assets/icons/favicon.ico'
	: 'src/assets/icons/favicon.icns';

function createWindow(): BrowserWindow {
	const electronScreen = screen;
	const size = electronScreen.getPrimaryDisplay().workAreaSize;
	let scaleFactor = size.width / 2560

	let xOffset = 520;
	let yOffset = 287;
	let dispHeight = 900;
	let dispMinHeight = 900;
	let dispMaxWidth = 300;

	xOffset = Math.round(xOffset * scaleFactor);
	yOffset = Math.round(yOffset * scaleFactor);
	dispHeight = Math.round(dispHeight * scaleFactor);
	dispMinHeight = Math.round(dispMinHeight * scaleFactor);
	dispMaxWidth = Math.round(dispMaxWidth * scaleFactor);
	

	// Create the browser window.
	win = new BrowserWindow({
		// icon: path.join(__dirname, iconPath),
		// x: xOffset,
		// y: yOffset,
		// width: 400,
		// height: dispHeight,
		// minHeight: dispMinHeight,
		// maxHeight: 400,
		// minWidth: 200,
		// maxWidth: dispMaxWidth,
		transparent: false,
		alwaysOnTop: true,
		// it will not be transparent if there is a frame
		frame: true,
		autoHideMenuBar: true,
		webPreferences: {
			nodeIntegration: true,
			allowRunningInsecureContent: (serve) ? true : false,
			contextIsolation: false,  // false if you want to run e2e test with Spectron
			enableRemoteModule: true, // true if you want to run e2e test with Spectron or use remote module in renderer context (ie. Angular)
			devTools: true
		},
	});


	if (serve) {
		win.webContents.openDevTools();
		require('electron-reload')(__dirname, {
			electron: require(path.join(__dirname, '/../node_modules/electron'))
		});
		win.loadURL('http://localhost:4200');
	} else {
		// Path when running electron executable
		let pathIndex = './index.html';

		if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
			// Path when running electron in local folder
			pathIndex = '../dist/index.html';
		}

		win.loadURL(url.format({
			pathname: path.join(__dirname, pathIndex),
			protocol: 'file:',
			slashes: true
		}));
	}

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store window
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null;
	});

	return win;
}

try {
	// This method will be called when Electron has finished
	// initialization and is ready to create browser windows.
	// Some APIs can only be used after this event occurs.
	// Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
	app.on('ready', () => {
		setTimeout(createWindow, 400);
		const ret = globalShortcut.register('CommandOrControl+Shift+X', () => {
			console.log('show app')
			app.show()
		})
		const ret2 = globalShortcut.register('CommandOrControl+Shift+Y', () => {
			console.log('hide app')
			app.hide()
		})
		if (!ret) {
			console.log('registration failed')
		}
	});

	// Quit when all windows are closed.
	app.on('window-all-closed', () => {
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('activate', () => {
		// On OS X it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (win === null) {
			createWindow();
		}
	});

} catch (e) {
	// Catch Error
	// throw e;
}




app.on('will-quit', () => {
	// Unregister a shortcut.
	globalShortcut.unregister('CommandOrControl+X')

	// Unregister all shortcuts.
	globalShortcut.unregisterAll()
})