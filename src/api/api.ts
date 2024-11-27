import { Comment, Devvit, JobContext, MediaPlugin, RedditAPIClient, RedisClient, ScheduledCronJob, ScheduledJob, Scheduler, UIClient, useForm } from '@devvit/public-api';
import { CreatePreview } from '../components/Preview.js';
import { StringDictionary } from '../utils/utils.js';

// const DEFAULT_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DEFAULT_REFRESH_INTERVAL = 60000;

const baseURL = "https://gwamps-quest-default-rtdb.firebaseio.com/RedditPlaysDnD"

const getGameURL = (subredditName: string): string => {
	return `${baseURL}/${subredditName}/games/${subredditName}.json`;
}

export const fetchGame = async (subredditName: string): Promise<any | null> => {
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
			console.log("Fetch game info failed: ", response);
			return null;
		}
		const responseJSON = await response.json();
		console.log("Fetch info succeeded: ", responseJSON);
	} catch (e) {
		console.error("Failed to fetch game info: ", e);
	}
}

export const createPost = async (context: Devvit.Context | JobContext, ui: UIClient | undefined) => {
	try {
		ui?.showToast("Creating post, hang tight...");
		const subreddit = await context.reddit.getCurrentSubreddit();
		const gameData = await fetchGame(subreddit.name);

		if (!gameData || Object.keys(gameData).length <= 0 || gameData.currentDay == null) {
			throw new Error(`Failed to load game data from response json`);
		}
		// Increment the day for a new post
		const currentDay = gameData.currentDay + 1;
		if (!gameData.contentArray || !gameData.contentArray[currentDay]) {
			throw new Error(`No next day for current day ${currentDay} and data ${gameData}`);
		}

		const todaysGame = gameData.contentArray[currentDay];

		const titlePrefix = gameData.titlePrefix ?? todaysGame.titlePrefix ?? `${subreddit.name} Dungeon:`;

		const title = todaysGame.title ?? `${titlePrefix} Day ${currentDay + 1}`;

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
		const contentUpdate = {
			postID: postID,
			postCreatedAt: postCreatedAt,
		};

		// Step 2: Update the contentArray
		let contentArray = gameData.contentArray || [];
		contentArray.push(contentUpdate);

		// Step 3: Update the posts object
		let posts = gameData.posts || {};
		posts[postID] = currentDay;

		// Step 4: Prepare the updates object
		const updates = {
			contentArray: contentArray,
			latestPostID: postID,
			posts: posts,
		};

		// Step 5: Make a PATCH request to update the data
		const patchResponse = await fetch(`${getGameURL(subreddit.name)}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(updates),
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
		}
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
		// Firebase database URL
		const gameUrl: string = getGameURL(subredditName);
		console.log("Fetching game in updateGame from ", gameUrl);
		// Fetch the current game data from Firebase
		const gameData = await fetchGame(subredditName);

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
				continue;
			}

			// Ensure the item has a postID
			if (!item.postID) {
				console.error(`No post ID for item at index ${i}`);
				continue;
			}

			// Get the top comment for the current item
			const postID: string = item.postID;
			const topComment = await getTopComment(context, postID);

			// Update the item with the top comment and mark it as finished
			item.topComment = topComment;
		}

		// Prepare the updates object
		const updates = {
			contentArray: contentArray,
		};

		// Make a PATCH request to update the data
		const patchResponse = await fetch(`${gameUrl}`, {
			method: 'PATCH',
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

	} catch (e) {
		console.error(`Error in updateGame: ${e}`);
	}
};
