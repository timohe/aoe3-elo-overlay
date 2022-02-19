import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { electron } from 'process';
import Tesseract from 'tesseract.js';
import { desktopCapturer, remote } from 'electron';
import { ElectronService } from '../core/services/index';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { PlayerApiResponse, PlayerStats, GameMode } from '../types';
import { StaticSymbol } from '@angular/compiler';

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
	// data for 1440p screens
	nameXOffset = 890;
	nameYOffset = [530, 530 + 44, 530 + 2 * 44, 530 + 3 * 44, 785 - 2 * 44, 785 - 1 * 44, 785 , 785 + 1 * 44, 785 + 2 * 44, 785 + 3 * 44];
	nameWidth = 300;
	nameHeight = 30;
	playerStats: Array<PlayerStats> = [];
	calcInProgress = false;
	fakeInput = false;
	scaleFactor = 1;

	constructor(private httpClient: HttpClient, private native: ElectronService) {
	}
	ngOnInit(): void {
	}

	setDisplayScaling(){
		this.scaleFactor = screen.width / 2560;
		this.nameXOffset = Math.round(this.nameXOffset * this.scaleFactor);
		// eslint-disable-next-line max-len
		let scaledNameYOffset = [];
		this.nameYOffset.forEach(coordinate => {
			scaledNameYOffset.push(Math.round(coordinate + this.scaleFactor))
		});
		this.nameWidth = Math.round(this.nameWidth * this.scaleFactor);
		this.nameHeight = Math.round(this.nameHeight * this.scaleFactor);
		this.nameYOffset = scaledNameYOffset;
	}

	// main function to trigger all logic
	async getStatsForAll(){
		// this.setDisplayScaling();
		const playerNames = [];
		this.playerStats = [];
		this.calcInProgress = true;
		for (let i = 0; i < this.nameYOffset.length; i++) {
			const playerName = await this.getPlayerNameFromScreenshot(i, this.fakeInput, true);
			// log directly to console
			process.stdout.write(`Playername: ` + playerName)
			if (playerName.includes("]")){
				playerNames.push(playerName.split(']')[1]);
			} else {
				playerNames.push(playerName);
			}
			
		}
		for (const name of playerNames) {
			// this.playerStats.push(this.addNotFound(await this.getStatsFromName(name)));
			this.playerStats.push(await this.getStatsFromName(name));
		};
		this.calcInProgress = false;
		console.log(this.playerStats);
	}

	async getPlayerNameFromScreenshot(playerNumber: number, fakeInput: boolean, enhanceImage: boolean): Promise<string> {
		let buffer = null;
		if (fakeInput){
			buffer = await this.getBufferFromLocalFile();
		} else {
			buffer = await this.getScreenshot();
		}
		let cropped = await this.cropPicture(buffer, this.nameWidth, this.nameHeight, this.nameXOffset, this.nameYOffset[playerNumber]);
		if (enhanceImage){
			cropped = await this.improveImage(cropped);
		}
		// await this.savePicture(cropped, playerNumber);
		return await this.recognizeTextFromBuffer(cropped);
	}

	async getStatsFromName(playerName: string): Promise<PlayerStats>{
		let stats = await this.getPlayerStatsFromApi(playerName);
		if (stats && stats.count && stats.count === 1) {
			return stats.items[0];
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
			.blur(0.5)
			.toBuffer();
		return greyscale;
	}

	async getBufferFromLocalFile(): Promise<Buffer> {
		const result = await this.native.fs.promises.readFile('./src/assets/test-screenshot/4v4.jpg');
		return Buffer.from(result);
	}

	async recognizeTextFromBuffer(picture: Buffer): Promise<string> {
		const text = await Tesseract.recognize(picture, 'eng');
		return text.data.text;
	}

	async cropPicture(picture: Buffer, nameWidth: number, nameHeight: number, xOffset: number, yOffset: number) {
		const cropped = await this.native.sharp(picture)
			.extract({ width: nameWidth, height: nameHeight, left: xOffset, top: yOffset })
			.toBuffer();
		return cropped;
	}

	// eslint-disable-next-line max-len
	async savePicture(picture: Buffer, playerNumber: number) {
		await this.native.sharp(picture)
			.toFile(`./src/assets/test-screenshot/picture_cropped_${playerNumber}.png`);
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

	async getPlayerStatsFromApi(playerName: string) {
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

	closeApp() {
		const win = remote.getCurrentWindow();
		win.minimize();
		this.playerStats = [];
		// win.close();
	}

	toggleFakeInput() {
		this.fakeInput= !this.fakeInput;
	}

	addNotFound(stat: PlayerStats): PlayerStats{
		if(!stat){
			return {
				gameId: 'not found',
				userId: 'not found',
				rlUserId: 0,
				userName: '[not found]',
				avatarUrl: 'not found',
				playerNumber: 'not found',
				elo: '-',
				eloRating: 0,
				rank: 0,
				region: 0,
				wins: 0,
				winPercent: '',
				losses: 0,
				winStreak: 0,
			};
		}
		else {
			return stat;
		}
	}
}
