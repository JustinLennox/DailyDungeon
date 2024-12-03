import { Comment, Devvit, JobContext, MediaPlugin, RedditAPIClient, RedisClient, RichTextBuilder, ScheduledCronJob, ScheduledJob, Scheduler, UIClient, useForm } from '@devvit/public-api';
import { CreatePreview } from '../components/Preview.js';
import { getRelativeTime, StringDictionary } from '../utils/utils.js';

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
			return { gameData: null, error: `Fetch game failed ${response.status} ${response.statusText}` };
		}
		const responseJSON = await response.json();
		console.log("Fetch game succeeded");
		return { gameData: responseJSON, error: null };
	} catch (e) {
		return { gameData: null, error: `Fetch game failed ${e}` };
	}
}

export const createPost = async (context: Devvit.Context | JobContext, ui: UIClient | null = null) => {
	try {
		ui?.showToast("Creating post, hang tight...");
		const subreddit = await context.reddit.getCurrentSubreddit();
		const { gameData, error } = await fetchGame(subreddit.name);

		if (error) {
			console.error(`Error fetching game data: ${error}`);
		}

		if (!gameData || Object.keys(gameData).length <= 0 || gameData.currentDay == null) {
			console.error(`This subreddit's dungeon hasn't formed yet.`);
		}

		if (gameData.ended) {
			console.error("This subreddit's game has ended.")
			ui?.showToast({
				text: `This subreddit's game has ended`,
			});
			return;
		}

		const currentDay = (gameData?.currentDay ?? 0);
		console.log("Current day: "), currentDay;

		let title = ""
		if (gameData && gameData.contentArray && gameData.contentArray[currentDay]) {
			console.log(`No content array for game data`);
			const todaysGame = gameData.contentArray[currentDay];
			const titlePrefix = gameData.titlePrefix ?? todaysGame.titlePrefix ?? `r/${subreddit.name} Dungeon:`;
			title = todaysGame.title ?? `${titlePrefix} Day ${currentDay + 1}`;
		} else {
			title = `r/${context.subredditName ?? "Daily"} Dungeon`;
			console.error("This subreddit's dungeon hasn't fully formed yet.");
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
			try {
				const patchResponse = await fetch(`${baseURL}/Subreddits/${subreddit.name}/Posts/${postID}.json`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(postUpdate),
				});
			} catch {
				throw new Error(`Error updating data: ${patchResponse.statusText}`);
			}
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
				text: `Failed to create post: ${e}`,
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

export const getUserDiceRoll = async (context: Devvit.Context | JobContext, userID: string | null | undefined, postID: string | null | undefined): Promise<number | null> => {
	if (!userID) {
		console.log("Can't get dice roll for no user ID");
		return null;
	}
	if (!postID) {
		console.log("Can't get dice roll for no post ID");
		return null;
	}
	const postUserRollsKey = `userRolls:${postID}`;
	const userRollString = await context.redis.hGet(postUserRollsKey, userID);
	console.log("Got user roll string: ", userRollString);
	const roll = userRollString ? parseInt(userRollString) : NaN;
	if (roll && !Number.isNaN(roll)) {
		console.log("Returning user roll: ", roll);
		// context.ui.showToast(`You have already rolled ${roll} for this post.`);
		return roll;
	}
	return null;
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
				// updatePostFallback(context, item.postID, item, null);
				continue;
			}

			const commentUpdate: any = { ...topComment };
			commentUpdate.dateString = getRelativeTime(topComment.createdAt);
			commentUpdate.diceRoll = await getUserDiceRoll(context, topComment.authorId, topComment.postId);

			// updatePostFallback(context, item.postID, item, commentUpdate);

			if (topComment.id === item.topComment?.id && commentUpdate.diceRoll === item.topComment?.diceRoll) {
				console.log(`Top comment is already top comment with id ${topComment.id} and dice roll ${commentUpdate.diceRoll}, skipping`);
				continue;
			}

			const updates = {
				comment: commentUpdate,
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

export const installApp = async (
	context: Devvit.Context | JobContext
) => {
	const appInstallDate = new Date().toISOString();
	if (!context.subredditName) {
		console.error("No subreddit name for app install");
		return;
	}

	// Prepare the content array item
	const subredditUpdate = {
		appInstallDate: appInstallDate
	};

	// Step 5: Make a PATCH request to update the data
	const patchResponse = await fetch(`${baseURL}/Subreddits/${context.subredditName}/Installs/${context.subredditName}.json`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(subredditUpdate),
	});
}

const updatePostFallback = async (context: Devvit.Context | JobContext, postID: string, gameData: any | null, commentUpdate: any | null) => {
	// let textFallbackRichtext = new RichTextBuilder()
	// 	.paragraph((p) => {
	// 		p.text({text: gameData?.text ?? "This is a Daily Dungeon post. Please view it on new reddit!"})
	// 	})
	// if (commentUpdate) {
	// 	textFallbackRichtext
	// 	.paragraph((p) => {
	// 		p.userLink({username: commentUpdate.authorName, showPrefix: true})
	// 	})
	// 	.paragraph((p) => {
	// 		p.text({text: `${commentUpdate.body}`})
	// 	})
	// }

	// const post = await context.reddit.getPostById(postID);
	// await post.setTextFallback({richtext: textFallbackRichtext});
}
