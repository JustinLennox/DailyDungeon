import { Comment, Devvit, JobContext, MediaPlugin, RedditAPIClient, RedisClient, ScheduledCronJob, ScheduledJob, Scheduler, UIClient, useForm } from '@devvit/public-api';
import { ExpireTime, StringDictionary } from '../utils/utils.js';

export const getDiceRollTotalKey = (gameData: any): string => {
	return `rollTotals:${gameData?.postID ?? "default"}`;
}

const getUserPostRollKey = (postID: string | undefined | null): string => {
	return `userRolls:${postID}`;
}

type RollDiceParams = {
	context: Devvit.Context;
	gameData: any;
	fromComments: boolean;
}

export const RollDice = async (params: RollDiceParams): Promise<number | null> => {
	if (!params.fromComments && (!params.gameData || !params.gameData.postID)) {
		throw new Error("no-post-data");
	};
	if (!params.fromComments && params.gameData.finished) {
		throw new Error("post-finished");
	};
	// Get user ID
	const user = await params.context.reddit.getCurrentUser();
	const userID = user?.id ?? "anonymous";
	if (params.gameData && params.gameData.postID && user) {
		// Check if the user has already rolled the dice for the latest post ID
		const userRolled = await params.context.redis.hGet(getUserPostRollKey(params.gameData.postID), userID);
		const roll = userRolled ? parseInt(userRolled) : NaN;
		if (userRolled && !Number.isNaN(roll)) {
			// context.ui.showToast(`You have already rolled ${roll} for this post.`);
			return roll;
		}
	} else if (!params.fromComments) {
		return null;
	}

	// User has not rolled yet

	// Simulate dice roll
	const diceCount = 20;
	const diceRoll = Math.floor(Math.random() * diceCount) + 1;

	if (params.gameData && params.gameData.postID && !params.gameData.finished) {
		// Store the user's dice roll
		const userRollIncr: StringDictionary = {};
		userRollIncr[userID] = diceRoll.toString()

		await params.context.redis.hSet(getUserPostRollKey(params.gameData.postID), userRollIncr);
		await params.context.redis.expire(getUserPostRollKey(params.gameData.postID), ExpireTime.day);

		// Save back to Redis
		await params.context.redis.hIncrBy(getDiceRollTotalKey(params.gameData.postID), diceRoll.toString(), 1);
		await params.context.redis.expire(getDiceRollTotalKey(params.gameData.postID), ExpireTime.day);
	}

	return diceRoll;
}