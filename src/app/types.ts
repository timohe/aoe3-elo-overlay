export interface PlayerApiResponse {
	count: number;
	items: Array<PlayerStats>;
}

export interface PlayerStats {
	gameId: string;
	userId: string;
	rlUserId: number;
	userName: string;
	avatarUrl: string;
	playerNumber: string;
	elo: any;
	eloRating: number;
	rank: number;
	region: number;
	wins: number;
	winPercent: any;
	losses: number;
	winStreak: number;
}

export enum GameMode {
	vs1 = '1v1',
	vs2 = '2v2',
	vs3 = '3v3',
	vs4 = '4v4',
}

