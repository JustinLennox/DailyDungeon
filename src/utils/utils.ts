import { RedisClient } from "@devvit/public-api";

export enum TabType {
	main,
	past
};

export interface StringDictionary {
	[key: string]: string;
}

export enum ExpireTime {
	day = 86400,
	week = 604800,
	month = 2.628e+6,
	year = 3.154e+7,
}