import { Component, OnInit } from '@angular/core';
import Tesseract from 'tesseract.js';
import { desktopCapturer, remote } from 'electron';
import { ElectronService } from '../core/services/index';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { PlayerApiResponse, PlayerStats, GameMode } from '../types';

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
	// data for 1440p screens
	nameXOffset = 2015;
	nameYHeight = 26;
	namesYCoordinates = [140, 173, 205, 237]
	nameWidth = 250;
	playerStats: Array<PlayerStats> = [];
	calcInProgress = false;
	fakeInput = './src/assets/test-screenshot/1v1_1.jpg';
	scaleFactor = 1;
	isScreenshotTaken = false;
	debugMode: true;
	mode: number = 2;

	constructor(private httpClient: HttpClient, private native: ElectronService) {
	}
	ngOnInit(): void {
	}

	// main function to trigger all logic
	async getStatsForAll() {
		// this.setDisplayScaling();
		const playerNames: Array<string> = [];
		this.playerStats = [];
		this.calcInProgress = true;
		for (let i = 0; i < 2*this.mode; i++) {
			const playerName = await this.getPlayerNameFromScreenshot(i, this.fakeInput, true);
			// log directly to console
			// process.stdout.write(`Playername: ` + playerName)
			if (playerName.includes("]")) {
				playerNames.push(playerName.split(']')[1]);
			} else if (playerName.includes("|")) {
				playerNames.push(playerName.split('|')[1]);
			}
			else {
				playerNames.push(playerName);
			}
		}
		for (const name of playerNames) {
			this.playerStats.push(await this.getStatsFromName(name));
		};
		this.calcInProgress = false;
		this.isScreenshotTaken = false;
		console.log(this.playerStats);
	}

	// TODO:
	setDisplayScaling(){
		this.scaleFactor = screen.width / 2560;
		this.nameXOffset = Math.round(this.nameXOffset * this.scaleFactor);
		// eslint-disable-next-line max-len
		let scaledNameYOffset: Array<number> = [];
		this.namesYCoordinates.forEach(coordinate => {
			scaledNameYOffset.push(Math.round(coordinate + this.scaleFactor))
		});
		this.nameWidth = Math.round(this.nameWidth * this.scaleFactor);
		this.nameYHeight = Math.round(this.nameYHeight * this.scaleFactor);
		this.namesYCoordinates = scaledNameYOffset;
	}

	setMode(mode: number) {
		switch (mode) {
			case 1: {
				this.mode = 1;
				break;
			}
			case 2: {
				this.mode = 2;
				break;
			}
			case 3: {
				this.mode = 3;
				break;
			}
			default: {
				this.mode = 1;
				break;
			}
		} 
		
	}

	async getPlayerNameFromScreenshot(playerNumber: number, fakeInput: string, enhanceImage: boolean): Promise<string> {
		let buffer: any = null;
		if (fakeInput){
			buffer = await this.getBufferFromLocalFile();
		} else {
			buffer = await this.getScreenshot();
		}
		let cropped = await this.cropPicture(buffer, this.nameWidth, this.nameYHeight, this.nameXOffset, this.namesYCoordinates[playerNumber]);
		if (enhanceImage){
			// cropped = await this.improveImage(cropped);
		}
		this.isScreenshotTaken = true;
		this.savePicture(cropped, playerNumber);
		return await this.recognizeTextFromBuffer(cropped);
	}

	async getStatsFromName(playerName: string): Promise<PlayerStats>{
		if(this.mode ===1){
			process.stdout.write(`triggered 1v1 with ` + playerName)
			let stats = await this.getPlayerStatsFromApi1v1(playerName);
			if (stats && stats.count && stats.count === 1) {
				// Overwrite with recognized name for easier debugging
				stats.items[0].userName = playerName;
				return stats.items[0];
			}
			else {
				return this.addNotFound(playerName);
			}
		} else {
			process.stdout.write(`triggered team with ` + playerName)
			let stats = await this.getPlayerStatsFromApiTeam(playerName);
			if (stats && stats.count && stats.count === 1) {
				// Overwrite with recognized name for easier debugging
				stats.items[0].userName = playerName;
				return stats.items[0];
			}
			else {
				return this.addNotFound(playerName);
			}
		}
	}

	async greyscaleImage(picture: Buffer){
		const greyscale = await this.native.sharp(picture)
			.greyscale()
			.toBuffer();
		return greyscale;
	}

	async blurImage(picture: Buffer) {
		const blurred = await this.native.sharp(picture)
			.blur(0.8)
			.toBuffer();
		return blurred;
	}

	async improveImage(picture: Buffer) {
		const greyscale = await this.native.sharp(picture)
			.threshold(100)
			.negate({ alpha: false })
			// .blur(0.5)
			.toBuffer();
		return greyscale;
	}

	async getBufferFromLocalFile(): Promise<Buffer> {
		const result = await this.native.fs.promises.readFile(this.fakeInput);
		return Buffer.from(result);
	}

	async recognizeTextFromBuffer(picture: Buffer): Promise<string> {
		const text = await Tesseract.recognize(picture, 'eng+chi_sim');
		return text.data.text;
	}

	async cropPicture(picture: Buffer, nameWidth: number, nameHeight: number, xOffset: number, yOffset: number) {
		const cropped = await this.native.sharp(picture)
			.extract({ width: nameWidth, height: nameHeight, left: xOffset, top: yOffset })
			.toBuffer();
		return cropped;
	}

	async savePicture(picture: Buffer, playerNumber: number) {
		await this.native.sharp(picture)
			.toFile(`./src/assets/test-output/picture_cropped_${playerNumber}.png`);
	}

	async getScreenshot(): Promise<Buffer> {
		const sources = await desktopCapturer.getSources({
			types: ['screen'], thumbnailSize: {
				width: 2560*this.scaleFactor,
				height: 1440*this.scaleFactor,
			}
		});
		const screenshot = sources[0].thumbnail.toPNG();
		return Buffer.from(screenshot);
	}

	async getPlayerStatsFromApiTeam(playerName: string) {
		const trimmedPlayerName = playerName.trim();
		if (playerName === ''){
			return;
		}
		return this.httpClient.post<PlayerApiResponse>(`https://api.ageofempires.com/api/ageiii/Leaderboard`, {
			region: '7',
			matchType: '2',
			searchPlayer: trimmedPlayerName,
			page: 1,
			count: 100
		}).toPromise();
	}

	async getPlayerStatsFromApi1v1(playerName: string) {
		const trimmedPlayerName = playerName.trim();
		if (playerName === '') {
			return;
		}
		return this.httpClient.post<PlayerApiResponse>(`https://api.ageofempires.com/api/ageiii/Leaderboard`, {
			region: '7',
			matchType: '1',
			searchPlayer: trimmedPlayerName,
			page: 1,
			count: 100
		}).toPromise();
	}

	closeApp() {
		const win = remote.getCurrentWindow();
		win.minimize();
		this.playerStats = [];
		// win.close();
	}

	addNotFound(playerName: string): PlayerStats{
		return {
			gameId: 'not found',
			userId: 'not found',
			rlUserId: 0,
			userName: playerName,
			avatarUrl: 'not found',
			playerNumber: 'not found',
			elo: 'not found',
			eloRating: 0,
			rank: 0,
			region: 0,
			wins: 0,
			winPercent: '-',
			losses: 0,
			winStreak: 0,
		};
	}
}
