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

export function getRelativeTime(date: Date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
        return `${diffSec}s`;
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return `${diffMin}m`;
    }

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
        return `${diffHour}h`;
    }

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) {
        return `${diffDay}d`;
    }

    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) {
        return `${diffMonth}mo`;
    }

    const diffYear = Math.floor(diffMonth / 12);
    return `${diffYear}y`;
}
