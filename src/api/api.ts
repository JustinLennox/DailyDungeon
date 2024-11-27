import { Comment, Devvit, JobContext, MediaPlugin, RedditAPIClient, RedisClient, ScheduledCronJob, ScheduledJob, Scheduler, UIClient, useForm } from '@devvit/public-api';
import { CreatePreview } from '../components/Preview.js';
import { StringDictionary } from '../utils/utils.js';

// const DEFAULT_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DEFAULT_REFRESH_INTERVAL = 60000;

const baseURL = "https://gwamps-quest-default-rtdb.firebaseio.com/RedditPlaysDnD"

const getGameURL = (subredditName: string): string => {
	return `${baseURL}/Subreddits/${subredditName}/games/${subredditName}.json`;
}

interface GameResponse {
	gameData: any | null;
	error: string | null;
}

export const fetchGame = async (subredditName: string): Promise<GameResponse> => {
	console.log("Fetching game for ", subredditName);
	try {
		// Construct the full URL with all query parameters
		const url = getGameURL(subredditName);
		console.log("Fetching game from: ", url);
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'accept': 'application/json',
			},
		});
		if (!response.ok) {
			// Handle non-200 responses
			return { gameData: null, error: `Fetch game failed ${response.status} ${response.statusText}`};
		}
		const responseJSON = await response.json();
		console.log("Fetch info succeeded: ", responseJSON);
		return { gameData: responseJSON, error: null};
	} catch (e) {
		return { gameData: null, error: `Fetch game failed ${e}`};
	}
}

export const createPost = async (context: Devvit.Context | JobContext, ui: UIClient | null = null) => {
	try {
		ui?.showToast("Creating post, hang tight...");
		const subreddit = await context.reddit.getCurrentSubreddit();
		const { gameData, error } = await fetchGame(subreddit.name);

		if (error) {
			throw new Error(`Fetch game error occurred`);
		}

		if (!gameData || Object.keys(gameData).length <= 0 || gameData.currentDay == null) {
			console.log(`No existing game data`);
		}

		// Increment the day for a new post
		console.log("Incrementing current day");
		const currentDay = (gameData?.currentDay ?? -1) + 1;
		let title = ""
		if (gameData && gameData.contentArray && gameData.contentArray[currentDay]) {

			console.log(`No content array for game data`);
			const todaysGame = gameData.contentArray[currentDay];
			const titlePrefix = gameData.titlePrefix ?? todaysGame.titlePrefix ?? `${subreddit.name} Dungeon:`;
			title = todaysGame.title ?? `${titlePrefix} Day ${currentDay + 1}`;
		} else {
			title = `r/${subreddit.name} Dungeon`;
		}

		// Create the Reddit post with the updated title
		const post = await context.reddit.submitPost({
			// This will show while your post is loading
			preview: CreatePreview(),
			title: title,
			subredditName: subreddit.name,
		});

		const postID = post.id;
		const postCreatedAt = new Date().toISOString();

		// Prepare the content array item
		const postUpdate = {
			postID: postID,
			postCreatedAt: postCreatedAt,
			subredditName: subreddit.name,
			subredditID: subreddit.id,
			creatingUserID: context.userId,
			day: currentDay
		};

		// Step 5: Make a PATCH request to update the data
		const patchResponse = await fetch(`${baseURL}/Subreddits/${subreddit.name}/Posts/${postID}.json`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(postUpdate),
		});

		if (!patchResponse.ok) {
			throw new Error(`Error updating data: ${patchResponse.statusText}`);
		}
		console.log("Successfully updated game in Firebase");

		if (ui) {
			ui.showToast({
				text: `Successfully created your post!`,
				appearance: 'success',
			});

			ui.navigateTo(post);
		} else {
			console.log("No ui for navigation");
		}
		await updateGame(context.redis, subreddit.name, context);
	} catch (e) {
		console.error("Error creating post: ", e);
		if (ui) {
			ui.showToast({
				text: `Failed to create your post: ${e}`,
				appearance: 'neutral',
			});
		}
	}
}

const getTopComment = async (context: Devvit.Context | JobContext, postID: string): Promise<Comment | null> => {
	const comments = await context.reddit.getComments({
		postId: postID,
		limit: 1,
		sort: 'top',
	});
	const allComments = await comments.all();
	const topComment = allComments[0];
	if (!topComment) {
		console.log("No top comment loaded");
		return null;
	}
	return topComment;
}

export const updateGame = async (
	redis: RedisClient,
	subredditName: string,
	context: Devvit.Context | JobContext
): Promise<void> => {
	try {
		console.log("Fetching game in updateGame");
		// Fetch the current game data from Firebase
		const { gameData, error } = await fetchGame(subredditName);

		if (error) {
			throw new Error(`Fetch game error occurred`);
		}

		if (!gameData) {
			console.error("Failed to fetch game data in update");
			return;
		}

		// Set the Redis property 'game' to the game data
		await redis.set('game', JSON.stringify(gameData));

		// Check if the game has ended
		if (gameData.ended ?? false) {
			console.log('Game has ended');
			return;
		}

		// Get the contentArray
		const contentArray = gameData.contentArray || [];
		if (contentArray.length === 0) {
			console.log('Content array is empty');
			return;
		}

		// Loop through the contentArray
		for (let i = 0; i < contentArray.length; i++) {
			const item = contentArray[i];

			// Skip items that are already finished
			if (item.finished || item.topCommentLocked) {
				console.log(`${item.postID} is finished or locked, skipping`);
				continue;
			}

			// Ensure the item has a postID
			if (!item.postID) {
				console.log(`No post ID for item at index ${i}, skipping`);
				continue;
			}

			// Get the top comment for the current item
			const postID: string = item.postID;
			console.log(`Getting top comment for ${item.postID}`);
			const topComment = await getTopComment(context, postID);
			if (!topComment) {
				console.log("Couldn't get top comment for post ", postID);
				continue;
			}

			if (topComment.id === item.topComment?.id) {
				console.log(`Top comment is already top comment with id ${topComment.id}, skipping`);
				continue;
			}

			const updates = {
				comment: topComment,
				postID: postID,
				subredditName: subredditName,
			}

			console.log("Posting top comment: ", updates);

			const patchResponse = await fetch(`${baseURL}/Subreddits/${subredditName}/TopComments/${postID}.json`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updates),
			});
	
			if (!patchResponse.ok) {
				console.error(`Failed to update game data: ${patchResponse.statusText}`);
			} else {
				console.log('Game data updated successfully');
			}
		}
	} catch (e) {
		console.error(`Error in updateGame: ${e}`);
	}
};
